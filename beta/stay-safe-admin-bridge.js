/* XOXO Avenue — Stay Safe, Sweetheart! Admin BETA.
 * Adds conversation-report METADATA to the existing #xmmReportsList.
 * Does not open or render private messages; that is exclusively the existing
 * openXoxoDmConversation() PIN-gated, reason-audited viewer.
 * Disabled until the preview explicitly opts in.
 */
(function(){
"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS=new Set(["pending","reviewed","resolved","dismissed"]);
const REASONS=[
  "Scam or money requests",
  "Threats or blackmail",
  "Harassment or unwanted messages",
  "Fake profile or identity",
  "Intimate photo threats",
  "Other"
];
const TXT={
  en:{title:"🚩 Conversation reports · Stay Safe BETA",unlock:"🔐 Verify moderation PIN to review",loading:"Loading conversation reports…",empty:"No conversation reports yet.",denied:"Could not load conversation reports. Check PIN and BETA server setup.",error:"Could not update this report.",open:"Open in existing conversation viewer",missing:"Conversation is no longer available in the existing viewer.",reporter:"Reported by",other:"Reported user",reason:"Reason",details:"Details",evidence:"Selected evidence IDs",none:"None provided",saved:"Report updated.",confirm:"Change this report to",statuses:["Mark reviewed","Resolve","Dismiss","Reopen"]},
  es:{title:"🚩 Denuncias de conversaciones · Stay Safe BETA",unlock:"🔐 Verificar PIN de moderación",loading:"Cargando denuncias de conversaciones…",empty:"Todavía no hay denuncias de conversaciones.",denied:"No se pudieron cargar las denuncias. Revisa el PIN y la configuración BETA.",error:"No se pudo actualizar esta denuncia.",open:"Abrir en el visor actual de conversaciones",missing:"La conversación ya no está disponible en el visor actual.",reporter:"Denuncia enviada por",other:"Usuario denunciado",reason:"Motivo",details:"Detalles",evidence:"IDs de evidencias seleccionadas",none:"Sin detalles",saved:"Denuncia actualizada.",confirm:"Cambiar esta denuncia a",statuses:["Revisada","Resolver","Descartar","Reabrir"]}
};
function words(locale){return TXT[String(locale||"en").toLowerCase().split("-")[0]]||TXT.en;}
function node(tag,label,cls){
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(label!==undefined)e.textContent=String(label);
 return e;
}
function isValidRow(row){
 return row&&typeof row==="object"&&UUID.test(row.id||"")&&
  UUID.test(row.reporter_id||"")&&UUID.test(row.reported_user_id||"")&&
  Number.isInteger(row.reason_code)&&row.reason_code>=0&&row.reason_code<=5&&
  Array.isArray(row.message_ids)&&row.message_ids.length>=1&&row.message_ids.length<=20&&
  row.message_ids.every(id=>typeof id==="string"&&UUID.test(id))&&
  STATUS.has(row.status);
}
function enabled(){return window.XOXO_SAFETY_BETA_ENABLED===true;}
async function mount({client,list,isAdmin,authorize,getName,formatDate,onOpen,locale="en"}={}){
 if(!enabled()||!list||typeof client?.rpc!=="function"||typeof isAdmin!=="function"||
    typeof authorize!=="function"||typeof onOpen!=="function"||!isAdmin())return false;
 list.querySelector("[data-xoxo-safety-admin-beta]")?.remove();
 const t=words(locale);
 const section=node("section",undefined,"xmm-reports");
 section.dataset.xoxoSafetyAdminBeta="";
 section.style.cssText="margin-top:14px;padding:14px;border:1px solid #7e51a6;border-radius:14px";
 const heading=node("h4",t.title);
 heading.style.cssText="font-size:16px;margin:0 0 9px;color:#f7e7ff";
 const btn=node("button",t.unlock,"xmm-reload");
 btn.type="button";
 const feedback=node("div","","xmm-report-feedback");feedback.setAttribute("role","status");
 const entries=node("div");
 section.append(heading,btn,feedback,entries);
 list.append(section);
 let unlocked=false,busy=false,rows=[];
 const name=(id)=>typeof getName==="function"?String(getName(id)):String(id);
 const date=(v)=>typeof formatDate==="function"?String(formatDate(v)):String(v||"");
 async function redraw(){
   entries.replaceChildren();
   if(!rows.length){entries.append(node("p",t.empty,"xmm-report-feedback"));return;}
   for(const r of rows){
     if(!isValidRow(r))continue;
     const card=node("article",undefined,"xmm-report-card");
     const top=node("div",undefined,"xmm-report-top");
     top.append(node("strong","🚩 #"+r.id.slice(0,8)),
                node("span",String(r.status).toUpperCase(),"xmm-report-status"));
     card.append(top);
     card.append(node("p",t.reporter+": "+name(r.reporter_id)+" · "+t.other+": "+name(r.reported_user_id),"xmm-report-meta"));
     card.append(node("p",t.reason+": "+REASONS[r.reason_code]+" · "+date(r.created_at),"xmm-report-meta"));
     card.append(node("p",t.details+": "+(r.details||t.none),"xmm-report-details"));
     card.append(node("p",t.evidence+": "+r.message_ids.length,"xmm-report-meta"));
     const actions=node("div",undefined,"xmm-report-actions");
     const open=node("button",t.open);open.type="button";
     open.addEventListener("click",async()=>{
       if(busy||!isAdmin())return;
       feedback.textContent="";
       try{
         // Existing audited viewer MUST handle PIN + moderation reason.
         const ok=await onOpen(r.reporter_id,r.reported_user_id);
         if(ok===false)feedback.textContent=t.missing;
       }catch{feedback.textContent=t.missing;}
     });
     actions.append(open);
     const values=["reviewed","resolved","dismissed","pending"];
     values.forEach((value,i)=>{
       if(value===r.status)return;
       const action=node("button",t.statuses[i]);action.type="button";
       action.addEventListener("click",async()=>{
         if(busy||!isAdmin()||!unlocked||!window.confirm(t.confirm+" "+value+"?"))return;
         busy=true;feedback.textContent=t.loading;
         try{
           const response=await client.rpc("xoxo_admin_update_conversation_report_beta",
             {p_report_id:r.id,p_status:value});
           if(response?.error||response?.data!==true)throw Error("Status update denied");
           const refreshed=await client.rpc("xoxo_admin_list_conversation_reports_beta");
           if(refreshed?.error||!Array.isArray(refreshed?.data))throw Error("Could not refresh");
           rows=refreshed.data.filter(isValidRow);
           feedback.textContent=t.saved;
           await redraw();
         }catch{feedback.textContent=t.error;}
         finally{busy=false;}
       });
       actions.append(action);
     });
     card.append(actions);
     entries.append(card);
   }
 }
 btn.addEventListener("click",async()=>{
   if(busy||!isAdmin())return;
   busy=true;btn.disabled=true;feedback.textContent=t.loading;
   try{
     // Same PIN dialog used by the existing moderation console.
     const auth=await authorize();
     if(!auth?.reason){feedback.textContent="";return;}
     const response=await client.rpc("xoxo_admin_list_conversation_reports_beta");
     if(response?.error||!Array.isArray(response?.data))throw Error("BETA RPC unavailable");
     rows=response.data.filter(isValidRow);
     unlocked=true;
     await redraw();
     feedback.textContent="";
   }catch{feedback.textContent=t.denied;}
   finally{busy=false;btn.disabled=false;}
 });
 return true;
}
window.XOXOSafetyAdminBridge=Object.freeze({enabled,mount,isValidRow});
})();