"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
let loggedIn = { id: userA }, peer = userB;
let authEvent=null,readyHandler=null;
let client = { auth: {
    getUser: async () => ({ data: {user: loggedIn} }),
    onAuthStateChange: cb => {
      authEvent=cb;
      return {data:{subscription:{unsubscribe(){}}}};
    }
  },from: () => ({}), rpc: async () => ({}) };
let visible = true;
const captured = [], disposed = [];
const window = {
  __xoxoCurrentDmMessages: [],
  XOXOSafetyFlowBeta: { create: input => {
    captured.push(input);
    const flowIndex=captured.length-1;
    return {openReport: () => true, showReminder: () => true,
      dispose:()=>{disposed.push(flowIndex);return true;}};
  } }
};
const chat = {style:{display:"block"},get isConnected(){return visible;},
  querySelector:()=>null};
const document = {readyState:"loading",
  addEventListener:(event,cb)=>{if(event==="DOMContentLoaded")readyHandler=cb;},
  getElementById:id=>id==="dmChat"?chat:null,
  querySelector:()=>null};

const context = {
  window,document,
  get currentUser(){return loggedIn;},
  get currentDmUserId(){return peer;},
  get supabaseClient(){return client;},
  getFriendHubLanguage:()=> "es"
};
const source=fs.readFileSync(path.join(__dirname,"stay-safe-chat-preview-bridge.js"),"utf8");
vm.runInNewContext(source,context,{filename:"stay-safe-chat-preview-bridge.js"});

// A stale local currentUser must not expose private reporting before
// Supabase has confirmed INITIAL_SESSION, including an explicit null session.
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
assert.equal(captured.length,0);
readyHandler();
assert.equal(typeof authEvent,"function");
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
authEvent("INITIAL_SESSION",null);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
assert.equal(captured.length,0);
authEvent("INITIAL_SESSION",{user:loggedIn});
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
authEvent("SIGNED_IN",{user:loggedIn});
assert.equal(captured[0].isContextActive(),false);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
assert.equal(captured.length,2,"new user must receive a new safety flow");
assert.deepEqual(disposed,[0],"Changing accounts must dismiss the OLD flow");
assert.equal(captured[1].accountId,userB);
assert.equal(captured[1].isContextActive(),true);

// New authenticated client/session must also produce a fresh flow.
const otherClient={auth:{getUser:async()=>({data:{user:loggedIn}})},from:()=>({}),rpc:async()=>({})};
client=otherClient;
assert.equal(captured[1].isContextActive(),false);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
assert.equal(captured.length,3,"new client session must create a new safety flow");
assert.deepEqual(disposed,[0,1],"Changing auth clients must dismiss old dialog ownership");

// Closing the chat invalidates the account-bound context.
visible=false;
assert.equal(captured[2].isContextActive(),false);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
assert.deepEqual(disposed,[0,1,2],"Closing DM chat must dismiss sensitive dialogs");
visible=true;
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
assert.equal(captured.length,4,"reopened chat must not reuse a logged-out cached flow");

// A peer switch without any account change also closes old report UI.
peer="33333333-3333-4333-8333-333333333333";
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
assert.equal(captured.length,5);
assert.deepEqual(disposed,[0,1,2,3],
  "Chat changes must dispose previous report/picker UI without touching next flow");

assert.equal(window.XOXOSafetyChatPreviewBeta.reportWritesEnabled(),false);

// Null refresh/sign-out events must invalidate any remaining cached flow,
// even if the SPA still exposes currentUser and rendered DM messages.
authEvent("TOKEN_REFRESHED",null);
assert.equal(window.XOXOSafetyChatPreviewBeta.visibleContext(),null);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
// Anonymous Auth sign-ins have authenticated SQL roles, but are not members.
authEvent("SIGNED_IN",{user:{id:userB,is_anonymous:true}});
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
// A valid recovered session must still match the SPA's CURRENT account.
authEvent("SIGNED_IN",{user:{id:userA}});
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
authEvent("TOKEN_REFRESHED",{user:{id:userB}});
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),true);
const beforeLogout=captured.length;
authEvent("SIGNED_OUT",null);
assert.equal(window.XOXOSafetyChatPreviewBeta.openReport(),false);
assert.equal(captured.length,beforeLogout,
  "A stale SPA account must not resurrect report controls after logout");
console.log("PASS: initial null Auth, sign-in, anonymous, token refresh, cross-account and signed-out preview privacy");
