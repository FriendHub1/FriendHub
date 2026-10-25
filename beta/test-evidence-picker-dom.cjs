"use strict";
// Tests the REAL standalone evidence-picker module with a small DOM fake.
// No Supabase access, no live messages, no browser automation service.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"stay-safe-evidence-picker.js"),"utf8");

assert.equal((source.match(/(?:^|\n)sv:/g)||[]).length,1,
  "Swedish translation must not be duplicated");
assert.equal((source.match(/(?:^|\n)it:/g)||[]).length,1,
  "Italian translation must not be duplicated");

function createDOM(){
  const listeners={};
  const document={};
  class Element {
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={cssText:""};this.dataset={};this.attributes={};this.events={};this.textContent="";this.checked=false;this.disabled=false;this.parent=null;}
    setAttribute(key,value){this.attributes[key]=value;}
    addEventListener(key,handler){this.events[key]=handler;}
    append(...nodes){for(const item of nodes){item.parent=this;this.children.push(item);}}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
    focus(){document.activeElement=this;}
  }
  document.body=new Element("body");
  document.body.style={overflow:""};
  document.activeElement=null;
  document.createElement=tag=>new Element(tag);
  document.querySelector=selector=>selector==="[data-xoxo-evidence-beta]"?
    document.body.children.find(el=>Object.hasOwn(el.dataset,"xoxoEvidenceBeta"))||null:null;
  document.addEventListener=(event,cb)=>{listeners[event]=cb;};
  document.removeEventListener=(event,cb)=>{if(listeners[event]===cb)delete listeners[event];};
  const root={};
  vm.runInNewContext(source,{window:root,document},{filename:"stay-safe-evidence-picker.js"});
  function find(rootNode,predicate){
    const result=[];function visit(n){if(predicate(n))result.push(n);for(const child of n.children)visit(child);}visit(rootNode);return result;
  }
  return {document,api:root.XOXOEvidencePickerBeta,find};
}
const uuid=i=>"22222222-2222-4222-8222-"+i.toString(16).padStart(12,"0");
const messages=Array.from({length:120},(_,i)=>({id:uuid(i+1),text:"Message "+(i+1)}));
const selected=[];
let h=createDOM();
assert.equal(h.api.open({conversationId:"test",messages,locale:"sv",onContinue:args=>selected.push(args)}),true);
let picks=h.find(h.document.body,n=>n.tagName==="INPUT"&&n.type==="checkbox");
assert.equal(picks.length,100,"present latest 100 messages");
assert.equal(picks[0].value,uuid(21));
assert.equal(picks.at(-1).value,uuid(120));
assert.ok(h.find(h.document.body,n=>n.tagName==="BUTTON").some(n=>n.textContent==="Skicka anmälan"));
for(let i=0;i<20;i++)picks[i].checked=true;
picks[20].checked=true;
picks[20].events.change();
assert.equal(picks[20].checked,false,"the 21st evidence item must be rejected");
const buttons=h.find(h.document.body,n=>n.tagName==="BUTTON");
buttons[0].onclick();
assert.equal(selected.length,1);
assert.equal(selected[0].messageIds.length,20);
assert.equal(h.document.body.children.length,0,"picker closes after selection");

h=createDOM();
assert.equal(h.api.open({
  conversationId:"case-dupes",
  messages:[{id:uuid(1).toUpperCase(),text:"same"},{id:uuid(1),text:"duplicate"},{id:uuid(2),text:"second"}],
  locale:"it",onContinue:()=>{}
}),true);
picks=h.find(h.document.body,n=>n.tagName==="INPUT"&&n.type==="checkbox");
assert.equal(picks.length,2,"case-variant UUID duplicates must not create extra choices");
assert.ok(h.find(h.document.body,n=>n.tagName==="BUTTON").some(n=>n.textContent==="Invia segnalazione"));

console.log("PASS: latest 100 evidence messages, max 20 selected, unique IDs, Swedish/Italian text");
