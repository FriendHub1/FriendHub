"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
let loggedIn = { id: userA }, peer = userB;
let client = { auth: { getUser: async () => ({ data: {user: loggedIn} }) },
  from: () => ({}), rpc: async () => ({}) };
let visible = true;
const captured = [];
const window = {
  __xoxoCurrentDmMessages: [],
  XOXOSafetyFlowBeta: { create: input => {
    captured.push(input);
    return {openReport: () => true, showReminder: () => true};
  } }
};
const chat = {style:{display:"block"},get isConnected(){return visible;}};
const document = {readyState:"loading",addEventListener:()=>{},
  getElementById: id => id==="dmChat" ? chat : null};

const context = {
  window,document,
  get currentUser(){return loggedIn;},
  get currentDmUserId(){return peer;},
  get supabaseClient(){return client;},
  getFriendHubLanguage:()=> "es"
};
const source=fs.readFileSync(path.join(__dirname,"stay-safe-chat-preview-bridge.js"),"utf8");
vm.runInNewContext(source,context,{filename:"stay-safe-chat-preview-bridge.js"});

assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
assert.equal(captured.length,1);
assert.equal(captured[0].accountId,userA);
assert.equal(captured[0].isContextActive(),true);

// The preview bridge must forward server-provided DM timestamps even if
// its loaded message list arrives newest-first. The picker then chooses the
// newest 100 by date, without making a network request or storing text.
window.__xoxoCurrentDmMessages=[{
  id:"dddddddd-dddd-4ddd-8ddd-000000000002",
  sender_id:userB,recipient_id:userA,content:"newest preview",
  created_at:"2026-10-25T14:10:00Z"
},{
  id:"dddddddd-dddd-4ddd-8ddd-000000000001",
  sender_id:userA,recipient_id:userB,content:"older preview",
  created_at:"2026-10-25T11:10:00Z"
}];
const visibleMessages=window.XOXOSafetyChatPreviewBeta.visibleContext().messages;
assert.equal(visibleMessages.length,2);
assert.deepEqual(Array.from(visibleMessages,m=>m.created_at),
  ["2026-10-25T14:10:00Z","2026-10-25T11:10:00Z"]);
assert.equal(visibleMessages[0].text,"newest preview");
assert.equal(window.XOXOSafetyChatPreviewBeta.reportWritesEnabled(),false);

// Opposite participants reuse the SAME sorted conversation ID but not
// the same signed-in user or localStorage safety acknowledgement.
loggedIn = {id:userB};peer=userA;
assert.equal(captured[0].isContextActive(),false);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
assert.equal(captured.length,2,"new user must receive a new safety flow");
assert.equal(captured[1].accountId,userB);
assert.equal(captured[1].isContextActive(),true);

// New authenticated client/session must also produce a fresh flow.
const otherClient={auth:{getUser:async()=>({data:{user:loggedIn}})},from:()=>({}),rpc:async()=>({})};
client=otherClient;
assert.equal(captured[1].isContextActive(),false);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
assert.equal(captured.length,3,"new client session must create a new safety flow");

// Closing the chat invalidates the account-bound context.
visible=false;
assert.equal(captured[2].isContextActive(),false);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
visible=true;
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
assert.equal(captured.length,4,"reopened chat must not reuse a logged-out cached flow");

assert.equal(window.XOXOSafetyChatPreviewBeta.reportWritesEnabled(),false);
console.log("PASS: account swap, session swap and closed-chat safety flow cache isolation");
