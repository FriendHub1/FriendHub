/* Public guest support API. Tokens are high-entropy bearer credentials; only SHA-256 hashes are stored. */
export function createGuestSupportHandler({SUPABASE_URL,jsonResponse,sendResendEmail,escapeHtml}) {
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
  async function messages(c,env) {
    const h=headers(env),r=await fetch(SUPABASE_URL+"/rest/v1/support_messages?case_id=eq."+encodeURIComponent(c.id)+"&select=id,sender_type,message,created_at,read_at&order=created_at.asc",{headers:h});
    if(!r.ok){console.error("Guest support messages",r.status,await r.text());return null;}
    const rows=await r.json(),ids=(rows||[]).filter(m=>m.sender_type==="admin"&&!m.read_at).map(m=>m.id);
    if(ids.length)await fetch(SUPABASE_URL+"/rest/v1/support_messages?id=in.("+ids.map(encodeURIComponent).join(",")+")",{method:"PATCH",headers:{...h,Prefer:"return=minimal"},body:JSON.stringify({read_at:new Date().toISOString()})});
    return rows||[];
  }
  async function notify(c,message,env,isNew) {
    const no=String(c.case_number),body=(isNew?"A visitor submitted a new support request.":"A visitor replied to a support case.")+"\nCase: #"+no+"\nContact: "+c.guest_email+"\n\n"+message+"\n\nReply directly to this email to respond.";
    const result=await sendResendEmail(env,{from:"XOXO Avenue Support <support@xoxoavenue.com>",to:["xoxoavenuesupport@gmail.com"],reply_to:"case-"+no+"@reply.xoxoavenue.com",subject:"[##"+no+"##] - "+(isNew?"New guest support message":"Guest replied to support"),text:body,html:'<div style="font-family:Arial,sans-serif;line-height:1.6;color:#241735"><h2>XOXO Avenue Support 💜</h2><p>'+escapeHtml(body)+'</p></div>'});
    return result.ok;
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
    let body;try{body=await request.json();}catch{return jsonResponse({ok:false,error:"Invalid request."},400);}
    if(body?.website)return jsonResponse({ok:true});
    const action=String(body?.action||"create"),message=String(body?.message||"").trim();
    if(!message||message.length>5000)return jsonResponse({ok:false,error:"Write a message (up to 5,000 characters)."},400);
    if(action==="create"){
      const email=String(body?.email||"").trim().toLowerCase(),name=String(body?.name||"").trim().slice(0,80);
      if(email.length>254||!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email))return jsonResponse({ok:false,error:"Enter a valid email address so we can reply."},400);
      const ip=String(request.headers.get("CF-Connecting-IP")||"unknown"),ipHash=await hash(env.SUPABASE_SECRET_KEY+"|"+ip);
      const rate=await fetch(SUPABASE_URL+"/rest/v1/rpc/xoxo_support_guest_rate_limit",{method:"POST",headers:h,body:JSON.stringify({p_ip_hash:ipHash,p_max_attempts:4})});
      if(!rate.ok){console.error("Guest support rate limit",rate.status,await rate.text());return jsonResponse({ok:false,error:"Support is temporarily unavailable."},503);}
      if(await rate.json()!==true)return jsonResponse({ok:false,error:"Too many messages. Please try again in 15 minutes."},429);
      const token=(crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"")).toLowerCase(),tokenHash=await hash(token);
      const created=await fetch(SUPABASE_URL+"/rest/v1/support_cases",{method:"POST",headers:{...h,Prefer:"return=representation"},body:JSON.stringify({user_id:null,guest_email:email,guest_name:name||null,guest_token_hash:tokenHash,status:"open"})});
      const raw=await created.text();let rows=[];try{rows=raw?JSON.parse(raw):[];}catch{}
      if(!created.ok||!rows[0]?.id){console.error("Guest case create",created.status,raw);return jsonResponse({ok:false,error:"We couldn't start your support conversation. Please try again."},502);}
      const c=rows[0],saved=await fetch(SUPABASE_URL+"/rest/v1/support_messages",{method:"POST",headers:{...h,Prefer:"return=minimal"},body:JSON.stringify({case_id:c.id,sender_id:null,sender_type:"user",message})});
      if(!saved.ok){console.error("Guest message insert",saved.status,await saved.text());await fetch(SUPABASE_URL+"/rest/v1/support_cases?id=eq."+encodeURIComponent(c.id),{method:"DELETE",headers:h});return jsonResponse({ok:false,error:"Your message couldn't be saved. Please try again."},502);}
      const adminNotified=await notify(c,message,env,true);
      const confirmation=await sendResendEmail(env,{from:"XOXO Avenue Support <support@xoxoavenue.com>",to:[email],reply_to:"case-"+c.case_number+"@reply.xoxoavenue.com",subject:"[##"+c.case_number+"##] - We received your message",text:"Thanks for contacting XOXO Avenue Support. We received your message and will reply to this email. Your case number is #"+c.case_number+". You can reply directly to this email to continue the conversation. 💜",html:"<p>Thanks for contacting XOXO Avenue Support 💜</p><p>We received your message. Your case number is <b>#"+escapeHtml(c.case_number)+"</b>.</p><p>You can reply directly to this email to continue the conversation.</p>"});
      return jsonResponse({ok:true,token,support_case:{id:c.id,case_number:c.case_number,status:c.status},admin_notified:adminNotified,confirmation_sent:confirmation.ok},201);
    }
    if(action==="message"){
      const token=String(request.headers.get("X-Xoxo-Support-Token")||"").trim();
      if(!/^[a-f0-9]{64}$/i.test(token))return jsonResponse({ok:false,error:"Support session not found."},401);
      const c=await findCase(token,env);if(!c)return jsonResponse({ok:false,error:"Support session not found."},404);
      if(c.status==="closed")return jsonResponse({ok:false,error:"This support case is closed. Please start a new message."},409);
      const saved=await fetch(SUPABASE_URL+"/rest/v1/support_messages",{method:"POST",headers:{...h,Prefer:"return=minimal"},body:JSON.stringify({case_id:c.id,sender_id:null,sender_type:"user",message})});
      if(!saved.ok){console.error("Guest support reply",saved.status,await saved.text());return jsonResponse({ok:false,error:"Your message couldn't be sent. Please try again."},502);}
      await fetch(SUPABASE_URL+"/rest/v1/support_cases?id=eq."+encodeURIComponent(c.id),{method:"PATCH",headers:{...h,Prefer:"return=minimal"},body:JSON.stringify({status:"open",updated_at:new Date().toISOString()})});
      return jsonResponse({ok:true,admin_notified:await notify(c,message,env,false)});
    }
    return jsonResponse({ok:false,error:"Unsupported support action."},400);
  };
}
