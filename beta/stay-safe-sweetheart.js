/* XOXO Avenue — Stay Safe, Sweetheart! BETA
 * Isolated prototype. Not loaded by production or index.html.
 * Integration must use the existing chat lifecycle and moderation APIs.
 */
(function () {
  "use strict";
  const COPY = {
    en: {title:"Stay Safe, Sweetheart! 💛",intro:"Your safety matters.",money:"Never send money, gift cards or crypto to someone you have not verified.",privacy:"Keep passwords, verification codes and banking details private.",images:"Intimate photos can be saved, shared or used for blackmail. Never feel pressured to send them.",links:"Be careful with suspicious links, fake identities and urgent requests.",support:"You're not alone, sweetheart. You deserve kindness, respect and support. Your feelings matter. Your safety matters. YOU matter. 💛",ack:"Got it, stay safe! 💛"},
    es: {title:"¡Cuídate, cariño! 💛",intro:"Tu seguridad importa.",money:"No envíes dinero, tarjetas regalo ni criptomonedas a personas cuya identidad no has verificado.",privacy:"Protege tus contraseñas, códigos de verificación y datos bancarios.",images:"Las fotos íntimas pueden guardarse, difundirse o usarse para chantajearte. Nunca tienes que enviarlas por presión.",links:"Ten cuidado con enlaces sospechosos, identidades falsas y solicitudes urgentes.",support:"No estás solo, cariño. Mereces respeto, comprensión y apoyo. Tus sentimientos importan. Tu seguridad importa. TÚ importas. 💛",ack:"Entendido, ¡cuídate! 💛"}
  };
  const css = `
.xoxo-safe-backdrop{position:fixed;inset:0;z-index:2147483000;background:#000a;display:grid;place-items:center;padding:16px}
.xoxo-safe-dialog{box-sizing:border-box;max-width:430px;width:100%;max-height:90vh;overflow:auto;background:#160e29;color:#f5ebff;border:1px solid #69478a;border-radius:22px;padding:22px;box-shadow:0 20px 65px #0009;font:inherit}
.xoxo-safe-dialog h2{margin:0 0 8px;color:#ffdc64;font-size:23px}
.xoxo-safe-dialog p{line-height:1.5}
.xoxo-safe-dialog li{margin:10px 0;line-height:1.4}
.xoxo-safe-dialog button{background:#ffda60;color:#24132f;border:0;border-radius:11px;padding:12px 16px;width:100%;font-weight:700;cursor:pointer}
`;
  function show({conversationId, locale="en", accountId, onReport}={}) {
    if (!conversationId || !accountId) return false;
    const key = "xoxo:safety:v1:"+encodeURIComponent(accountId)+":"+encodeURIComponent(conversationId);
    try { if (localStorage.getItem(key)==="seen") return false; } catch {}
    if (document.querySelector(".xoxo-safe-backdrop")) return false;
    const t=COPY[locale]||COPY.en;
    const style=document.createElement("style");style.textContent=css;document.head.append(style);
    const backdrop=document.createElement("div");backdrop.className="xoxo-safe-backdrop";
    const dialog=document.createElement("section");dialog.className="xoxo-safe-dialog";dialog.setAttribute("role","dialog");dialog.setAttribute("aria-modal","true");dialog.setAttribute("aria-labelledby","xoxo-safe-title");
    const heading=document.createElement("h2");heading.id="xoxo-safe-title";heading.textContent=t.title;dialog.append(heading);
    const intro=document.createElement("p");intro.textContent=t.intro;dialog.append(intro);
    const list=document.createElement("ul");
    [t.money,t.privacy,t.images,t.links].forEach(s=>{const li=document.createElement("li");li.textContent=s;list.append(li)});
    dialog.append(list);
    const support=document.createElement("p");support.textContent=t.support;dialog.append(support);
    const close=document.createElement("button");close.type="button";close.textContent=t.ack;
    const previousFocus=document.activeElement;
    function onKeyDown(event){
      if(event.key==="Tab"){event.preventDefault();close.focus();}
      if(event.key==="Escape"){event.preventDefault();dismiss();}
    }
    function dismiss(){try{localStorage.setItem(key,"seen")}catch{} document.removeEventListener("keydown",onKeyDown);backdrop.remove();style.remove();if(previousFocus?.isConnected && typeof previousFocus.focus==="function") previousFocus.focus();}
    close.addEventListener("click",dismiss);dialog.append(close);
    backdrop.append(dialog);document.body.append(backdrop);document.addEventListener("keydown",onKeyDown);close.focus();
    return true;
  }
  window.XOXOSafetyReminderBeta=Object.freeze({show,copy:COPY});
})();
