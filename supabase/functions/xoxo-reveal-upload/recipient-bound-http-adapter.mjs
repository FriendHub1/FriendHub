// XOXO Reveal Studio BETA — isolated HTTP-to-pipeline adapter, REVIEW ONLY.
// Not exported by the deployed Edge entrypoint. All dependencies remain server-only.
// Never expose this until writer, quota, anti-abuse and migration reviews pass.
import {validateUploadRequest,readBoundedUploadBody} from './http-boundary.mjs';
import {createRecipientBoundPipeline} from './recipient-bound-pipeline.mjs';

const respond=(status,body,origin,allowedOrigin)=>{
 const headers={'content-type':'application/json','cache-control':'no-store',
  'x-content-type-options':'nosniff','vary':'origin'};
 if(origin===allowedOrigin)headers['access-control-allow-origin']=allowedOrigin;
 return new Response(JSON.stringify(body),{status,headers});
};
export function createRecipientBoundHttpAdapter({allowedOrigin,authClient,rpcClient,prepareSealedUpload,digest}={}){
 const process=createRecipientBoundPipeline({authClient,rpcClient,prepareSealedUpload,digest});
 return async function handle(request){
  const origin=request.headers.get('origin');
  if(request.method==='OPTIONS'){
   if(!allowedOrigin||origin!==allowedOrigin)return respond(403,{error:'Origin denied'},origin,allowedOrigin);
   return new Response(null,{status:204,headers:{
    'access-control-allow-origin':allowedOrigin,'vary':'origin',
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'authorization, content-type, x-reveal-recipient, x-reveal-mode, x-reveal-seconds, x-reveal-request-key',
    'access-control-max-age':'600'
   }});
  }
  const invalid=validateUploadRequest(request,{allowedOrigin});
  if(invalid)return respond(invalid.status,{error:invalid.error},origin,allowedOrigin);
  const recipientId=request.headers.get('x-reveal-recipient');
  const requestKey=request.headers.get('x-reveal-request-key');
  const mode=request.headers.get('x-reveal-mode');
  const durationHeader=request.headers.get('x-reveal-seconds');
  const seconds=durationHeader===null?null:Number(durationHeader);
  if(!/^[0-9a-f-]{36}$/i.test(recipientId||'')||
     !/^[A-Za-z0-9_-]{16,128}$/.test(requestKey||'')||
     !['once','timed','keep'].includes(mode)||
     (mode==='timed'?![5,10,15,20].includes(seconds):durationHeader!==null))
   return respond(400,{error:'Invalid Reveal metadata'},origin,allowedOrigin);
  try{
   const bytes=await readBoundedUploadBody(request);
   const result=await process({authorization:request.headers.get('authorization'),
    recipientId,requestKey,bytes,claimedType:request.headers.get('content-type'),mode,seconds});
   const status=result.action==='delivered'?201:result.action==='already_delivered'?200:
    result.action==='pending'?202:result.action==='needs_reconciliation'?409:403;
   return respond(status,result,origin,allowedOrigin);
  }catch(error){
   const large=error?.message==='Upload too large';
   return respond(large?413:403,{error:large?'Upload too large':'Reveal upload unavailable'},origin,allowedOrigin);
  }
 };
}
