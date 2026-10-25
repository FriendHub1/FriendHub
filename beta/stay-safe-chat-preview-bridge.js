/* XOXO Avenue — Stay Safe, Sweetheart! BETA chat bridge
 * Loaded ONLY from the opt-in Cloudflare preview route, never from production.
 * Uses the existing direct-message UI and authenticated Supabase client.
 * A report can succeed ONLY after the server RPC is deployed and audited.
 */
(function(){
"use strict";
if(typeof window==="undefined")return;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let submitting=false;
// Explicitly OFF: opt-in UI preview must never write to the live Supabase project.
const REPORT_RPC_WRITES_ENABLED=false;
function valid(id){return typeof id==="string" && UUID.test(id);}
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
function ui(){const code=locale();return UI[code==="nb"||code==="nb-NO"?"no":code]||UI.en;}
function visibleContext(){
 const chat=document.getElementById("dmChat");
 if(!chat || chat.style.display==="none" || !chat.isConnected)return null;
 const user=typeof currentUser==="undefined"?null:currentUser;
 const other=typeof currentDmUserId==="undefined"?null:currentDmUserId;
 const client=typeof supabaseClient==="undefined"?null:supabaseClient;
 if(!valid(user?.id)||!valid(other)||user.id.toLowerCase()===other.toLowerCase()||
    typeof client?.auth?.getUser!=="function"||typeof client?.from!=="function"||
    typeof client?.rpc!=="function")return null;
 const self=user.id.toLowerCase(),peer=other.toLowerCase();
 const conversationId=[self,peer].sort().join(":");
 const shown=Array.isArray(window.__xoxoCurrentDmMessages)?window.__xoxoCurrentDmMessages:[];
 const seen=new Set(),messages=[];
 for(const m of shown){
   if(!valid(m?.id)||seen.has(m.id.toLowerCase())||!valid(m?.sender_id)||!valid(m?.recipient_id))continue;
   const sender=m.sender_id.toLowerCase(),recipient=m.recipient_id.toLowerCase();
   if(!((sender===self&&recipient===peer)||(sender===peer&&recipient===self)))continue;
   seen.add(m.id.toLowerCase());
   messages.push({
     id:m.id.toLowerCase(),sender_id:sender,recipient_id:recipient,
     text:String(m.content||m.attachment_name||("["+String(m.attachment_type||"Message")+"]")).slice(0,1000)
   });
 }
 return {self,peer,conversationId,client,messages,locale:locale()};
}
function ensureButton(){
 const header=document.querySelector("#dmChat .dm-chat-header");
 if(!header)return;
 let btn=document.getElementById("xoxoSafetyConversationReportBeta");
 if(!btn){
   btn=document.createElement("button");
   btn.type="button";btn.id="xoxoSafetyConversationReportBeta";
   btn.textContent="🚩";
   btn.style.cssText="width:38px;height:38px;flex:0 0 38px;border-radius:50%;border:1px solid #ba7df4;background:#392354;color:white;cursor:pointer";
   btn.addEventListener("click",openReport);
   // Insert before the existing delete button, but do not alter its behavior.
   const deleteButton=header.querySelector(".dm-chat-delete-button");
   if(deleteButton)header.insertBefore(btn,deleteButton);
   else header.append(btn);
 }
 const active=!!visibleContext();
 btn.hidden=!active;
 btn.title=ui().button;
 btn.setAttribute("aria-label",btn.title);
}
function refresh(){
 const ctx=visibleContext();
 ensureButton();
 if(!ctx)return false;
 const reminder=window.XOXOSafetyReminderBeta;
 if(!reminder?.show)return false;
 return reminder.show({
   conversationId:ctx.conversationId,accountId:ctx.self,locale:ctx.locale,
   onReport:()=>openReport()
 });
}
function sameContext(ctx){
 const live=visibleContext();
 return !!live && live.self===ctx.self && live.peer===ctx.peer &&
        live.conversationId===ctx.conversationId && live.client===ctx.client;
}
async function submit(ctx,draft,selectedIds){
 if(!REPORT_RPC_WRITES_ENABLED)return {ok:false,reason:"beta_backend_disabled"};
 if(submitting)return {ok:false,reason:"already_submitting"};
 if(!sameContext(ctx)||!draft||!Number.isInteger(draft.reasonCode)||
    draft.reasonCode<0||draft.reasonCode>5||
    typeof draft.details!=="string"||draft.details.length>2000||
    !Array.isArray(selectedIds)||selectedIds.length<1||selectedIds.length>20||
    selectedIds.some(id=>!valid(id))||
    new Set(selectedIds.map(id=>id.toLowerCase())).size!==selectedIds.length)
   return {ok:false,reason:"invalid_input"};
 const selected=new Set(selectedIds.map(id=>id.toLowerCase()));
 const allowed=new Set(ctx.messages.map(x=>x.id));
 if([...selected].some(id=>!allowed.has(id)))return {ok:false,reason:"not_visible"};
 submitting=true;
 try{
   const auth=await ctx.client.auth.getUser();
   if(auth?.error || auth?.data?.user?.id?.toLowerCase()!==ctx.self || !sameContext(ctx))
     return {ok:false,reason:"authentication_failed"};
   // Client-side RLS preflight. Server RPC repeats all checks authoritatively.
   const {data:rows,error}=await ctx.client.from("direct_messages")
      .select("id,sender_id,recipient_id").in("id",selectedIds);
   if(error||!Array.isArray(rows)||rows.length!==selectedIds.length||!sameContext(ctx))
     return {ok:false,reason:"evidence_unavailable"};
   const returned=new Set();
   for(const row of rows){
     if(!valid(row?.id)||!valid(row?.sender_id)||!valid(row?.recipient_id))
       return {ok:false,reason:"invalid_evidence"};
     const id=row.id.toLowerCase(),sender=row.sender_id.toLowerCase(),recipient=row.recipient_id.toLowerCase();
     if(!selected.has(id)||returned.has(id)||
        !((sender===ctx.self&&recipient===ctx.peer)||(sender===ctx.peer&&recipient===ctx.self)))
       return {ok:false,reason:"wrong_conversation"};
     returned.add(id);
   }
   if(returned.size!==selected.size)return {ok:false,reason:"evidence_unavailable"};
   if(typeof window.crypto?.randomUUID!=="function")return {ok:false,reason:"unsupported_browser"};
   const idempotencyKey=window.crypto.randomUUID();
   const rpc=await ctx.client.rpc("xoxo_submit_conversation_report_beta",{
     p_other_user_id:ctx.peer,p_reason_code:draft.reasonCode,
     p_details:draft.details,p_message_ids:[...selected],
     p_idempotency_key:idempotencyKey
   });
   if(rpc?.error || !valid(rpc?.data))return {ok:false,reason:"server_unavailable"};
   return {ok:true,reportId:rpc.data};
 }catch{return {ok:false,reason:"submission_failed"};}
 finally{submitting=false;}
}
function openReport(){
 const ctx=visibleContext();
 if(!ctx||!window.XOXOReportFormBeta?.open||!window.XOXOEvidencePickerBeta?.open)return false;
 const translated=ctx.locale;
 return window.XOXOReportFormBeta.open({
   conversationId:ctx.conversationId,locale:translated,
   onContinue:draft=>{
     if(!sameContext(ctx))return;
     window.XOXOEvidencePickerBeta.open({
       conversationId:ctx.conversationId,locale:translated,
       messages:ctx.messages.slice(-100),
       onContinue:async evidence=>{
         const result=await submit(ctx,draft,evidence.messageIds);
         window.alert(result.ok?ui().success:ui().failure);
       }
     });
   }
 });
}
function install(){
 const messages=document.getElementById("dmMessages");
 if(!messages || typeof MutationObserver!=="function")return;
 const observer=new MutationObserver(()=>refresh());
 observer.observe(messages,{childList:true,subtree:false});
 refresh();
}
window.XOXOSafetyChatPreviewBeta=Object.freeze({refresh,openReport,submit,visibleContext,reportWritesEnabled:()=>REPORT_RPC_WRITES_ENABLED});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
})();