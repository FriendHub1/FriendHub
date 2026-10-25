/* XOXO Avenue — isolated evidence picker BETA.
 * Caller supplies only messages already authorized and visible to the reporting user.
 * No network requests; callback receives only explicitly selected message IDs.
 */
(function(){
"use strict";
const text={
 es:{title:"Selecciona los mensajes como prueba",help:"Marca únicamente los mensajes que quieras incluir en tu denuncia.",empty:"No hay mensajes disponibles para seleccionar.",continue:"Continuar con la denuncia",cancel:"Cancelar",none:"Selecciona al menos un mensaje.",limit:"Puedes seleccionar hasta 20 mensajes."},
 en:{title:"Select messages as evidence",help:"Choose only the messages you want to include in your report.",empty:"No messages available to select.",continue:"Continue report",cancel:"Cancel",none:"Select at least one message.",limit:"You can select up to 20 messages."}
};
function open({conversationId,messages=[],locale="es",onContinue}={}){
 if(typeof conversationId!=="string"||!conversationId||!Array.isArray(messages)||typeof onContinue!=="function")return false;
 if(document.querySelector("[data-xoxo-evidence-beta]"))return false;
 const t=text[locale]||text[locale.split("-")[0]]||text.en;
 const backdrop=document.createElement("div");backdrop.dataset.xoxoEvidenceBeta="";backdrop.style.cssText="position:fixed;inset:0;z-index:2147483002;background:#000b;display:grid;place-items:center;padding:16px";
 const panel=document.createElement("section");panel.style.cssText="box-sizing:border-box;width:min(460px,100%);max-height:90vh;overflow:auto;background:#170e29;color:#f6edff;border:1px solid #78529c;border-radius:20px;padding:22px;font:16px system-ui";panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
 const title=document.createElement("h2");title.textContent=t.title;title.style.color="#ffe28a";panel.append(title);
 const help=document.createElement("p");help.textContent=t.help;panel.append(help);
 const items=document.createElement("div");const checkboxes=[];
 const safeMessages=messages.filter(m=>m&&typeof m.id==="string"&&typeof m.text==="string").slice(0,100);
 for(const m of safeMessages){
  const label=document.createElement("label");label.style.cssText="display:flex;gap:10px;padding:12px;margin:8px 0;border-radius:10px;background:#302043";
  const check=document.createElement("input");check.type="checkbox";check.value=m.id;
  const span=document.createElement("span");span.textContent=m.text.slice(0,1000);
  label.append(check,span);items.append(label);checkboxes.push(check);
 }
 if(!safeMessages.length){const empty=document.createElement("p");empty.textContent=t.empty;items.append(empty)}
 panel.append(items);
 const notice=document.createElement("p");notice.setAttribute("role","status");notice.style.color="#ffe28a";panel.append(notice);
 const next=document.createElement("button");next.type="button";next.textContent=t.continue;
 const cancel=document.createElement("button");cancel.type="button";cancel.textContent=t.cancel;
 for(const b of [next,cancel])b.style.cssText="padding:11px;border-radius:10px;margin:5px;cursor:pointer";
 next.style.background="#ffda60";next.style.color="#231432";cancel.style.background="#34234b";cancel.style.color="white";
 panel.append(next,cancel);backdrop.append(panel);
 const previous=document.activeElement,oldOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
 function close(){backdrop.remove();document.body.style.overflow=oldOverflow;document.removeEventListener("keydown",keyHandler);if(previous?.isConnected)previous.focus();}
 function keyHandler(e){if(e.key==="Escape"){e.preventDefault();close();}}
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
window.XOXOEvidencePickerBeta=Object.freeze({open});
})();