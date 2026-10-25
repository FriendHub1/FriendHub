"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const modules=["stay-safe-report-form.js","stay-safe-evidence-picker.js","stay-safe-sweetheart.js"];
const scripts=modules.map(name=>fs.readFileSync(path.join(__dirname,name),"utf8"));
const locales=["en","es","pt-BR","fr","pl","de","cs","nb"];
class El{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.textContent="";this.value="";this.isConnected=true;}
 append(...children){this.children.push(...children);}
 setAttribute(){}
 addEventListener(){}
 focus(){}
 remove(){this.isConnected=false;}
 querySelector(){return null;}
}
function context(){
 const body=new El("body");body.style.overflow="";
 const document={
  body,head:new El("head"),activeElement:null,
  createElement:tag=>new El(tag),
  createTextNode:text=>({tag:"#text",textContent:text}),
  querySelector:()=>null,addEventListener:()=>{},removeEventListener:()=>{}
 };
 const window={};
 for(const source of scripts)vm.runInNewContext(source,{document,window,localStorage:{getItem:()=>null,setItem:()=>{}}});
 const descend=(root,tag)=>[...(root.tag===tag?[root]:[]),...(root.children||[]).flatMap(c=>descend(c,tag))];
 return {document,window,descend};
}
for(const locale of locales){
 const f=context();
 assert.equal(f.window.XOXOReportFormBeta.open({conversationId:"test-conversation",locale,onContinue:()=>{}}),true,locale);
 const formOverlay=f.document.body.children.at(-1);
 assert.equal(f.descend(formOverlay,"input").filter(x=>x.type==="radio").length,6,"Six reasons required in "+locale);
 const title=f.descend(formOverlay,"h2")[0]?.textContent;
 assert.ok(title && title.includes("🚩"),"Localized report title missing for "+locale);
 const picker=context();
 assert.equal(picker.window.XOXOEvidencePickerBeta.open({
   conversationId:"test-conversation",messages:[{id:"1",text:"Example"}],locale,onContinue:()=>{}
 }),true,locale);
 const evidenceOverlay=picker.document.body.children.at(-1);
 assert.ok(picker.descend(evidenceOverlay,"h2")[0]?.textContent.length>8);
 const reminder=context();
 const key=locale==="nb"?"no":locale;
 assert.ok(reminder.window.XOXOSafetyReminderBeta.copy[key] || reminder.window.XOXOSafetyReminderBeta.copy[locale],
   "Warning missing translation "+locale);
}
console.log("PASS: eight confirmed safety UI languages (including Norwegian nb alias) with six report reasons each");
