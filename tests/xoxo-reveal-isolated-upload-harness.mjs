// XOXO Reveal BETA — fully in-memory, isolated upload integration harness.
// NO network, credentials, Supabase project, database writes or deployments.
import {processQuotaProtectedRevealUpload} from "../supabase/functions/xoxo-reveal-upload/quota-guard.mjs";

export function createIsolatedRevealUploadHarness({
  accepted=true,failLink=false,failStorage=false,quotaAllowed=true
}={}){
 const calls=[],objects=new Map(),messages=[],reservations=new Map();
 const senderId="sender-test",recipientId="recipient-test";
 const deps={
  authorization:"Bearer isolated.mock.token",
  authClient:{auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}},
  recipientId,claimedType:"image/webp",mode:"once",seconds:null,
  reserveQuota:async({senderId:verified,bytes})=>{
   calls.push("reserve");
   if(verified!==senderId||!quotaAllowed)return {allowed:false};
   const id="reservation-"+(reservations.size+1);
   reservations.set(id,{bytes,released:false});
   return {allowed:true,id};
  },
  releaseQuota:async({reservationId})=>{
   calls.push("refund");
   const row=reservations.get(reservationId);
   if(!row)throw new Error("Unknown reservation");
   row.released=true;
  },
  authorizeDm:async()=>{calls.push("authorize");return accepted;},
  generateObjectPath:()=>{calls.push("path");return "isolated/test-"+(objects.size+1)+".webp";},
  createPrivateObject:async({objectPath,bytes})=>{
   calls.push("store");
   if(failStorage)throw new Error("Simulated storage failure");
   objects.set(objectPath,new Uint8Array(bytes));
  },
  createLinkedMessage:async({objectPath})=>{
   calls.push("link");
   if(failLink)throw new Error("Simulated link failure");
   const record={revealId:"reveal-"+(messages.length+1),dmId:"dm-"+(messages.length+1),objectPath};
   messages.push(record);
   return record;
  },
  deletePrivateObject:async({objectPath})=>{calls.push("rollback");objects.delete(objectPath);}
 };
 return {
  calls,objects,messages,reservations,
  upload:bytes=>processQuotaProtectedRevealUpload({...deps,bytes})
 };
}
