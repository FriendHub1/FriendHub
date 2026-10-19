// XOXO Reveal BETA — authenticated server-side DM authorization.
// REVIEW ONLY / NOT DEPLOYED. Never accept authenticatedSenderId from request body.
import {createRevealDmSendAuthorizer} from './trusted-dm-send-authorization.mjs';

export function createRevealAuthenticatedDmSendAuthorizer({authClient,dbClient}={}){
 if(typeof authClient?.auth?.getUser!=='function')
  throw new TypeError('Trusted authentication client required');
 const verifyPolicy=createRevealDmSendAuthorizer({dbClient});
 return async function authorizeDmSend(input={}){
  if(input===null||typeof input!=='object'||Array.isArray(input))
   throw new TypeError('Invalid DM authorization request');
  const {senderId,recipientId}=input;
  // getUser validates the current token against Auth, unlike getSession's
  // local session cache. The auth client must be bound to this request.
  let user,error;
  try{({data:{user}= {},error}=await authClient.auth.getUser());}
  catch{return false;}
  if(error||typeof user?.id!=='string'||user.id!==senderId)return false;
  return verifyPolicy({senderId,recipientId,authenticatedSenderId:user.id});
 };
}
// Separate database reads are not a transactional send authorization.
// Recheck permissions atomically at final delivery before production.
