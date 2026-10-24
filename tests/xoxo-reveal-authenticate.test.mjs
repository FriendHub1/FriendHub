import test from "node:test";
import assert from "node:assert/strict";
import {authenticateRevealSender} from "../supabase/functions/xoxo-reveal-upload/authenticate.mjs";
const authClient={auth:{getUser:async(token)=>({data:{user:{id:"verified-user"}},error:null})}};
test("derives sender ID from verified Auth user",async()=>{
 const result=await authenticateRevealSender({authorization:"Bearer example.jwt.token",authClient});
 assert.deepEqual(result,{senderId:"verified-user"});
});
test("rejects missing and malformed authorization",async()=>{
 await assert.rejects(authenticateRevealSender({authorization:"",authClient}),/Authentication required/);
 await assert.rejects(authenticateRevealSender({authorization:"Basic abc",authClient}),/Authentication required/);
});
test("rejects invalid token from Auth service",async()=>{
 const bad={auth:{getUser:async()=>({data:{user:null},error:{message:"expired"}})}};
 await assert.rejects(authenticateRevealSender({authorization:"Bearer bad.jwt.token",authClient:bad}),/Invalid authentication/);
});
test("requires trusted Auth verifier",async()=>{
 await assert.rejects(authenticateRevealSender({authorization:"Bearer abc",authClient:{}}),/Trusted Auth client/);
});
