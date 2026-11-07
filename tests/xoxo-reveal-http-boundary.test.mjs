import test from "node:test";
import assert from "node:assert/strict";
import {validateUploadRequest,readBoundedUploadBody,MAX_UPLOAD_BODY_BYTES} from "../supabase/functions/xoxo-reveal-upload/http-boundary.mjs";
const origin="https://www.xoxoavenue.com";
function request(body="abc",headers={}){
 return new Request("https://example.test/upload",{method:"POST",headers:{
  origin,"content-type":"image/webp",authorization:"Bearer test",...headers},body});
}
test("accepts bounded supported upload request",()=>{
 assert.equal(validateUploadRequest(request(),{allowedOrigin:origin}),null);
});
test("rejects unauthorized origins and unsupported MIME",()=>{
 assert.equal(validateUploadRequest(request("abc",{origin:"https://evil.example"}),{allowedOrigin:origin}).status,403);
 assert.equal(validateUploadRequest(request("abc",{"content-type":"text/plain"}),{allowedOrigin:origin}).status,415);
});
test("rejects declared oversized payload before reading",()=>{
 const req=request("abc",{"content-length":String(MAX_UPLOAD_BODY_BYTES+1)});
 assert.equal(validateUploadRequest(req,{allowedOrigin:origin}).status,413);
});
test("reads bounded bytes and rejects streaming overrun",async()=>{
 const ok=await readBoundedUploadBody(request("hello"),{maxBytes:5});
 assert.equal(new TextDecoder().decode(ok),"hello");
 await assert.rejects(readBoundedUploadBody(request("toolarge"),{maxBytes:3}),/too large/);
});
