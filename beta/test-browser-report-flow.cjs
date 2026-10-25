"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const adapter = require("./stay-safe-browser-report-adapter.js");

const user = "44444444-4444-4444-8444-444444444444";
const peer = "33333333-3333-4333-8333-333333333333";
const outsider = "55555555-5555-4555-8555-555555555555";
const id1 = "22222222-2222-4222-8222-222222222221";
const id2 = "22222222-2222-4222-8222-222222222222";
const key = "11111111-1111-4111-8111-111111111111";
const reportId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { accountId: user, otherUserId: peer, reasonCode: 1,
  details: "Threats", messageIds: [id1], idempotencyKey: key };

function clientWith({ rows = [{ id: id1, sender_id: peer, recipient_id: user }],
                      authId = user, rpcData = reportId, rpcError = null } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => {
      calls.push("auth");
      return { data: { user: authId ? { id: authId } : null }, error: null };
    } },
    from: table => {
      assert.equal(table, "direct_messages");
      return { select: fields => {
        assert.equal(fields, "id,sender_id,recipient_id");
        return { in: async (field, ids) => {
          assert.equal(field, "id");
          calls.push("evidence");
          return { data: rows.filter(row => ids.includes(row.id)), error: null };
        } };
      } };
    },
    rpc: async (name, params) => {
      calls.push("rpc");
      assert.equal(name, "xoxo_submit_conversation_report_beta");
      assert.equal(params.p_other_user_id, peer);
      assert.equal(params.p_reason_code, 1);
      assert.equal(params.p_idempotency_key, key);
      return { data: rpcData, error: rpcError };
    }
  };
  return { client, calls };
}

async function testAdapter() {
  let test = clientWith();
  assert.deepEqual(await adapter.submit(test.client, input), { ok: true, reportId });
  assert.deepEqual(test.calls, ["auth", "evidence", "auth", "rpc", "auth"]);

  // The same explicitly selected evidence IDs, clicked in different orders,
  // must reach Supabase in ONE deterministic UUID order for idempotent retry.
  const canonical=clientWith({rows:[
    {id:id1,sender_id:peer,recipient_id:user},
    {id:id2,sender_id:user,recipient_id:peer}
  ]});
  const actualRpcIds=[];
  canonical.client.rpc=async (_name,params)=>{
    actualRpcIds.push(params.p_message_ids);
    return {data:reportId,error:null};
  };
  for(const evidenceOrder of [[id2,id1],[id1,id2]]){
    const response=await adapter.submit(canonical.client,{
      ...input,messageIds:evidenceOrder
    });
    assert.deepEqual(response,{ok:true,reportId});
  }
  assert.deepEqual(actualRpcIds,[[id1,id2],[id1,id2]],
    "Reordering the same evidence must not change the RPC payload");

  test = clientWith({ authId: null });
  assert.equal((await adapter.submit(test.client, input)).reason, "authentication_failed");
  assert.deepEqual(test.calls, ["auth"]);

  test = clientWith({ authId: outsider });
  assert.equal((await adapter.submit(test.client, input)).reason, "wrong_account");
  assert.deepEqual(test.calls, ["auth"]);

  test = clientWith({ rows: [] });
  assert.equal((await adapter.submit(test.client, input)).reason, "evidence_not_authorized");
  assert.deepEqual(test.calls, ["auth", "evidence"]);

  test = clientWith({ rows: [{ id: id1, sender_id: outsider, recipient_id: peer }] });
  assert.equal((await adapter.submit(test.client, input)).reason, "evidence_not_authorized");
  assert.deepEqual(test.calls, ["auth", "evidence"]);

  test = clientWith({ rpcError: { message: "not deployed" }, rpcData: null });
  assert.equal((await adapter.submit(test.client, input)).reason, "submission_failed");
  assert.deepEqual(test.calls, ["auth", "evidence", "auth", "rpc"]);

  test = clientWith();
  assert.equal((await adapter.submit(test.client, { ...input, messageIds: [id1, id1] })).reason, "invalid_input");
  assert.deepEqual(test.calls, []);

  test = clientWith();
  assert.equal((await adapter.submit(test.client, { ...input, reasonCode: 7 })).reason, "invalid_input");
  assert.deepEqual(test.calls, []);

  // An anonymous Supabase Auth member is also technically authenticated,
  // but must not reach our report RPC.
  let rpcCount = 0;
  let changingUser = user;
  let releaseEvidence;
  const changingClient = {
    auth: { getUser: async () => ({
      data: { user: { id: changingUser } }, error: null
    }) },
    from: () => ({ select: () => ({ in: () => new Promise(resolve => {
      releaseEvidence = resolve;
    }) }) }),
    rpc: async () => { rpcCount++; return { data: reportId }; }
  };
  const pendingEvidence = adapter.submit(changingClient, input);
  for (let i = 0; i < 8 && !releaseEvidence; i++) await new Promise(r => setImmediate(r));
  assert.equal(typeof releaseEvidence, "function");
  changingUser = outsider; // auth swapped while evidence query was pending
  releaseEvidence({data:[{id:id1,sender_id:peer,recipient_id:user}],error:null});
  assert.equal((await pendingEvidence).reason,"wrong_account");
  assert.equal(rpcCount,0,"Old evidence query must never submit from new account");

  // If an RPC was already sent, a later logout must not show an old user's
  // successful report ID inside the newly authenticated account's UI.
  changingUser = user;
  let releaseRpc;
  changingClient.from=()=>({select:()=>({in:async()=>({
    data:[{id:id1,sender_id:peer,recipient_id:user}],error:null
  })})});
  changingClient.rpc=()=>new Promise(resolve => { releaseRpc=resolve; });
  const pendingReceipt=adapter.submit(changingClient,input);
  for(let i=0;i<8 && !releaseRpc;i++)await new Promise(r=>setImmediate(r));
  assert.equal(typeof releaseRpc,"function");
  changingUser=outsider;
  releaseRpc({data:reportId,error:null});
  assert.equal((await pendingReceipt).reason,"wrong_account",
    "Successful old-account report receipt must not appear after account swap");

  const anonymousClient=clientWith().client;
  anonymousClient.auth.getUser=async()=>({
    data:{user:{id:user,is_anonymous:true}},error:null
  });
  assert.equal((await adapter.submit(anonymousClient,input)).reason,
    "authentication_failed","Anonymous Auth sessions cannot submit reports");
}

function browserHarness({ enabled = true, rows, submit, getMessages: overrideMessages, isContextActive } = {}) {
  const status = [];
  const ui = { form: null, picker: null, reminder: null, calls: 0,
    formDismissed:false, pickerDismissed:false };
  const root = {
    crypto: { randomUUID: () => key },
    XOXOReportSubmitBrowserBeta: { submit: submit || adapter.submit },
    XOXOReportFormBeta: {
      open: args => { ui.form = args; ui.formDismissed=false; return true; },
      dismiss: owner => {if(ui.form?.owner!==owner)return false;ui.formDismissed=true;return true;}
    },
    XOXOEvidencePickerBeta: {
      open: args => { ui.picker = args; ui.pickerDismissed=false;return true; },
      dismiss: owner => {if(ui.picker?.owner!==owner)return false;ui.pickerDismissed=true;return true;}
    },
    XOXOSafetyReminderBeta: { show: args => { ui.reminder = args; return true; } }
  };
  const source = fs.readFileSync(path.join(__dirname, "stay-safe-browser-flow.js"), "utf8");
  const ctx = vm.createContext({ window: root });
  vm.runInContext(source, ctx, { filename: "stay-safe-browser-flow.js" });
  const { client, calls } = clientWith({ rows: rows || [{ id: id1, sender_id: peer, recipient_id: user }] });
  const flow = root.XOXOSafetyFlowBeta.create({
    client, accountId: user, otherUserId: peer, conversationId: "conversation-1",
    locale: "es", enabled, isContextActive,
    getMessages: overrideMessages || (() => [
      { id: id1, sender_id: peer, recipient_id: user, content: "Please review" },
      { id: id2, sender_id: user, recipient_id: peer, text: "A response" },
      { id: "99999999-9999-4999-8999-999999999999", sender_id: outsider, recipient_id: peer, text: "Different chat" }
    ]), onStatus: result => status.push(result)
  });
  return { flow, ui, status, calls };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

async function testFlow() {
  const h = browserHarness();
  assert.equal(h.flow.showReminder(), true);
  assert.equal(h.ui.reminder.conversationId, "conversation-1");
  h.ui.reminder.onReport();
  assert.equal(h.ui.form.locale, "es");
  h.ui.form.onContinue({ conversationId: "conversation-1", reasonCode: 1, details: "Threats" });
  await flush();
  assert.equal(h.ui.picker.messages.length, 2, "must exclude messages from other chats");

  // Authenticated chat normalization must carry date metadata into the UI.
  // The picker relies on these dates when the host returns newest-first rows.
  const dated=browserHarness({getMessages:()=>[
    {id:id2,sender_id:user,recipient_id:peer,content:"newer",
      created_at:"2026-10-25T13:00:00Z"},
    {id:id1,sender_id:peer,recipient_id:user,content:"older",
      created_at:"2026-10-24T13:00:00Z"}
  ]});
  dated.flow.openReport();
  dated.ui.form.onContinue({conversationId:"conversation-1",reasonCode:1,details:"Threats"});
  await flush();
  assert.equal(dated.ui.picker.messages[0].created_at,"2026-10-25T13:00:00Z");
  assert.equal(dated.ui.picker.messages[1].created_at,"2026-10-24T13:00:00Z");
  assert.equal(dated.calls.length,0,
    "Showing dated evidence choices must not send a report");
  h.ui.picker.onContinue({ conversationId: "conversation-1", messageIds: [id1] });
  await flush();
  assert.equal(h.status.length, 1);
  assert.equal(h.status[0].ok, true);
  assert.equal(h.status[0].reportId, reportId);

  const disabled = browserHarness({ enabled: false });
  assert.equal(disabled.flow.showReminder(), true);
  assert.equal(typeof disabled.ui.reminder.onReport, "undefined",
    "disabled feature must not show a report button");
  assert.equal(disabled.flow.openReport(), false,
    "disabled feature must not open an unsendable form");
  assert.equal(disabled.ui.form, null);
  assert.equal(disabled.status[0].reason, "disabled");
  assert.deepEqual(disabled.calls, [], "feature flag must prevent auth and RPC calls");

  const rejected = browserHarness();
  rejected.flow.openReport();
  rejected.ui.form.onContinue({ conversationId: "conversation-1", reasonCode: 1, details: "Threats" });
  await flush();
  rejected.ui.picker.onContinue({ conversationId: "conversation-1", messageIds: [outsider] });
  await flush();
  assert.equal(rejected.status[0].reason, "invalid_evidence");
  assert.deepEqual(rejected.calls, []);

  let active = true;
  const stale = browserHarness({
    getMessages: () => active ? [{ id: id1, sender_id: peer, recipient_id: user,
      content: "Message in currently open chat" }] : [],
    isContextActive: () => active
  });
  stale.flow.openReport();
  stale.ui.form.onContinue({ conversationId: "conversation-1", reasonCode: 1, details: "Threats" });
  await flush();
  assert.equal(stale.ui.picker.messages.length, 1);
  active = false; // user navigated away between picking and submission
  stale.ui.picker.onContinue({ conversationId: "conversation-1", messageIds: [id1] });
  await flush();
  assert.equal(stale.status.length, 0,
    "stale chat must not alert a newly opened account or conversation");
  assert.deepEqual(stale.calls, [], "no account or evidence access after chat changes");
  assert.equal(stale.flow.openReport(),false,
    "detached flow must not open a report form for the new chat");
  assert.equal(stale.flow.showReminder(),false,
    "detached flow must not show an old safety reminder");

  let attempts = 0;
  const keys = [];
  const retry = browserHarness({ submit: async (client, args) => {
    keys.push(args.idempotencyKey);
    attempts += 1;
    return attempts === 1 ? { ok: false, reason: "submission_failed" } :
      { ok: true, reportId };
  } });
  for (let i = 0; i < 2; i++) {
    retry.flow.openReport();
    retry.ui.form.onContinue({ conversationId: "conversation-1", reasonCode: 1, details: "Threats" });
    await flush();
    retry.ui.picker.onContinue({ conversationId: "conversation-1", messageIds: [id1] });
    await flush();
  }
  assert.equal(retry.status[0].ok, false);
  assert.equal(retry.status[1].ok, true);
  assert.deepEqual(keys, [key, key], "identical failed submissions must reuse idempotency key");

  // An async getMessages call may complete after the user switched chats.
  // Its obsolete evidence picker must never open in the NEW conversation.
  let pickerActive=true,releaseMessages;
  const waitingPicker=browserHarness({
    isContextActive:()=>pickerActive,
    getMessages:()=>new Promise(resolve=>{releaseMessages=resolve;})
  });
  waitingPicker.flow.openReport();
  waitingPicker.ui.form.onContinue({conversationId:"conversation-1",reasonCode:1,details:"Threats"});
  await flush();
  pickerActive=false;
  releaseMessages([{id:id1,sender_id:peer,recipient_id:user,content:"A message"}]);
  await flush();
  assert.equal(waitingPicker.ui.picker,null,
    "Old async messages must not open evidence picker after chat switch");
  assert.equal(waitingPicker.status.length,0,
    "Old flow cannot display stale status in new account");

  // A report RPC may finish after logout, including successfully. The old
  // result must not be displayed in the newly signed-in user's UI.
  let receiptActive=true,resolveReceipt,submitted=0;
  const delayedReceipt=browserHarness({
    isContextActive:()=>receiptActive,
    submit:()=>{submitted++;return new Promise(resolve=>{resolveReceipt=resolve})}
  });
  delayedReceipt.flow.openReport();
  delayedReceipt.ui.form.onContinue({conversationId:"conversation-1",reasonCode:1,details:"Threats"});
  await flush();
  delayedReceipt.ui.picker.onContinue({conversationId:"conversation-1",messageIds:[id1]});
  await flush();
  assert.equal(submitted,1);
  receiptActive=false;
  resolveReceipt({ok:true,reportId});
  await flush();
  assert.equal(delayedReceipt.status.length,0,
    "Old successful receipt must not be displayed after account switch");

  // Old forms/pickers in the SAME conversation must not submit after a
  // newer form opens. Context checks alone cannot catch this scenario.
  let attemptSubmissions=0;
  const superseded=browserHarness({submit:async()=>{
    attemptSubmissions++;
    return {ok:true,reportId};
  }});
  const submitData={conversationId:"conversation-1",reasonCode:1,details:"Threats"};
  const selectionData={conversationId:"conversation-1",messageIds:[id1]};
  superseded.flow.openReport();
  const oldForm=superseded.ui.form;
  oldForm.onContinue(submitData);
  await flush();
  const oldPicker=superseded.ui.picker;
  assert.ok(oldPicker);
  superseded.flow.openReport();
  assert.notEqual(superseded.ui.form,oldForm);
  oldForm.onContinue(submitData);
  oldPicker.onContinue(selectionData);
  await flush();
  assert.equal(attemptSubmissions,0,
    "Detached form/picker must never submit with old reasons or evidence");
  assert.equal(superseded.status.length,0,
    "Stale callbacks should not alert over newer reporting flow");
  assert.equal(superseded.ui.picker,oldPicker,
    "Old form should not open a replacement evidence picker");
  superseded.ui.form.onContinue(submitData);
  await flush();
  assert.notEqual(superseded.ui.picker,oldPicker,
    "Current form must remain functional after rejecting stale callbacks");
  superseded.ui.picker.onContinue(selectionData);
  await flush();
  assert.equal(attemptSubmissions,1,
    "Only the latest form and picker may submit the current report");
  assert.equal(superseded.status.length,1);

  // Closing a DM during asynchronous evidence loading dismisses its
  // owned dialog and prevents the late promise from opening stale evidence.
  let releaseOldChatMessages;
  const interrupted=browserHarness({
    getMessages:()=>new Promise(resolve=>{releaseOldChatMessages=resolve})
  });
  interrupted.flow.openReport();
  interrupted.ui.form.onContinue(submitData);
  await flush();
  assert.equal(interrupted.flow.dispose(),true);
  assert.equal(interrupted.ui.formDismissed,true,
    "Disposing a chat must close its private report form");
  assert.equal(interrupted.flow.dispose(),false,"Disposal must be idempotent");
  releaseOldChatMessages([{id:id1,sender_id:peer,recipient_id:user,
    text:"Previously visible private evidence"}]);
  await flush();
  assert.equal(interrupted.ui.picker,null,
    "An old asynchronous DM read must not show private evidence after chat closes");
  assert.equal(interrupted.flow.openReport(),false);
  assert.equal(interrupted.flow.showReminder(),false);

  // An evidence picker already displayed must close on chat change; its
  // retained callback cannot submit after the moderator switches conversations.
  let invalidatedSubmissions=0;
  const closedChat=browserHarness({
    submit:async()=>{invalidatedSubmissions++;return {ok:true,reportId}}
  });
  closedChat.flow.openReport();
  closedChat.ui.form.onContinue(submitData);
  await flush();
  const detachedPicker=closedChat.ui.picker;
  assert.ok(detachedPicker);
  assert.equal(closedChat.flow.dispose(),true);
  assert.equal(closedChat.ui.pickerDismissed,true,
    "Dispose must dismiss an open evidence picker with private DM content");
  detachedPicker.onContinue(selectionData);
  await flush();
  assert.equal(invalidatedSubmissions,0,
    "Private evidence cannot be submitted after its chat flow is disposed");
  assert.equal(closedChat.status.length,0,
    "Old chat flow cannot alert newly opened conversation");

  // A form callback can fire twice while getMessages() is pending.
  // Only ONE evidence picker may open, with no obsolete form replacing it.
  let pickerReads=0,finishPickerLoad;
  const duplicatePicker=browserHarness({
    getMessages:()=>{pickerReads++;
      return new Promise(resolve=>{finishPickerLoad=resolve});
    }
  });
  const originalForm=duplicatePicker.flow.openReport();
  assert.equal(originalForm,true);
  const formValues={conversationId:"conversation-1",reasonCode:1,details:"Threats"};
  duplicatePicker.ui.form.onContinue(formValues);
  duplicatePicker.ui.form.onContinue(formValues);
  assert.equal(duplicatePicker.flow.openReport(),false,
    "Cannot start a new report form while evidence loads");
  assert.equal(pickerReads,1,
    "Double form submission must not fetch evidence twice");
  finishPickerLoad([{id:id1,sender_id:peer,recipient_id:user,
    text:"A message selected as evidence"}]);
  await flush();
  assert.equal(duplicatePicker.ui.picker?.messages?.length,1);
  assert.equal(duplicatePicker.status.length,0,
    "Duplicate form callbacks must not emit an error alert");
  assert.deepEqual(duplicatePicker.calls,[],
    "Loading the evidence picker must not call authenticated report RPC");

  // A rejected evidence-load should release the lock so another form can
  // open and retry without needing to sign out or reload the whole page.
  let pickerAttempts=0;
  const pickerRecovery=browserHarness({getMessages:()=>{
    pickerAttempts++;
    return pickerAttempts===1 ? Promise.reject(new Error("temporary failure"))
      : [{id:id1,sender_id:peer,recipient_id:user,text:"Retry evidence"}];
  }});
  pickerRecovery.flow.openReport();
  pickerRecovery.ui.form.onContinue(formValues);
  await flush();
  assert.equal(pickerRecovery.status.at(-1)?.reason,"no_messages");
  assert.equal(pickerRecovery.flow.openReport(),true,
    "Failed picker initialization must not leave a permanent loading lock");
  pickerRecovery.ui.form.onContinue(formValues);
  await flush();
  assert.equal(pickerRecovery.ui.picker?.messages?.length,1);
  assert.equal(pickerAttempts,2);

  // Two rapid taps can happen while the asynchronous evidence re-read is
  // pending. Exactly ONE adapter RPC and ONE status notification may happen.
  const visible=[{id:id1,sender_id:peer,recipient_id:user,content:"Synthetic evidence"}];
  let reads=0, releaseReload, duplicateCalls=0;
  const doubleTap=browserHarness({
    getMessages:()=>{
      reads++;
      return reads===1 ? visible : new Promise(resolve=>{releaseReload=resolve});
    },
    submit:async()=>{duplicateCalls++;return {ok:true,reportId}}
  });
  doubleTap.flow.openReport();
  doubleTap.ui.form.onContinue({conversationId:"conversation-1",reasonCode:1,details:"Threats"});
  await flush();
  const selection={conversationId:"conversation-1",messageIds:[id1]};
  doubleTap.ui.picker.onContinue(selection);
  doubleTap.ui.picker.onContinue(selection);
  await flush();
  assert.equal(reads,2,"Repeated taps must not initiate a second evidence fetch");
  assert.equal(duplicateCalls,0,"RPC must not begin before evidence is revalidated");
  releaseReload(visible);
  await flush();
  assert.equal(duplicateCalls,1,"Repeated taps sent more than one report RPC");
  assert.equal(doubleTap.status.length,1,"Repeated taps showed duplicate status alerts");

  // An evidence-load failure must release the lock so a user can retry.
  let reloads=0, retryCalls=0;
  const readFailure=browserHarness({
    getMessages:()=>{
      reloads++;
      if(reloads===2)throw Error("Temporary DM loading error");
      return visible;
    },
    submit:async()=>{retryCalls++;return {ok:true,reportId}}
  });
  readFailure.flow.openReport();
  readFailure.ui.form.onContinue({conversationId:"conversation-1",reasonCode:1,details:"Threats"});
  await flush();
  readFailure.ui.picker.onContinue(selection);
  await flush();
  assert.equal(readFailure.status.at(-1)?.reason,"conversation_changed");
  readFailure.ui.picker.onContinue(selection);
  await flush();
  assert.equal(retryCalls,1,"Failed evidence reload permanently locked reporting");
  assert.equal(readFailure.status.at(-1)?.ok,true);
}

(async () => {
  await testAdapter();
  await testFlow();
  console.log("PASS: browser adapter + BETA report flow (auth, RLS, evidence, disabled, retry)");
})().catch(error => { console.error(error); process.exitCode = 1; });
