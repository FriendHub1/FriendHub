"use strict";
// Standalone safety BETA cursor adapter regression; no external services.
const assert=require("node:assert/strict");
const {loadMoreReports,cursorAfter}=require("./admin-report-queue.js");

const uuid=i=>"dddddddd-dddd-4ddd-8ddd-"+i.toString(16).padStart(12,"0");
const reporter="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const reason="Investigating reported conversations with authorization";
const date="2026-10-25T10:00:00Z";
const record=(i,status="pending")=>({
  id:uuid(i),reporter_id:reporter,reported_user_id:peer,reason_code:1,
  details:"Fictional report "+i,message_ids:[uuid(700+i)],
  status,created_at:date
});
const prior=record(1);
const cursor=cursorAfter(prior);
assert.deepEqual(cursor,{pending:true,created_at:date,id:uuid(1)});
assert.equal(cursorAfter({...prior,created_at:"no date"}),null);

(async()=>{
 const rows=Array.from({length:50},(_,i)=>record(i+2,i<20?"pending":"resolved"));
 const last=rows.at(-1);
 const returnedCursor={pending:false,created_at:last.created_at,id:last.id};
 const invocations=[];
 const client={rpc:async(name,args)=>{
   invocations.push({name,args});
   return {data:{reports:rows,has_more:true,next_cursor:returnedCursor},error:null};
 }};
 const result=await loadMoreReports(client,{moderationReason:reason,cursor});
 assert.equal(result.ok,true);
 assert.equal(result.reports.length,50);
 assert.equal(result.reports[0].source,"conversation_beta");
 assert.equal(result.hasMore,true);
 assert.deepEqual(result.nextCursor,returnedCursor);
 assert.equal(invocations[0].name,"xoxo_admin_page_conversation_reports_beta");
 assert.deepEqual(invocations[0].args,{
   p_reason:reason,p_after_pending:true,p_after_created_at:date,
   p_after_id:uuid(1),p_limit:50
 });

 const badInputs=[
   {cursor:null},
   {cursor:{...cursor,pending:"true"}},
   {cursor:{...cursor,id:"not-uuid"}},
   {cursor:{...cursor,created_at:"impossible"}},
   {cursor,limit:51},
   {cursor,limit:0},
   {cursor,moderationReason:"short"}
 ];
 for(const x of badInputs){
   let called=0;
   const response=await loadMoreReports({rpc:async()=>{called++;return {data:{}}}},
     {moderationReason:reason,...x});
   assert.equal(response.ok,false);
   assert.equal(called,0,"invalid cursor/page must not call backend");
 }

 for(const [title,page] of [
   ["oversized page",{reports:rows.concat(record(99)),has_more:false,next_cursor:null}],
   ["duplicate ID",{reports:[rows[0],rows[0]],has_more:false,next_cursor:null}],
   ["bad ID",{reports:[{...rows[0],id:"malformed"}],has_more:false,next_cursor:null}],
   ["missing status",{reports:[{...rows[0],status:"unknown"}],has_more:false,next_cursor:null}],
   ["missing next cursor",{reports:rows,has_more:true,next_cursor:null}],
   ["wrong next id",{reports:rows,has_more:true,next_cursor:{...returnedCursor,id:uuid(888)}}],
   ["wrong priority",{reports:rows,has_more:true,next_cursor:{...returnedCursor,pending:true}}],
   ["wrong time",{reports:rows,has_more:true,next_cursor:{...returnedCursor,created_at:"2026-10-23T00:00:00Z"}}],
   ["unexpected cursor on last page",{reports:rows,has_more:false,next_cursor:returnedCursor}],
   ["invalid has_more",{reports:rows,has_more:"yes",next_cursor:null}]
 ]){
   const response=await loadMoreReports({rpc:async()=>({data:page})},
     {moderationReason:reason,cursor});
   assert.equal(response.ok,false,title+" must fail closed");
 }
 const lastPage=await loadMoreReports({rpc:async()=>({
   data:{reports:[record(95,"resolved")],has_more:false,next_cursor:null}
 })},{moderationReason:reason,cursor});
 assert.equal(lastPage.ok,true);
 assert.equal(lastPage.hasMore,false);
 assert.equal(lastPage.nextCursor,null);

 const rejected=await loadMoreReports({rpc:async()=>({error:{code:"42501"}})},
   {moderationReason:reason,cursor});
 assert.equal(rejected.ok,false);
 console.log("PASS: 22 pagination adapter cases, invalid responses, secure cursor forwarding");
})().catch(e=>{console.error(e);process.exitCode=1});
