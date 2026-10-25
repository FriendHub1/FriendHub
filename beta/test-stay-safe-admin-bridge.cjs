"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.style={};this.disabled=false;this.textContent="";}
 append(...nodes){this.children.push(...nodes);}
 appendChild(node){this.children.push(node);return node;}
 replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(key,value){this[key]=value;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 querySelector(selector){return selector==="[data-xoxo-safety-admin-beta]"?this.children.find(e=>Object.prototype.hasOwnProperty.call(e.dataset,"xoxoSafetyAdminBeta"))||null:null;}
 remove(){this.removed=true;}
 async click(){if(this.listeners.click)return this.listeners.click();}
 find(label){if(this.textContent===label)return this;for(const c of this.children){const r=c.find?.(label);if(r)return r;}return null;}
 allText(){return [this.textContent,...this.children.map(c=>c.allText?.()||"")].join(" ");}
}
const script=fs.readFileSync(path.join(__dirname,"stay-safe-admin-bridge.js"),"utf8");
function setup(enabled=true){
 const window={XOXO_SAFETY_BETA_ENABLED:enabled,confirm:()=>true};
 const document={createElement:tag=>new Element(tag)};
 vm.runInNewContext(script,{window,document,console});
 return {bridge:window.XOXOSafetyAdminBridge,window,list:new Element("div")};
}
const reporter="44444444-4444-4444-8444-444444444444";
const other="33333333-3333-4333-8333-333333333333";
const id="11111111-1111-4111-8111-111111111111";
const msg="22222222-2222-4222-8222-222222222222";
const row={id,reporter_id:reporter,reported_user_id:other,reason_code:0,message_ids:[msg],status:"pending",details:"Report",created_at:"2026-10-25T00:00:00Z"};
(async()=>{
 const off=setup(false);
 assert.equal(await off.bridge.mount({list:off.list}),false);
 assert.equal(off.list.children.length,0);
 const {bridge,list}=setup();
 let pin=0,view=0,updates=0,queries=0,seenPair=[];
 const client={rpc:async(name,args)=>{
   queries++;
   if(name==="xoxo_admin_list_conversation_reports_beta")return {data:[row],error:null};
   assert.equal(name,"xoxo_admin_update_conversation_report_beta");
   assert.equal(args.p_report_id,id);
   assert.equal(args.p_status,"reviewed");updates++;
   return {data:true,error:null};
 }};
 assert.equal(await bridge.mount({
   client,list,isAdmin:()=>true,authorize:async()=>{pin++;return {reason:"Moderation review reason"};},
   getName:id=>"User "+id.slice(0,4),formatDate:()=> "Today",
   onOpen:async(...ids)=>{view++;seenPair=ids;return true;},locale:"es"
 }),true);
 assert.equal(queries,0,"No report metadata request before PIN");
 const section=list.children[0];
 assert.ok(section.find("🔐 Verificar PIN de moderación"));
 await section.find("🔐 Verificar PIN de moderación").click();
 assert.equal(pin,1);
 assert.equal(queries,1);
 assert.match(section.allText(),/Denuncia enviada por/);
 assert.doesNotMatch(section.allText(),/secret message content/i);
 await section.find("Abrir en el visor actual de conversaciones").click();
 assert.equal(view,1);
 assert.deepEqual(seenPair,[reporter,other]);
 await section.find("Revisada").click();
 assert.equal(updates,1);
 assert.equal(queries,3);
 assert.equal(bridge.isValidRow({...row,message_ids:[]}),false);
 assert.equal(bridge.isValidRow({...row,reporter_id:"fake"}),false);
 console.log("PASS: admin bridge opt-in, PIN gating, metadata-only list, existing viewer delegation, status update");
})().catch(e=>{console.error(e);process.exitCode=1});
