/* XOXO Avenue — Stay Safe, Sweetheart! canonical BETA chat preview host.
 * Loaded only on workers.dev with ?xoxo_safety_chat_beta=1.
 * Reuses stay-safe-browser-flow.js rather than duplicating its submission logic.
 * The default preview displays form/evidence without writes. A separate
 * explicit workers.dev-only query flag permits end-to-end BETA testing for
 * an account already approved in the server-side expiring allowlist.
 * No production script, SQL schema or existing DM controls are changed.
 */
(function(){
"use strict";
if(typeof window==="undefined")return;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// A URL flag is only an opt-in UX switch, NEVER authorization. The private
// Supabase tester allowlist plus active Auth session enforce permission.
// Never activate this path on xoxoavenue.com or a generic non-preview URL.
const previewSearch=typeof URLSearchParams==="function" ?
 new URLSearchParams(window.location?.search||"") : null;
const REPORT_RPC_WRITES_ENABLED=Boolean(
 /(?:^|\.)workers\.dev$/i.test(String(window.location?.hostname||"")) &&
 previewSearch?.get("xoxo_safety_chat_beta")==="1" &&
 previewSearch?.get("xoxo_safety_report_write_beta")==="1"
);
// Explicit, local-only simulation. It never invokes the report RPC.
const SIMULATE=Boolean(/(?:^|\\.)workers\\.dev$/i.test(String(location.hostname||"")) &&
 previewSearch?.get("xoxo_safety_simulate_beta")==="1");
const MOCK_IDS=[
 "00000000-0000-4000-8000-000000000101",
 "00000000-0000-4000-8000-000000000102",
 "00000000-0000-4000-8000-000000000103"
];
const MOCK_TEXT={
 es:["[SIMULACIÓN] Hola, ¿cómo estás?","[SIMULACIÓN] Por favor, envíame dinero.","[SIMULACIÓN] No compartas tus datos personales."],
 en:["[SIMULATION] Hi, how are you?","[SIMULATION] Please send me money.","[SIMULATION] Do not share personal information."]
};
let flow=null,flowKey="",flowClient=null;
// Fail closed until Supabase publishes the initial stored session. A stale
// SPA currentUser is NOT proof of a current signed-in Auth user.
let authSignedOut=true,authenticatedUserId=null;
function disposeFlow(){
 if(typeof flow?.dispose==="function")flow.dispose();
 flow=null;flowKey="";flowClient=null;
}
function valid(id){return typeof id==="string"&&UUID.test(id);}
function locale(){
 return typeof getFriendHubLanguage==="function"?getFriendHubLanguage():"en";
}
const UI={
 en:{button:"Report conversation",success:"🚩 Report submitted. Thank you for keeping XOXO Avenue safe. 💜",failure:"No report was sent. The BETA server may not be enabled or the evidence is no longer available."},
 es:{button:"Denunciar conversación",success:"🚩 Denuncia enviada correctamente. Gracias por cuidarnos. 💜",failure:"No se envió ninguna denuncia. El sistema BETA aún no está listo o las pruebas ya no están disponibles."},
 "pt-BR":{button:"Denunciar conversa",success:"🚩 Denúncia enviada. Obrigado por ajudar a manter o XOXO Avenue seguro. 💜",failure:"Nenhuma denúncia foi enviada. O sistema BETA pode estar indisponível ou as provas não estão mais acessíveis."},
 fr:{button:"Signaler la conversation",success:"🚩 Signalement envoyé. Merci de contribuer à la sécurité de XOXO Avenue. 💜",failure:"Aucun signalement n'a été envoyé. Le serveur BETA peut être indisponible ou les preuves ne sont plus accessibles."},
 pl:{button:"Zgłoś rozmowę",success:"🚩 Zgłoszenie wysłane. Dziękujemy za dbanie o bezpieczeństwo XOXO Avenue. 💜",failure:"Zgłoszenie nie zostało wysłane. Serwer BETA może być niedostępny lub dowody są już niedostępne."},
 de:{button:"Unterhaltung melden",success:"🚩 Meldung gesendet. Danke, dass du XOXO Avenue sicherer machst. 💜",failure:"Es wurde keine Meldung gesendet. Der BETA-Server ist möglicherweise nicht verfügbar oder die Beweise sind nicht mehr zugänglich."},
 cs:{button:"Nahlásit konverzaci",success:"🚩 Nahlášení bylo odesláno. Děkujeme, že pomáháš chránit XOXO Avenue. 💜",failure:"Nahlášení nebylo odesláno. Server BETA může být nedostupný nebo důkazy již nejsou přístupné."},
 no:{button:"Rapporter samtalen",success:"🚩 Rapport sendt. Takk for at du bidrar til et tryggere XOXO Avenue. 💜",failure:"Ingen rapport ble sendt. BETA-serveren kan være utilgjengelig, eller bevisene er ikke lenger tilgjengelige."},
 sv:{button:"Anmäl konversation",success:"🚩 Anmälan skickades. Tack för att du hjälper till att hålla XOXO Avenue tryggt. 💜",failure:"Ingen anmälan skickades. BETA-systemet är inte aktiverat eller bevisen är inte längre tillgängliga."},
 it:{button:"Segnala conversazione",success:"🚩 Segnalazione inviata. Grazie per contribuire alla sicurezza di XOXO Avenue. 💜",failure:"Nessuna segnalazione inviata. Il sistema BETA non è ancora attivo o le prove non sono più disponibili."}
};
function ui(){
 const lang=String(locale());
 if(/^pt(-|$)/i.test(lang))return UI["pt-BR"];
 if(/^(nb|nn|no)(-|$)/i.test(lang))return UI.no;
 return UI[lang]||UI[lang.split("-")[0]]||UI.en;
}
function visibleContext(){
 // A delayed DOM mutation after SIGNED_OUT must NOT re-create the previous
 // user\'s report form while the global currentUser object is still stale.
 if(authSignedOut)return null;
 const chat=document.getElementById("dmChat");
 if(!chat||chat.style.display==="none"||!chat.isConnected)return null;
 const user=typeof currentUser==="undefined"?null:currentUser;
 const other=typeof currentDmUserId==="undefined"?null:currentDmUserId;
 const client=typeof supabaseClient==="undefined"?null:supabaseClient;
 if(!valid(user?.id)||!valid(other)||user.id.toLowerCase()===other.toLowerCase()||
   (authenticatedUserId!==null&&authenticatedUserId!==user.id.toLowerCase())||
   typeof client?.auth?.getUser!=="function"||typeof client?.from!=="function"||
   typeof client?.rpc!=="function")return null;
 const self=user.id.toLowerCase(),peer=other.toLowerCase();
 const conversationId=[self,peer].sort().join(":");
 const seen=new Set(),messages=[];
 const loaded=Array.isArray(window.__xoxoCurrentDmMessages)?window.__xoxoCurrentDmMessages:[];
 for(const m of loaded){
   if(!valid(m?.id)||!valid(m?.sender_id)||!valid(m?.recipient_id))continue;
   // The real DM loader includes both fields. Disappearing/once-view items
   // stay in the chat, but must not enter the report evidence picker.
   if(m.whisper_id!=null ||
      (m.media_view_mode!=null&&m.media_view_mode!=="normal"))continue;
   const id=m.id.toLowerCase(),sender=m.sender_id.toLowerCase(),recipient=m.recipient_id.toLowerCase();
   if(seen.has(id)||!((sender===self&&recipient===peer)||(sender===peer&&recipient===self)))continue;
   seen.add(id);
   messages.push({id,sender_id:sender,recipient_id:recipient,
     whisper_id:m.whisper_id??null,
     media_view_mode:m.media_view_mode??"normal",
     created_at:typeof m.created_at==="string"?m.created_at:null,
     text:String(m.content||m.attachment_name||("["+String(m.attachment_type||"Message")+"]")).slice(0,1000)});
 }
 if(SIMULATE && messages.length===0){
   const texts=MOCK_TEXT[String(locale()).split("-")[0]]||MOCK_TEXT.en;
   for(let i=0;i<MOCK_IDS.length;i++){
     messages.push({id:MOCK_IDS[i],sender_id:i%2?peer:self,
       recipient_id:i%2?self:peer,media_view_mode:"normal",whisper_id:null,
       created_at:new Date(Date.UTC(2026,9,25,12,i)).toISOString(),text:texts[i]});
   }
 }
 return {self,peer,conversationId,client,messages,locale:locale()};
}
function reportStatus(result){
 // In UI-preview mode, a failed RPC is expected. Never claim submission.
 window.alert(SIMULATE ?
   (String(locale()).startsWith("es") ?
     "🧪 Simulación completada. No se envió ninguna denuncia ni mensaje." :
     "🧪 Simulation complete. No report or message was sent.") :
   (result?.ok?ui().success:ui().failure));
}
function getFlow(){
 const ctx=visibleContext();
 if(!ctx||typeof window.XOXOSafetyFlowBeta?.create!=="function"){
   disposeFlow();return null;
 }
 // A->B account switches can reuse the same participant pair but MUST NOT
 // reuse a safety reminder or report flow belonging to the old account.
 const key=ctx.self+"|"+ctx.conversationId+"|"+String(ctx.locale);
 if(flow && flowKey===key && flowClient===ctx.client)return flow;
 disposeFlow();
 flowKey=key;flowClient=ctx.client;
 flow=window.XOXOSafetyFlowBeta.create({
   client:ctx.client, accountId:ctx.self, otherUserId:ctx.peer,
   conversationId:ctx.conversationId, locale:ctx.locale,
   previewOnly:SIMULATE||!REPORT_RPC_WRITES_ENABLED, enabled:!SIMULATE&&REPORT_RPC_WRITES_ENABLED,
   isContextActive:()=>{
     const latest=visibleContext();
     return !!latest && latest.conversationId===ctx.conversationId &&
       latest.self===ctx.self && latest.peer===ctx.peer &&
       latest.client===ctx.client;
   },
   getMessages:()=>{
     const latest=visibleContext();
     if(!latest||latest.conversationId!==ctx.conversationId||
        latest.self!==ctx.self||latest.peer!==ctx.peer)throw Error("Conversation changed");
     return latest.messages;
   },
   onStatus:reportStatus
 });
 return flow;
}
function openReport(){
 const current=getFlow();
 return !!current && current.openReport();
}
function ensureButton(){
 const header=document.querySelector("#dmChat .dm-chat-header");
 if(!header)return;
 let button=document.getElementById("xoxoSafetyConversationReportBeta");
 if(!button){
   button=document.createElement("button");button.type="button";
   button.id="xoxoSafetyConversationReportBeta";
   button.textContent="🚩";
   button.style.cssText="width:38px;height:38px;flex:0 0 38px;border-radius:50%;border:1px solid #ba7df4;background:#392354;color:white;cursor:pointer";
   button.addEventListener("click",openReport);
   const deleteButton=header.querySelector(".dm-chat-delete-button");
   if(deleteButton)header.insertBefore(button,deleteButton);
   else header.append(button);
 }
 button.hidden=!visibleContext();
 button.title=ui().button;
 button.setAttribute("aria-label",button.title);
}
function refresh(){
 ensureButton();
 const current=getFlow();
 return current?current.showReminder():false;
}
async function submit(){
 // Legacy test API intentionally never writes; the real user action goes
 // through the validated form/evidence flow and server-verified allowlist.
 return {ok:false,reason:"beta_backend_disabled"};
}
function install(){
 const messages=document.getElementById("dmMessages");
 const chat=document.getElementById("dmChat");
 const header=chat?.querySelector(".dm-chat-header");
 if(typeof MutationObserver==="function"){
   const observer=new MutationObserver(()=>{refresh()});
   if(messages)observer.observe(messages,{childList:true,subtree:false});
   // Closing a chat often changes display/style without mutating messages.
   if(chat)observer.observe(chat,{attributes:true,attributeFilter:["style","class"]});
   // Switching peers typically updates the header, not just the messages.
   if(header)observer.observe(header,{childList:true,subtree:true});
 }
 if(typeof window.addEventListener==="function")
   window.addEventListener("pagehide",disposeFlow);
 // Auth invalidation also closes sensitive dialogs immediately, even when
 // a user signs out while a chat DOM remains visible during transition.
 const client=typeof supabaseClient==="undefined"?null:supabaseClient;
 if(typeof client?.auth?.onAuthStateChange==="function")
   client.auth.onAuthStateChange((event,session)=>{
     if(event==="SIGNED_OUT" || event==="USER_DELETED"){
       authSignedOut=true;
       authenticatedUserId=null;
       disposeFlow();
       refresh();
     }else if(["INITIAL_SESSION","SIGNED_IN","TOKEN_REFRESHED",
               "USER_UPDATED","PASSWORD_RECOVERY"].includes(event)){
       // Supabase's INITIAL_SESSION may be null when there is no stored
       // login. TOKEN_REFRESHED can also invalidate/change the user.
       // Ignore stale global currentUser until the Auth event agrees.
       const next=valid(session?.user?.id) &&
         session.user.is_anonymous!==true ?
         session.user.id.toLowerCase():null;
       if(next!==authenticatedUserId || authSignedOut!==!next)
         disposeFlow();
       authenticatedUserId=next;
       authSignedOut=!next;
       refresh();
     }
   });
 refresh();
}
window.XOXOSafetyChatPreviewBeta=Object.freeze({
 refresh,openReport,submit,visibleContext,
 reportWritesEnabled:()=>!SIMULATE&&REPORT_RPC_WRITES_ENABLED,simulationEnabled:()=>SIMULATE,translations:UI
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
})();
