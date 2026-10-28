// XOXO Reveal BETA — HTTP request adapter, NOT DEPLOYED.
// Dependencies must be trusted server-side implementations. No DB or Storage
// calls occur unless the caller explicitly supplies them.
import {validateUploadRequest,readBoundedUploadBody} from "./http-boundary.mjs";
import {processRevealUploadRequest} from "./request-handler.mjs";

const json=(status,body,origin,allowedOrigin)=>{
 const headers={"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"};
 if(origin===allowedOrigin)headers["access-control-allow-origin"]=allowedOrigin;
 return new Response(JSON.stringify(body),{status,headers});
};
export async function handleRevealHttpRequest(request,{
 allowedOrigin,authClient,authorizeDm,createPrivateObject,
 createLinkedMessage,deletePrivateObject,generateObjectPath
}) {
 const origin=request.headers.get("origin");
 if(request.method==="OPTIONS"){
   if(!allowedOrigin||origin!==allowedOrigin)return json(403,{error:"Origin denied"},origin,allowedOrigin);
   return new Response(null,{status:204,headers:{
     "access-control-allow-origin":allowedOrigin,
     "access-control-allow-methods":"POST, OPTIONS",
     "access-control-allow-headers":"authorization, content-type, x-reveal-recipient, x-reveal-mode, x-reveal-seconds, apikey, x-client-info",
     "access-control-max-age":"600","vary":"origin"
   }});
 }
 const invalid=validateUploadRequest(request,{allowedOrigin});
 if(invalid)return json(invalid.status,{error:invalid.error},origin,allowedOrigin);
 const recipientId=request.headers.get("x-reveal-recipient");
 const mode=request.headers.get("x-reveal-mode");
 const secondsHeader=request.headers.get("x-reveal-seconds");
 const seconds=secondsHeader===null?null:Number(secondsHeader);
 if(!recipientId || !["once","timed","keep"].includes(mode) ||
    (mode==="timed" ? ![5,10,15,20].includes(seconds) : secondsHeader!==null))
   return json(400,{error:"Invalid Reveal metadata"},origin,allowedOrigin);
 try{
   const bytes=await readBoundedUploadBody(request);
   const result=await processRevealUploadRequest({
     authorization:request.headers.get("authorization"),authClient,
     recipientId,bytes,claimedType:request.headers.get("content-type"),
     mode,seconds,authorizeDm,createPrivateObject,createLinkedMessage,
     deletePrivateObject,generateObjectPath
   });
   return json(201,result,origin,allowedOrigin);
 }catch(error){
   // Do not leak backend exception messages, object paths or auth tokens.
   const code=error?.message==="Upload too large"?413:403;
   return json(code,{error:code===413?"Upload too large":"Reveal upload unavailable"},origin,allowedOrigin);
 }
}
// RELEASE BLOCKERS: This adapter is not a deployed Edge Function. It requires
// trusted Supabase clients, rate limits, transaction-safe DM+Reveal insertion,
// safe storage writes and error/cleanup monitoring before use.
