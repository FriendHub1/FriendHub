// XOXO Reveal BETA — privileged admin lookup adapter.
// REVIEW ONLY / NOT DEPLOYED. Requires reviewed server-only SQL RPC.
export function createRevealReconciliationAdminLookup({rpcClient}={}){
 if(typeof rpcClient?.rpc!=='function')throw new TypeError('Trusted service RPC client required');
 return async function adminLookup({userId}={}){
  if(!userId)return false;
  try{
   const {data,error}=await rpcClient.rpc('xoxo_reveal_is_reconciliation_admin_v1',{p_user_id:userId});
   return !error&&data===true;
  }catch{return false;}
 };
}
