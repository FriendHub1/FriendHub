/* Public guest support API. Guest tokens are high-entropy bearer credentials; only SHA-256 hashes are stored. */
export function createGuestSupportHandler({SUPABASE_URL,jsonResponse,sendResendEmail,escapeHtml}) {
  const BUCKET="support-attachments";
  const IMAGE_TYPES={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
  const VIDEO_TYPES={"video/mp4":"mp4","video/quicktime":"mov","video/webm":"webm"};
  const MAX_IMAGE=10*1024*1024, MAX_VIDEO=30*1024*1024;
  async function hash(value) {
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value||"")));
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  }
  const headers=env=>({apikey:env.SUPABASE_SECRET_KEY,Authorization:"Bearer "+env.SUPABASE_SECRET_KEY,"Content-Type":"application/json","Accept-Profile":"public","Content-Profile":"public"});
  async function findCase(token,env) {
    const h=await hash(token),r=await fetch(SUPABASE_URL+"/rest/v1/support_cases?guest_token_hash=eq."+encodeURIComponent(h)+"&select=id,case_number,status,guest_email,guest_name&limit=1",{headers:headers(env)});
    if(!r.ok){console.error("Guest support lookup",r.status,await r.text());return null;}
    const rows=await r.json();return Array.isArray(rows)&&rows.length===1?rows[0]:null;
  }
  async function signedUrl(path,env) {
    const r=await fetch(SUPABASE_URL+"/storage/v1/object/sign/"+BUCKET+"/"+path.split("/").map(encodeURIComponent).join("/"),{method:"POST",headers:headers(env),body:JSON.stringify({expiresIn:3600})});
    if(!r.ok){console.error("Guest support signed URL",r.status,await r.text());return null;}
    const data=await r.json(),url=data.signedURL||data.signedUrl;
    return url?(url.startsWith("http")?url:SUPABASE_URL+"/storage/v1"+(url.startsWith("/")?url:"/"+url)):null;
  }
  async function messages(c,env) {
    const h=headers(env),r=await fetch(SUPABASE_URL+"/rest/v1/support_messages?case_id=eq."+encodeURIComponent(c.id)+"&select=id,sender_type,message,created_at,read_at,attachment_url,attachment_type&order=created_at.asc",{headers:h});
    if(!r.ok){console.error("Guest support messages",r.status,await r.text());return null;}
    const rows=await r.json(),ids=(rows||[]).filter(m=>m.sender_type==="admin"&&!m.read_at).map(m=>m.id);
    for(const m of rows||[])if(m.attachment_url)m.attachment_signed_url=await signedUrl(m.attachment_url,env);
    if(ids.length)await fetch(SUPABASE_URL+"/rest/v1/support_messages?id=in.("+ids.map(encodeURIComponent).join(",")+")",{method:"PATCH",headers:{...h,Prefer:"return=minimal"},body:JSON.stringify({read_at:new Date().toISOString()})});
    return rows||[];
  }
  async function notify(c,message,env,isNew,attachmentType) {
    const no=String(c.case_number),body=(isNew?"A visitor submitted a new support request.":"A visitor replied to a support case.")+"\nCase: #"+no+"\nContact: "+c.guest_email+"\n\n"+message+(attachmentType?"\n\nAttachment included: "+attachmentType:"")+"\n\nReply directly to this email to respond.";
    try {
      const result=await sendResendEmail(env,{from:"XOXO Avenue Support <support@xoxoavenue.com>",to:["xoxoavenuesupport@gmail.com"],reply_to:"case-"+no+"@reply.xoxoavenue.com",subject:"[##"+no+"##] - "+(isNew?"New guest support message":"Guest replied to support"),text:body,html:'<div style="font-family:Arial,sans-serif;line-height:1.6;color:#241735"><h2>XOXO Avenue Support 💜</h2><p>'+escapeHtml(body)+'</p></div>'});
      return result.ok;
    } catch(error) { console.error("Guest support notification exception",String(error)); return false; }
  }
  async function upload(file,caseId,env) {
    if(!file||typeof file.arrayBuffer!=="function")return null;
    const type=String(file.type||"").toLowerCase(),isImage=Object.hasOwn(IMAGE_TYPES,type),isVideo=Object.hasOwn(VIDEO_TYPES,type);
    if(!isImage&&!isVideo)throw new Error("Choose a JPG, PNG, WebP, GIF, MP4, MOV or WebM file.");
    if(file.size>(isImage?MAX_IMAGE:MAX_VIDEO))throw new Error(isImage?"Images can be up to 10 MB.":"Videos can be up to 30 MB.");
    const ext=(isImage?IMAGE_TYPES:VIDEO_TYPES)[type],path="guest/"+caseId+"/"+crypto.randomUUID()+"."+ext;
    const r=await fetch(SUPABASE_URL+"/storage/v1/object/"+BUCKET+"/"+path.split("/").map(encodeURIComponent).join("/"),{method:"POST",headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:"Bearer "+env.SUPABASE_SECRET_KEY,"Content-Type":type,"x-upsert":"false"},body:await file.arrayBuffer()});
    if(!r.ok){console.error("Guest support upload",r.status,await r.text());throw new Error("The attachment could not be uploaded. Please try again.");}
    return {path,type:isImage?"image":"video"};
  }
  return async function handleGuestSupport(request,env) {
    if(!env.SUPABASE_SECRET_KEY||!env.RESEND_API_KEY)return jsonResponse({ok:false,error:"Support is temporarily unavailable."},500);
    const h=headers(env);
    if(request.method==="GET"){
      const token=String(request.headers.get("X-Xoxo-Support-Token")||"").trim();
      if(!/^[a-f0-9]{64}$/i.test(token))return jsonResponse({ok:false,error:"Support session not found."},401);
      const c=await findCase(token,env);if(!c)return jsonResponse({ok:false,error:"Support session not found."},404);
      const list=await messages(c,env);if(!list)return jsonResponse({ok:false,error:"Messages could not be loaded."},502);
      return jsonResponse({ok:true,support_case:c,messages:list});
    }
    if(request.method!=="POST")return jsonResponse({ok:false,error:"Method not allowed."},405);
    let body,file=null;
    try {
      if((request.headers.get("Content-Type")||"").includes("multipart/form-data")){
        const form=await request.formData();body=Object.fromEntries(form.entries());file=form.get("attachment");
        if(file&&(!file.size||typeof file.arrayBuffer!=="function"))file=null;
      } else body=await request.json();
    } catch { return jsonResponse({ok:false,error:"Invalid request."},400); }
    if(body?.website)return jsonResponse({ok:true});
    const action=String(body?.action||"create"),message=String(body?.message||"").trim();
    if(message.length>5000||(!message&&!file))return jsonResponse({ok:false,error:"Write a message or attach a file (up to 5,000 characters)."},400);
    if(action!=="create"&&action!=="message")return jsonResponse({ok:false,error:"Unsupported support action."},400);
    let c,token=null,isNew=false;
    if(action==="create"){
      const email=String(body?.email||"").trim().toLowerCase(),name=String(body?.name||"").trim().slice(0,80);
      if(email.length>254||!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email))return jsonResponse({ok:false,error:"Enter a valid email address so we can reply."},400);
      const ip=String(request.headers.get("CF-Connecting-IP")||"unknown"),ipHash=await hash(env.SUPABASE_SECRET_KEY+"|"+ip);
      const rate=await fetch(SUPABASE_URL+"/rest/v1/rpc/xoxo_support_guest_rate_limit",{method:"POST",headers:h,body:JSON.stringify({p_ip_hash:ipHash,p_max_attempts:4})});
      if(!rate.ok){console.error("Guest support rate limit",rate.status,await rate.text());return jsonResponse({ok:false,error:"Support is temporarily unavailable."},503);}
      if(await rate.json()!==true)return jsonResponse({ok:false,error:"Too many messages. Please try again in 15 minutes."},429);
      token=(crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"")).toLowerCase();
      const tokenHash=await hash(token);
      const created=await fetch(SUPABASE_URL+"/rest/v1/support_cases",{method:"POST",headers:{...h,Prefer:"return=representation"},body:JSON.stringify({user_id:null,guest_email:email,guest_name:name||null,guest_token_hash:tokenHash,status:"open"})});
      const raw=await created.text();let rows=[];try{rows=raw?JSON.parse(raw):[];}catch{}
      if(!created.ok||!rows[0]?.id){console.error("Guest case create",created.status,raw);return jsonResponse({ok:false,error:"We couldn't start your support conversation. Please try again."},502);}
      c=rows[0];isNew=true;
    } else {
      const ip=String(request.headers.get("CF-Connecting-IP")||"unknown"),ipHash=await hash(env.SUPABASE_SECRET_KEY+"|"+ip);
      const rate=await fetch(SUPABASE_URL+"/rest/v1/rpc/xoxo_support_guest_rate_limit",{method:"POST",headers:h,body:JSON.stringify({p_ip_hash:ipHash,p_max_attempts:12})});
      if(!rate.ok)return jsonResponse({ok:false,error:"Support is temporarily unavailable."},503);
      if(await rate.json()!==true)return jsonResponse({ok:false,error:"Too many messages. Please wait before sending another message."},429);
      token=String(request.headers.get("X-Xoxo-Support-Token")||"").trim();
      if(!/^[a-f0-9]{64}$/i.test(token))return jsonResponse({ok:false,error:"Support session not found."},401);
      c=await findCase(token,env);if(!c)return jsonResponse({ok:false,error:"Support session not found."},404);
      if(c.status==="closed")return jsonResponse({ok:false,error:"This support case is closed. Please start a new message."},409);
    }
    let attachment=null;
    try { if(file)attachment=await upload(file,c.id,env); }
    catch(error) {
      if(isNew)await fetch(SUPABASE_URL+"/rest/v1/support_cases?id=eq."+encodeURIComponent(c.id),{method:"DELETE",headers:h});
      return jsonResponse({ok:false,error:error.message||"The attachment could not be uploaded."},400);
    }
    const saved=await fetch(SUPABASE_URL+"/rest/v1/support_messages",{method:"POST",headers:{...h,Prefer:"return=minimal"},body:JSON.stringify({case_id:c.id,sender_id:null,sender_type:"user",message:message||(attachment?.type==="video"?"Video attachment":"Image attachment"),attachment_url:attachment?.path||null,attachment_type:attachment?.type||null})});
    if(!saved.ok){
      console.error("Guest support message insert",saved.status,await saved.text());
      if(attachment)await fetch(SUPABASE_URL+"/storage/v1/object/"+BUCKET+"/"+attachment.path.split("/").map(encodeURIComponent).join("/"),{method:"DELETE",headers:{apikey:env.SUPABASE_SECRET_KEY,Authorization:"Bearer "+env.SUPABASE_SECRET_KEY}});
      if(isNew)await fetch(SUPABASE_URL+"/rest/v1/support_cases?id=eq."+encodeURIComponent(c.id),{method:"DELETE",headers:h});
      return jsonResponse({ok:false,error:"Your message couldn't be saved. Please try again."},502);
    }
    if(!isNew)await fetch(SUPABASE_URL+"/rest/v1/support_cases?id=eq."+encodeURIComponent(c.id),{method:"PATCH",headers:{...h,Prefer:"return=minimal"},body:JSON.stringify({status:"open",updated_at:new Date().toISOString()})});
    const adminNotified=await notify(c,message,env,isNew,attachment?.type);
    let confirmationSent=true;
    if(isNew){
      try { const confirmation=await sendResendEmail(env,{from:"XOXO Avenue Support <support@xoxoavenue.com>",to:[c.guest_email],reply_to:"case-"+c.case_number+"@reply.xoxoavenue.com",subject:"[##"+c.case_number+"##] - We received your message",text:"Thanks for contacting XOXO Avenue Support. We received your message and will reply to this email. Your case number is #"+c.case_number+". You can reply directly to this email to continue the conversation. 💜",html:"<p>Thanks for contacting XOXO Avenue Support 💜</p><p>We received your message. Your case number is <b>#"+escapeHtml(c.case_number)+"</b>.</p><p>You can reply directly to this email to continue the conversation.</p>"});confirmationSent=confirmation.ok; }
      catch(error) { confirmationSent=false;console.error("Guest support confirmation exception",String(error)); }
      return jsonResponse({ok:true,token,support_case:{id:c.id,case_number:c.case_number,status:c.status},admin_notified:adminNotified,confirmation_sent:confirmationSent},201);
    }
    return jsonResponse({ok:true,admin_notified:adminNotified});
  };
}
