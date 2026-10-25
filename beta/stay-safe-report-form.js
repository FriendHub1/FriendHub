/* XOXO Avenue — isolated report form BETA. No network requests.
 * The host must implement authenticated reporting and explicit evidence selection.
 */
(function(){
"use strict";
const translations={
en:{title:"Report Conversation 🚩",intro:"Tell us what happened. Your safety matters. 💛",reason:"Why are you reporting?",details:"Tell us more (optional)",placeholder:"Describe what happened...",submit:"Continue to select evidence",cancel:"Cancel",privacy:"Only messages you explicitly select will be shared as evidence.",reasons:["Scam or money requests","Threats or blackmail","Harassment or unwanted messages","Fake profile or identity","Intimate photo threats","Other"]},
es:{title:"Denunciar conversación 🚩",intro:"Cuéntanos qué ocurrió. Tu seguridad importa. 💛",reason:"¿Por qué denuncias esta conversación?",details:"Cuéntanos más (opcional)",placeholder:"Describe lo sucedido...",submit:"Continuar para seleccionar pruebas",cancel:"Cancelar",privacy:"Solo se compartirán como pruebas los mensajes que selecciones expresamente.",reasons:["Estafa o solicitudes de dinero","Amenazas o chantaje","Acoso o mensajes no deseados","Perfil o identidad falsa","Amenazas con fotografías íntimas","Otro"]}
,
"pt-BR":{title:"Denunciar conversa 🚩",intro:"Conte-nos o que aconteceu. Sua segurança importa. 💛",reason:"Por que você está denunciando esta conversa?",details:"Conte-nos mais (opcional)",placeholder:"Descreva o que aconteceu...",submit:"Continuar para selecionar provas",cancel:"Cancelar",privacy:"Somente as mensagens que você selecionar serão anexadas como provas.",reasons:["Golpe ou pedidos de dinheiro","Ameaças ou chantagem","Assédio ou mensagens indesejadas","Perfil ou identidade falsa","Ameaças com fotos íntimas","Outro"]},
fr:{title:"Signaler la conversation 🚩",intro:"Raconte-nous ce qui s'est passé. Ta sécurité compte. 💛",reason:"Pourquoi signales-tu cette conversation ?",details:"Précisions (facultatif)",placeholder:"Décris ce qui s'est passé...",submit:"Continuer pour choisir les preuves",cancel:"Annuler",privacy:"Seuls les messages que tu sélectionnes seront joints comme preuves.",reasons:["Arnaque ou demande d'argent","Menaces ou chantage","Harcèlement ou messages indésirables","Faux profil ou fausse identité","Menaces liées à des photos intimes","Autre"]},
pl:{title:"Zgłoś rozmowę 🚩",intro:"Powiedz nam, co się stało. Twoje bezpieczeństwo jest ważne. 💛",reason:"Dlaczego zgłaszasz tę rozmowę?",details:"Opisz sytuację (opcjonalnie)",placeholder:"Opisz, co się wydarzyło...",submit:"Przejdź do wyboru dowodów",cancel:"Anuluj",privacy:"Jako dowody zostaną dołączone tylko wybrane przez Ciebie wiadomości.",reasons:["Oszustwo lub prośba o pieniądze","Groźby lub szantaż","Nękanie lub niechciane wiadomości","Fałszywy profil lub tożsamość","Groźby dotyczące intymnych zdjęć","Inne"]},
de:{title:"Unterhaltung melden 🚩",intro:"Erzähl uns, was passiert ist. Deine Sicherheit zählt. 💛",reason:"Warum meldest du diese Unterhaltung?",details:"Weitere Angaben (optional)",placeholder:"Beschreibe, was passiert ist...",submit:"Weiter zur Beweisauswahl",cancel:"Abbrechen",privacy:"Nur die von dir ausgewählten Nachrichten werden als Beweise beigefügt.",reasons:["Betrug oder Geldforderungen","Drohungen oder Erpressung","Belästigung oder unerwünschte Nachrichten","Gefälschtes Profil oder Identität","Drohungen mit intimen Fotos","Sonstiges"]},
cs:{title:"Nahlásit konverzaci 🚩",intro:"Řekni nám, co se stalo. Na tvém bezpečí záleží. 💛",reason:"Proč tuto konverzaci nahlašuješ?",details:"Další podrobnosti (nepovinné)",placeholder:"Popiš, co se stalo...",submit:"Pokračovat k výběru důkazů",cancel:"Zrušit",privacy:"Jako důkazy budou přiloženy pouze zprávy, které vybereš.",reasons:["Podvod nebo žádosti o peníze","Výhrůžky nebo vydírání","Obtěžování nebo nevyžádané zprávy","Falešný profil nebo identita","Výhrůžky intimními fotografiemi","Jiné"]},
no:{title:"Rapporter samtalen 🚩",intro:"Fortell oss hva som skjedde. Din trygghet betyr noe. 💛",reason:"Hvorfor rapporterer du denne samtalen?",details:"Flere detaljer (valgfritt)",placeholder:"Beskriv hva som skjedde...",submit:"Fortsett for å velge bevis",cancel:"Avbryt",privacy:"Bare meldingene du selv velger, blir lagt ved som bevis.",reasons:["Svindel eller pengeforespørsler","Trusler eller utpressing","Trakassering eller uønskede meldinger","Falsk profil eller identitet","Trusler knyttet til intime bilder","Annet"]},
sv:{"title":"Anmäl konversation 🚩","intro":"Berätta vad som hände. Din säkerhet är viktig. 💛","reason":"Varför anmäler du den här konversationen?","details":"Berätta mer (valfritt)","placeholder":"Beskriv vad som hände...","submit":"Fortsätt för att välja bevis","cancel":"Avbryt","privacy":"Endast meddelanden du själv väljer bifogas som bevis.","reasons":["Bedrägeri eller krav på pengar","Hot eller utpressning","Trakasserier eller oönskade meddelanden","Falsk profil eller identitet","Hot med intima bilder","Annat"]},
it:{"title":"Segnala conversazione 🚩","intro":"Raccontaci cosa è successo. La tua sicurezza conta. 💛","reason":"Perché segnali questa conversazione?","details":"Aggiungi dettagli (facoltativo)","placeholder":"Descrivi cosa è successo...","submit":"Continua per scegliere le prove","cancel":"Annulla","privacy":"Solo i messaggi che selezioni saranno allegati come prove.","reasons":["Truffa o richieste di denaro","Minacce o ricatto","Molestie o messaggi indesiderati","Profilo o identità falsa","Minacce con foto intime","Altro"]}
};
function open({conversationId,locale="es",onContinue}={}){
 if(typeof conversationId!=="string"||!conversationId||typeof onContinue!=="function")return false;
 if(document.querySelector("[data-xoxo-report-beta]"))return false;
 const language=locale==="nb"||locale==="nb-NO"?"no":locale;
 const t=translations[language]||translations[language.split("-")[0]]||translations.en;
 const overlay=document.createElement("div");overlay.dataset.xoxoReportBeta="";overlay.style.cssText="position:fixed;inset:0;z-index:2147483001;box-sizing:border-box;background:#000b;display:grid;place-items:center;padding:12px;padding-top:max(12px,env(safe-area-inset-top));padding-bottom:max(12px,env(safe-area-inset-bottom))";
 const form=document.createElement("form");form.style.cssText="box-sizing:border-box;background:#170e29;color:#f6edff;border:1px solid #78529c;border-radius:20px;padding:clamp(14px,4vw,22px);width:min(430px,100%);max-width:100%;max-height:90vh;max-height:90dvh;overflow:auto;overscroll-behavior:contain;font:16px system-ui";
 form.setAttribute("role","dialog");form.setAttribute("aria-modal","true");form.setAttribute("aria-labelledby","xoxo-safety-report-title");
 const title=document.createElement("h2");title.id="xoxo-safety-report-title";title.textContent=t.title;title.style.color="#ffe28a";form.append(title);
 const intro=document.createElement("p");intro.textContent=t.intro;form.append(intro);
 const legend=document.createElement("p");legend.textContent=t.reason;form.append(legend);
 const group=document.createElement("div");
 const radios=t.reasons.map((label,i)=>{const wrap=document.createElement("label");wrap.style.cssText="display:block;margin:10px 0";const input=document.createElement("input");input.type="radio";input.name="xoxo-report-reason";input.value=String(i);input.checked=i===0;wrap.append(input,document.createTextNode(" "+label));group.append(wrap);return input;});form.append(group);
 const label=document.createElement("label");label.textContent=t.details;label.style.display="block";label.htmlFor="xoxo-report-details-beta";form.append(label);
 const details=document.createElement("textarea");details.id="xoxo-report-details-beta";details.maxLength=2000;details.rows=4;details.placeholder=t.placeholder;details.style.cssText="box-sizing:border-box;width:100%;background:#2b1b40;color:white;border:1px solid #9577a9;border-radius:10px;padding:10px;margin-top:8px";form.append(details);
 const privacy=document.createElement("p");privacy.textContent=t.privacy;privacy.style.fontSize="13px";form.append(privacy);
 const submit=document.createElement("button");submit.type="submit";submit.textContent=t.submit;
 const cancel=document.createElement("button");cancel.type="button";cancel.textContent=t.cancel;
 for(const b of [submit,cancel])b.style.cssText="box-sizing:border-box;display:block;width:100%;min-height:44px;padding:11px;border-radius:10px;margin:9px 0 0;white-space:normal;overflow-wrap:anywhere;cursor:pointer";
 submit.style.background="#ffda60";submit.style.color="#231432";cancel.style.background="#34234b";cancel.style.color="white";
 form.append(submit,cancel);overlay.append(form);
 const previous=document.activeElement;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
 let closed=false;
 function close(){
  if(closed)return;
  closed=true;
  overlay.remove();document.body.style.overflow=overflow;
  document.removeEventListener("keydown",onKey);
  if(previous?.isConnected)previous.focus();
 }
 function onKey(e){if(e.key==="Escape"){e.preventDefault();close();}if(e.key==="Tab"){const focusable=[...radios,details,submit,cancel];const i=focusable.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();cancel.focus()}else if(!e.shiftKey&&i===focusable.length-1){e.preventDefault();radios[0].focus()}}}
 cancel.onclick=close;
 form.onsubmit=e=>{
  e.preventDefault();
  // A detached/cancelled form can still have a queued DOM submit callback.
  // It must never reopen evidence selection after Cancel/Escape or submit twice.
  if(closed)return;
  const selected=radios.find(x=>x.checked);
  if(!selected)return;
  const payload={conversationId,reason:t.reasons[Number(selected.value)],
   reasonCode:Number(selected.value),details:details.value.trim()};
  close();onContinue(payload);
 };
 document.body.append(overlay);document.addEventListener("keydown",onKey);radios[0].focus();return true;
}
window.XOXOReportFormBeta=Object.freeze({open,translations});
})();