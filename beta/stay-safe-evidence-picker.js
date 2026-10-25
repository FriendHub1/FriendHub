/* XOXO Avenue — isolated evidence picker BETA.
 * Caller supplies only messages already authorized and visible to the reporting user.
 * No network requests; callback receives only explicitly selected message IDs.
 */
(function(){
"use strict";
const translations={
 es:{title:"Selecciona los mensajes como prueba",help:"Marca únicamente los mensajes que quieras incluir en tu denuncia.",empty:"No hay mensajes disponibles para seleccionar.",continue:"Enviar denuncia",cancel:"Cancelar",none:"Selecciona al menos un mensaje.",limit:"Puedes seleccionar hasta 20 mensajes."},
 en:{title:"Select messages as evidence",help:"Choose only the messages you want to include in your report.",empty:"No messages available to select.",continue:"Submit report",cancel:"Cancel",none:"Select at least one message.",limit:"You can select up to 20 messages."}
,
 "pt-BR":{title:"Selecione mensagens como prova",help:"Marque apenas as mensagens que deseja incluir na denúncia.",empty:"Não há mensagens disponíveis para selecionar.",continue:"Enviar denúncia",cancel:"Cancelar",none:"Selecione pelo menos uma mensagem.",limit:"Você pode selecionar até 20 mensagens."},
 fr:{title:"Choisis les messages comme preuves",help:"Sélectionne uniquement les messages que tu veux joindre au signalement.",empty:"Aucun message disponible.",continue:"Envoyer le signalement",cancel:"Annuler",none:"Sélectionne au moins un message.",limit:"Tu peux sélectionner jusqu'à 20 messages."},
 pl:{title:"Wybierz wiadomości jako dowody",help:"Zaznacz tylko wiadomości, które chcesz dołączyć do zgłoszenia.",empty:"Brak wiadomości do wyboru.",continue:"Wyślij zgłoszenie",cancel:"Anuluj",none:"Wybierz co najmniej jedną wiadomość.",limit:"Możesz wybrać maksymalnie 20 wiadomości."},
 de:{title:"Nachrichten als Beweise auswählen",help:"Wähle nur Nachrichten aus, die du deiner Meldung beifügen möchtest.",empty:"Keine Nachrichten zur Auswahl vorhanden.",continue:"Meldung absenden",cancel:"Abbrechen",none:"Wähle mindestens eine Nachricht.",limit:"Du kannst bis zu 20 Nachrichten auswählen."},
 cs:{title:"Vyber zprávy jako důkazy",help:"Označ jen zprávy, které chceš přiložit k nahlášení.",empty:"Žádné zprávy k výběru.",continue:"Odeslat nahlášení",cancel:"Zrušit",none:"Vyber alespoň jednu zprávu.",limit:"Můžeš vybrat nejvýše 20 zpráv."},
 no:{title:"Velg meldinger som bevis",help:"Velg bare meldingene du vil legge ved rapporten.",empty:"Ingen meldinger tilgjengelig.",continue:"Send rapport",cancel:"Avbryt",none:"Velg minst én melding.",limit:"Du kan velge opptil 20 meldinger."},
sv:{"title":"Välj meddelanden som bevis","help":"Markera bara de meddelanden du vill bifoga din anmälan.","empty":"Det finns inga meddelanden att välja.","continue":"Skicka anmälan","cancel":"Avbryt","none":"Välj minst ett meddelande.","limit":"Du kan välja högst 20 meddelanden."},
it:{"title":"Seleziona i messaggi come prova","help":"Seleziona solo i messaggi che vuoi allegare alla segnalazione.","empty":"Nessun messaggio disponibile.","continue":"Invia segnalazione","cancel":"Annulla","none":"Seleziona almeno un messaggio.","limit":"Puoi selezionare fino a 20 messaggi."}
};
const previewLabels={
 en:{more:"Read full message",less:"Show less"},
 es:{more:"Leer mensaje completo",less:"Mostrar menos"},
 "pt-BR":{more:"Ler mensagem completa",less:"Mostrar menos"},
 fr:{more:"Lire le message entier",less:"Afficher moins"},
 pl:{more:"Przeczytaj całą wiadomość",less:"Pokaż mniej"},
 de:{more:"Ganze Nachricht lesen",less:"Weniger anzeigen"},
 cs:{more:"Přečíst celou zprávu",less:"Zobrazit méně"},
 no:{more:"Les hele meldingen",less:"Vis mindre"},
 sv:{more:"Läs hela meddelandet",less:"Visa mindre"},
 it:{more:"Leggi il messaggio completo",less:"Mostra meno"}
};
function open({conversationId,messages=[],locale="es",onContinue}={}){
 if(typeof conversationId!=="string"||!conversationId||!Array.isArray(messages)||typeof onContinue!=="function")return false;
 if(document.querySelector("[data-xoxo-evidence-beta]"))return false;
 const language=locale==="nb"||locale==="nb-NO"?"no":locale;
 const t=translations[language]||translations[language.split("-")[0]]||translations.en;
 const backdrop=document.createElement("div");backdrop.dataset.xoxoEvidenceBeta="";backdrop.style.cssText="position:fixed;inset:0;z-index:2147483002;box-sizing:border-box;background:#000b;display:grid;place-items:center;padding:12px;padding-top:max(12px,env(safe-area-inset-top));padding-bottom:max(12px,env(safe-area-inset-bottom))";
 const panel=document.createElement("section");panel.style.cssText="box-sizing:border-box;width:min(460px,100%);max-width:100%;max-height:90vh;max-height:90dvh;overflow:auto;overscroll-behavior:contain;background:#170e29;color:#f6edff;border:1px solid #78529c;border-radius:20px;padding:clamp(14px,4vw,22px);font:16px system-ui";panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-labelledby","xoxo-safety-evidence-title");
 const title=document.createElement("h2");title.id="xoxo-safety-evidence-title";title.textContent=t.title;title.style.color="#ffe28a";panel.append(title);
 const help=document.createElement("p");help.textContent=t.help;panel.append(help);
 const items=document.createElement("div");const checkboxes=[];
 const seenIds=new Set();
 // Keep the latest 100 authorized messages so recent abuse is selectable.
 // Normalize UUID casing to prevent the same evidence appearing twice.
 const safeMessages=messages.filter(m=>{
  if(!m||typeof m.id!=="string"||!m.id||typeof m.text!=="string")return false;
  const id=m.id.toLowerCase();
  if(seenIds.has(id))return false;
  seenIds.add(id);return true;
 }).slice(-100);
 for(const m of safeMessages){
  const row=document.createElement("div");
  row.style.cssText="box-sizing:border-box;padding:12px;margin:8px 0;border-radius:10px;background:#302043;overflow-wrap:anywhere";
  const label=document.createElement("label");label.style.cssText="display:flex;align-items:flex-start;gap:10px;cursor:pointer";
  const check=document.createElement("input");check.type="checkbox";check.value=m.id;check.style.cssText="flex:0 0 18px;width:18px;height:18px;margin:2px 0";
  const span=document.createElement("span");
  span.style.cssText="min-width:0;overflow-wrap:anywhere;white-space:pre-wrap";
  span.textContent=m.text.length>240 ? m.text.slice(0,240).trimEnd()+"…" : m.text;
  check.addEventListener("change",()=>{const count=checkboxes.filter(x=>x.checked).length;if(count>20){check.checked=false;notice.textContent=t.limit;}else{notice.textContent="";}});
  label.append(check,span);row.append(label);
  if(m.text.length>240){
   const words=previewLabels[language]||previewLabels.en;
   const details=document.createElement("details");
   details.style.cssText="margin:8px 0 0 28px;color:#f6edff";
   const summary=document.createElement("summary");summary.textContent=words.more;
   summary.style.cssText="color:#ffe28a;cursor:pointer;min-height:28px;overflow-wrap:anywhere";
   const full=document.createElement("p");full.textContent=m.text;
   full.style.cssText="font-size:14px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere";
   details.append(summary,full);
   details.addEventListener("toggle",()=>{summary.textContent=details.open?words.less:words.more;});
   row.append(details);
  }
  items.append(row);checkboxes.push(check);
 }
 if(!safeMessages.length){const empty=document.createElement("p");empty.textContent=t.empty;items.append(empty)}
 panel.append(items);
 const notice=document.createElement("p");notice.setAttribute("role","status");notice.style.color="#ffe28a";panel.append(notice);
 const next=document.createElement("button");next.type="button";next.textContent=t.continue;next.disabled=!safeMessages.length;
 const cancel=document.createElement("button");cancel.type="button";cancel.textContent=t.cancel;
 for(const b of [next,cancel])b.style.cssText="box-sizing:border-box;display:block;width:100%;min-height:44px;padding:11px;border-radius:10px;margin:9px 0 0;white-space:normal;overflow-wrap:anywhere;cursor:pointer";
 next.style.background="#ffda60";next.style.color="#231432";cancel.style.background="#34234b";cancel.style.color="white";
 panel.append(next,cancel);backdrop.append(panel);
 const previous=document.activeElement,oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 function close(){backdrop.remove();document.body.style.overflow=oldOverflow;document.removeEventListener("keydown",keyHandler);if(previous?.isConnected)previous.focus();}
 function keyHandler(e){
  if(e.key==="Escape"){e.preventDefault();close();return;}
  if(e.key==="Tab"){
   const focusable=[...checkboxes,next,cancel].filter(el=>!el.disabled);
   if(!focusable.length)return;
   const i=focusable.indexOf(document.activeElement);
   if(e.shiftKey && i<=0){e.preventDefault();focusable[focusable.length-1].focus();}
   else if(!e.shiftKey && (i<0 || i===focusable.length-1)){
    e.preventDefault();focusable[0].focus();
   }
  }
 }
 cancel.onclick=close;
 next.onclick=()=>{
  const selected=checkboxes.filter(x=>x.checked).map(x=>x.value);
  if(!selected.length){notice.textContent=t.none;return}
  if(selected.length>20){notice.textContent=t.limit;return}
  close();onContinue({conversationId,messageIds:selected});
 };
 document.body.append(backdrop);document.addEventListener("keydown",keyHandler);(checkboxes[0]||cancel).focus();
 return true;
}
window.XOXOEvidencePickerBeta=Object.freeze({open,translations,previewLabels});
})();