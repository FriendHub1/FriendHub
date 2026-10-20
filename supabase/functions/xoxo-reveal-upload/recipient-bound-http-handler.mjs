// XOXO Reveal BETA — recipient-bound HTTP adapter, REVIEW ONLY / NOT DEPLOYED.
// Must NOT be exposed until real sealed writer, rate limits and DB migrations are reviewed.
import {validateUploadRequest,readBoundedUploadBody} from './http-boundary.mjs';
const reply=(status,body,origin,allowedOrigin)=>{
 const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','vary':'origin'};
 if(origin===allowedOrigin)headers['access-control-allow-origin']=allowedOrigin;
 return new Response(JSON.stringify(body),{status,headers});
};
export function createRecipientBoundHttpHandler({allowedOrigin,processRecipientBoundRequest}={}){
 if(typeof processRecipientBoundRequest!=='function')throw new TypeError('Trusted request pipeline required');
 return async function handle(request){
  const origin=request.headers.get('origin');
  if(request.method==='OPTIONS'){
   if(!allowedOrigin||origin!==allowedOrigin)return reply(403,{error:'Origin denied'},origin,allowedOrigin);
   return new Response(null,{status:204,headers:{
    'access-control-allow-origin':allowedOrigin,'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization, content-type, x-reveal-recipient, x-reveal-mode, x-reveal-seconds, x-reveal-request-key, apikey, x-client-info',
    'access-control-max-age':'600','vary':'origin'}});
  }
  const invalid=validateUploadRequest(request,{allowedOrigin});
  if(invalid)return reply(invalid.status,{error:invalid.error},origin,allowedOrigin);
  const recipientId=request.headers.get('x-reveal-recipient');
  const requestKey=request.headers.get('x-reveal-request-key');
  const mode=request.headers.get('x-reveal-mode');
  const secondsHeader=request.headers.get('x-reveal-seconds');
  const seconds=secondsHeader===null?null:Number(secondsHeader);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipientId||'')||
     !/^[A-Za-z0-9_-]{16,128}$/.test(requestKey||'')||
     !['once','timed','keep'].includes(mode)||
     (mode==='timed'?![5,10,15,20].includes(seconds):secondsHeader!==null))
   return reply(400,{error:'Invalid Reveal metadata'},origin,allowedOrigin);
  try{
   const bytes=await readBoundedUploadBody(request);
   const result=await processRecipientBoundRequest({
    authorization:request.headers.get('authorization'),recipientId,requestKey,bytes,
    claimedType:request.headers.get('content-type'),mode,seconds
   });
   if(result?.action==='delivered')return reply(201,{action:'delivered',revealId:result.revealId,dmId:result.dmId},origin,allowedOrigin);
   if(result?.action==='already_delivered')return reply(200,{action:'already_delivered',revealId:result.revealId,dmId:result.dmId},origin,allowedOrigin);
   if(result?.action==='pending')return reply(202,{action:'pending'},origin,allowedOrigin);
   if(result?.action==='rejected')return reply(409,{action:'rejected'},origin,allowedOrigin);
   if(result?.action==='needs_reconciliation')return reply(503,{action:'needs_reconciliation'},origin,allowedOrigin);
   throw new Error('Unexpected delivery state');
  }catch(error){
   const oversized=error?.message==='Upload too large';
   return reply(oversized?413:503,{error:oversized?'Upload too large':'Reveal upload unavailable'},origin,allowedOrigin);
  }
 };
}
