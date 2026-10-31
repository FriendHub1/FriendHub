/* XOXO Avenue — guest-accessible support chat. Authenticated users keep the original flow. */
(function(){
  "use strict";
  const TOKEN_KEY="xoxo_guest_support_token_v1";
  const LANG={
    en:{email:"Your email address",emailHint:"We'll use this email to reply to you.",name:"Name (optional)",send:"Send",sending:"Sending…",first:"Write your message to XOXO Avenue Support.",welcome:"Your message was sent. We'll reply by email and here.",case:"Support case",empty:"Send a message to XOXO Avenue Support.",error:"We couldn't send your message. Please try again.",needEmail:"Enter a valid email address so we can reply.",closed:"This case is closed. Please start a new message.",attach:"Attachments are available after signing in."},
    es:{email:"Tu correo electrónico",emailHint:"Usaremos este correo para responderte.",name:"Nombre (opcional)",send:"Enviar",sending:"Enviando…",first:"Escribe tu mensaje al soporte de XOXO Avenue.",welcome:"Tu mensaje fue enviado. Te responderemos por correo y aquí.",case:"Caso de soporte",empty:"Envía un mensaje al soporte de XOXO Avenue.",error:"No pudimos enviar tu mensaje. Inténtalo de nuevo.",needEmail:"Escribe un correo válido para poder responderte.",closed:"Este caso está cerrado. Inicia un mensaje nuevo.",attach:"Para adjuntar imágenes, inicia sesión."},
    "pt-BR":{email:"Seu endereço de e-mail",emailHint:"Usaremos este e-mail para responder.",name:"Nome (opcional)",send:"Enviar",sending:"Enviando…",first:"Escreva sua mensagem para o suporte XOXO Avenue.",welcome:"Sua mensagem foi enviada. Responderemos por e-mail e aqui.",case:"Chamado de suporte",empty:"Envie uma mensagem ao suporte XOXO Avenue.",error:"Não foi possível enviar. Tente novamente.",needEmail:"Digite um e-mail válido para receber nossa resposta.",closed:"Este chamado foi encerrado. Inicie uma nova mensagem.",attach:"Entre na sua conta para anexar imagens."},
    de:{email:"Deine E-Mail-Adresse",emailHint:"Wir verwenden diese Adresse für unsere Antwort.",name:"Name (optional)",send:"Senden",sending:"Wird gesendet…",first:"Schreibe eine Nachricht an den XOXO Avenue Support.",welcome:"Deine Nachricht wurde gesendet. Wir antworten per E-Mail und hier.",case:"Supportfall",empty:"Sende eine Nachricht an den XOXO Avenue Support.",error:"Nachricht konnte nicht gesendet werden. Bitte erneut versuchen.",needEmail:"Gib eine gültige E-Mail-Adresse ein.",closed:"Dieser Fall ist geschlossen. Bitte starte eine neue Nachricht.",attach:"Melde dich an, um Bilder anzuhängen."},
    no:{email:"E-postadressen din",emailHint:"Vi bruker denne adressen til å svare deg.",name:"Navn (valgfritt)",send:"Send",sending:"Sender…",first:"Skriv en melding til XOXO Avenue Support.",welcome:"Meldingen er sendt. Vi svarer på e-post og her.",case:"Supportsak",empty:"Send en melding til XOXO Avenue Support.",error:"Meldingen kunne ikke sendes. Prøv igjen.",needEmail:"Skriv inn en gyldig e-postadresse.",closed:"Denne saken er lukket. Start en ny melding.",attach:"Logg inn for å legge ved bilder."},
    pl:{email:"Twój adres e-mail",emailHint:"Użyjemy go, aby Ci odpowiedzieć.",name:"Imię (opcjonalnie)",send:"Wyślij",sending:"Wysyłanie…",first:"Napisz wiadomość do pomocy XOXO Avenue.",welcome:"Wiadomość została wysłana. Odpowiemy e-mailem i tutaj.",case:"Zgłoszenie pomocy",empty:"Wyślij wiadomość do pomocy XOXO Avenue.",error:"Nie udało się wysłać wiadomości. Spróbuj ponownie.",needEmail:"Wpisz prawidłowy adres e-mail.",closed:"To zgłoszenie jest zamknięte. Rozpocznij nową wiadomość.",attach:"Zaloguj się, aby załączać obrazy."},
    fr:{email:"Votre adresse e-mail",emailHint:"Nous l'utiliserons pour vous répondre.",name:"Nom (facultatif)",send:"Envoyer",sending:"Envoi…",first:"Écrivez au support XOXO Avenue.",welcome:"Votre message a été envoyé. Nous répondrons par e-mail et ici.",case:"Demande d'assistance",empty:"Envoyez un message au support XOXO Avenue.",error:"Envoi impossible. Veuillez réessayer.",needEmail:"Saisissez une adresse e-mail valide.",closed:"Cette demande est close. Commencez un nouveau message.",attach:"Connectez-vous pour joindre des images."},
    cs:{email:"Tvá e-mailová adresa",emailHint:"Použijeme ji k odpovědi.",name:"Jméno (nepovinné)",send:"Odeslat",sending:"Odesílání…",first:"Napiš zprávu podpoře XOXO Avenue.",welcome:"Zpráva byla odeslána. Odpovíme e-mailem i zde.",case:"Požadavek podpory",empty:"Napiš zprávu podpoře XOXO Avenue.",error:"Zprávu se nepodařilo odeslat. Zkus to znovu.",needEmail:"Zadej platnou e-mailovou adresu.",closed:"Tento požadavek je uzavřen. Začni novou zprávu.",attach:"Pro přiložení obrázků se přihlas."},
    sv:{email:"Din e-postadress",emailHint:"Vi använder adressen för att svara dig.",name:"Namn (valfritt)",send:"Skicka",sending:"Skickar…",first:"Skriv ett meddelande till XOXO Avenue Support.",welcome:"Ditt meddelande har skickats. Vi svarar via e-post och här.",case:"Supportärende",empty:"Skicka ett meddelande till XOXO Avenue Support.",error:"Meddelandet kunde inte skickas. Försök igen.",needEmail:"Ange en giltig e-postadress.",closed:"Ärendet är stängt. Starta ett nytt meddelande.",attach:"Logga in för att bifoga bilder."},
    it:{email:"Il tuo indirizzo e-mail",emailHint:"Lo useremo per risponderti.",name:"Nome (facoltativo)",send:"Invia",sending:"Invio…",first:"Scrivi al supporto XOXO Avenue.",welcome:"Il messaggio è stato inviato. Risponderemo via e-mail e qui.",case:"Richiesta di supporto",empty:"Invia un messaggio al supporto XOXO Avenue.",error:"Invio non riuscito. Riprova.",needEmail:"Inserisci un indirizzo e-mail valido.",closed:"Questa richiesta è chiusa. Inizia un nuovo messaggio.",attach:"Accedi per allegare immagini."}
  };
  function lang(){let x=localStorage.getItem("friendhub_language")||document.documentElement.lang||"en";if(x==="nb")x="no";if(x==="pt-br")x="pt-BR";return LANG[x]?x:"en";}
  function tr(k){return LANG[lang()][k]||LANG.en[k];}
  const DELIVERY={
    en:{admin:"Your message was saved, but the support notification email could not be sent. Please email xoxoavenuesupport@gmail.com.",confirm:"Your message was saved, but the confirmation email could not be sent."},
    es:{admin:"Tu mensaje se guardó, pero no se pudo enviar el aviso al soporte. Escribe a xoxoavenuesupport@gmail.com.",confirm:"Tu mensaje se guardó, pero no se pudo enviar el correo de confirmación."},
    "pt-BR":{admin:"Sua mensagem foi salva, mas não foi possível avisar o suporte por e-mail. Escreva para xoxoavenuesupport@gmail.com.",confirm:"Sua mensagem foi salva, mas o e-mail de confirmação não pôde ser enviado."},
    de:{admin:"Deine Nachricht wurde gespeichert, aber die Support-Benachrichtigung konnte nicht gesendet werden. Schreibe an xoxoavenuesupport@gmail.com.",confirm:"Deine Nachricht wurde gespeichert, aber die Bestätigungs-E-Mail konnte nicht gesendet werden."},
    no:{admin:"Meldingen er lagret, men e-postvarselet til brukerstøtte kunne ikke sendes. Skriv til xoxoavenuesupport@gmail.com.",confirm:"Meldingen er lagret, men bekreftelses-e-posten kunne ikke sendes."},
    pl:{admin:"Wiadomość została zapisana, ale nie udało się wysłać powiadomienia do pomocy. Napisz na xoxoavenuesupport@gmail.com.",confirm:"Wiadomość została zapisana, ale nie udało się wysłać potwierdzenia e-mailem."},
    fr:{admin:"Votre message a été enregistré, mais l'e-mail d'alerte au support n'a pas pu être envoyé. Écrivez à xoxoavenuesupport@gmail.com.",confirm:"Votre message a été enregistré, mais l'e-mail de confirmation n'a pas pu être envoyé."},
    cs:{admin:"Zpráva byla uložena, ale e-mailové upozornění podpory se nepodařilo odeslat. Napiš na xoxoavenuesupport@gmail.com.",confirm:"Zpráva byla uložena, ale potvrzovací e-mail se nepodařilo odeslat."},
    sv:{admin:"Meddelandet sparades, men e-postaviseringen till supporten kunde inte skickas. Skriv till xoxoavenuesupport@gmail.com.",confirm:"Meddelandet sparades, men bekräftelsemejlet kunde inte skickas."},
    it:{admin:"Il messaggio è stato salvato, ma non è stato possibile inviare la notifica al supporto. Scrivi a xoxoavenuesupport@gmail.com.",confirm:"Il messaggio è stato salvato, ma non è stato possibile inviare l'e-mail di conferma."}
  };
  function token(){try{return localStorage.getItem(TOKEN_KEY)||"";}catch(_){return "";}}
  function saveToken(v){try{localStorage.setItem(TOKEN_KEY,v);}catch(_){}}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  async function api(method,body){
    const t=token(),headers={};
    if(!(body instanceof FormData))headers["Content-Type"]="application/json";
    if(t)headers["X-Xoxo-Support-Token"]=t;
    const r=await fetch("/api/support-guest",{method,headers,body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});
    let data={};try{data=await r.json();}catch(_){}
    if(!r.ok)throw new Error(data.error||tr("error"));
    return data;
  }
  async function signedIn(){
    try{if(typeof supabaseClient==="undefined")return false;const {data,error}=await supabaseClient.auth.getUser();return !error&&!!data?.user?.id;}catch(_){return false;}
  }
  function panel(){return document.getElementById("supportChatPanel");}
  function feedback(msg,bad){const e=document.getElementById("supportChatFeedback");if(e){e.textContent=msg||"";e.style.color=bad?"#ff9baf":"";}}
  function ensureEmailFields(){
    const compose=document.querySelector("#supportChatPanel .support-chat-compose");if(!compose)return;
    let wrap=document.getElementById("xoxoGuestSupportContact");
    if(!wrap){
      wrap=document.createElement("div");wrap.id="xoxoGuestSupportContact";
      wrap.style.cssText="display:grid;gap:5px;width:100%;margin:0 0 10px";
      wrap.innerHTML='<input id="xoxoGuestSupportName" maxlength="80" autocomplete="name" style="width:100%;box-sizing:border-box;border:1px solid var(--fh-border,#8050aa);border-radius:12px;padding:11px 13px;background:var(--fh-surface,#17122d);color:var(--fh-text,#fff)" />' +
        '<input id="xoxoGuestSupportEmail" type="email" maxlength="254" autocomplete="email" required style="width:100%;box-sizing:border-box;border:1px solid var(--fh-border,#8050aa);border-radius:12px;padding:11px 13px;background:var(--fh-surface,#17122d);color:var(--fh-text,#fff)" />' +
        '<small id="xoxoGuestSupportHint" style="opacity:.78"></small><input id="xoxoGuestSupportWebsite" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px" />';
      compose.parentNode.insertBefore(wrap,compose);
    }
    const name=document.getElementById("xoxoGuestSupportName"),email=document.getElementById("xoxoGuestSupportEmail"),hint=document.getElementById("xoxoGuestSupportHint");
    name.placeholder=tr("name");email.placeholder=tr("email");hint.textContent=tr("emailHint");
    wrap.hidden=!!token();
    const attach=document.querySelector("#supportChatPanel .support-chat-attach");if(attach){attach.hidden=false;attach.title=tr("attach");attach.setAttribute("aria-label",tr("attach"));}
    const fileInput=document.getElementById("supportAttachmentInput");
    if(fileInput){fileInput.accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm";fileInput.multiple=false;if(!fileInput.dataset.guestBound){fileInput.dataset.guestBound="1";fileInput.addEventListener("change",()=>{const f=fileInput.files?.[0],preview=document.getElementById("supportAttachmentPreview");if(!f)return;const image=["image/jpeg","image/png","image/webp","image/gif"].includes(f.type),video=["video/mp4","video/quicktime","video/webm"].includes(f.type);if(!image&&!video){feedback("Choose JPG, PNG, WebP, GIF, MP4, MOV or WebM.",true);fileInput.value="";return;}if(f.size>(image?10:30)*1024*1024){feedback(image?"Images can be up to 10 MB.":"Videos can be up to 30 MB.",true);fileInput.value="";return;}if(preview){const url=URL.createObjectURL(f);preview.innerHTML=(image?'<img src="'+url+'" alt="Selected attachment">':'<video src="'+url+'" controls></video>')+'<button type="button" class="support-attachment-remove" aria-label="Remove attachment">×</button>';preview.classList.add("show");preview.querySelector("button")?.addEventListener("click",()=>{URL.revokeObjectURL(url);fileInput.value="";preview.innerHTML="";preview.classList.remove("show");});}feedback("Attachment ready. Add a message or press Send.");});}}
    const input=document.getElementById("supportChatInput");if(input)input.placeholder=tr("first");
  }
  function setCase(c){
    window.xoxoSupportActiveCase=c?{id:c.id,case_number:c.case_number,status:c.status,guest:true}:null;
    window.xoxoSupportUnreadCount=0;
    const label=document.getElementById("supportCaseLabel");if(label)label.textContent=c?tr("case")+" #"+c.case_number:tr("empty");
    const summary=document.getElementById("supportActiveCaseSummary");if(summary){summary.textContent=c?"#"+c.case_number:"";summary.classList.toggle("show",!!c);}
    if(typeof window.renderXoxoSupportButton==="function")window.renderXoxoSupportButton();
  }
  function renderMessages(rows){
    const box=document.getElementById("supportChatMessages");if(!box)return;
    box.innerHTML="";
    if(!rows?.length){box.innerHTML='<div class="support-chat-empty">'+esc(tr("empty"))+'</div>';return;}
    for(const m of rows){
      const div=document.createElement("div");div.className="support-chat-message "+(m.sender_type==="admin"?"admin":"user");
      div.textContent=m.message||"";
      if(m.attachment_signed_url){const media=document.createElement(m.attachment_type==="video"?"video":"img");media.src=m.attachment_signed_url;if(m.attachment_type==="video"){media.controls=true;media.playsInline=true;}else media.alt="Support attachment";media.style.cssText="display:block;max-width:100%;max-height:260px;border-radius:12px;margin-top:8px";div.appendChild(media);}
      const time=document.createElement("span");time.className="support-chat-time";time.textContent=m.created_at?new Date(m.created_at).toLocaleString():"";div.appendChild(time);box.appendChild(div);
    }
    box.scrollTop=box.scrollHeight;
  }
  async function loadGuest(){
    const t=token();if(!t){setCase(null);ensureEmailFields();return null;}
    try{
      const data=await api("GET");setCase(data.support_case);renderMessages(data.messages);ensureEmailFields();return data;
    }catch(e){
      if(/not found|session/i.test(e.message)){try{localStorage.removeItem(TOKEN_KEY);}catch(_){}setCase(null);ensureEmailFields();return null;}
      feedback(e.message,true);return null;
    }
  }
  async function openGuest(){
    const p=panel();if(!p)return;p.classList.add("open");feedback("");ensureEmailFields();
    await loadGuest();
    const input=document.getElementById("supportChatInput");if(input)input.focus();
    if(window.__xoxoGuestSupportPoll)clearInterval(window.__xoxoGuestSupportPoll);
    window.__xoxoGuestSupportPoll=setInterval(()=>{if(document.visibilityState!=="hidden"&&p.classList.contains("open")&&token())loadGuest();},5000);
  }
  async function sendGuest(){
    const input=document.getElementById("supportChatInput"),button=document.getElementById("supportChatSendBtn");if(!input||!button)return;
    const message=input.value.trim(),file=document.getElementById("supportAttachmentInput")?.files?.[0]||null;if(!message&&!file){feedback(tr("first"),true);return;}
    button.disabled=true;button.textContent=tr("sending");feedback("");
    try{
      let data;
      if(!token()){
        const email=document.getElementById("xoxoGuestSupportEmail")?.value.trim()||"";
        const name=document.getElementById("xoxoGuestSupportName")?.value.trim()||"";
        const website=document.getElementById("xoxoGuestSupportWebsite")?.value||"";
        const form=new FormData();form.set("action","create");form.set("email",email);form.set("name",name);form.set("message",message);form.set("website",website);if(file)form.set("attachment",file,file.name);data=await api("POST",form);
        if(data.token)saveToken(data.token);
        setCase(data.support_case);
      }else{
        const form=new FormData();form.set("action","message");form.set("message",message);if(file)form.set("attachment",file,file.name);data=await api("POST",form);
      }
      input.value="";const fileInput=document.getElementById("supportAttachmentInput"),preview=document.getElementById("supportAttachmentPreview");if(fileInput)fileInput.value="";if(preview){preview.innerHTML="";preview.classList.remove("show");}
      await loadGuest();
      const delivery=DELIVERY[lang()]||DELIVERY.en;
      feedback(data.admin_notified===false?delivery.admin:(data.confirmation_sent===false?delivery.confirm:tr("welcome")),data.admin_notified===false);
    }catch(e){feedback(e.message||tr("error"),true);}
    finally{button.disabled=false;button.textContent=tr("send");}
  }
  function install(){
    const originalOpen=window.openXoxoSupportChat,originalSend=window.sendXoxoSupportMessage;
    // Capture the actual UI actions before the legacy inline handlers can redirect guests to login.
    document.addEventListener("click",async function(event){
      const start=event.target?.closest?.("#supportChatStartBtn");
      const send=event.target?.closest?.("#supportChatSendBtn");
      if(!start&&!send)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(await signedIn()){
        if(start&&typeof originalOpen==="function")return originalOpen.apply(window,[]);
        if(send&&typeof originalSend==="function")return originalSend.apply(window,[]);
        return;
      }
      if(start)return openGuest();
      return sendGuest();
    },true);
    const input=document.getElementById("supportChatInput");
    if(input)input.addEventListener("keydown",async function(e){
      if(e.key!=="Enter"||e.shiftKey)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if(await signedIn()){
        if(typeof originalSend==="function")return originalSend.apply(window,[]);
        return;
      }
      if(!token()&&!document.getElementById("xoxoGuestSupportEmail")?.value.trim()){feedback(tr("needEmail"),true);return;}
      return sendGuest();
    },true);
    window.openXoxoSupportChat=async function(){if(await signedIn())return originalOpen?.apply(this,arguments);return openGuest();};
    window.sendXoxoSupportMessage=async function(){if(await signedIn())return originalSend?.apply(this,arguments);return sendGuest();};
    const button=document.getElementById("supportChatSendBtn");if(button)button.textContent=tr("send");
    if(typeof window.loadXoxoAdminSupportCases==="function"){
      const originalLoad=window.loadXoxoAdminSupportCases;
      window.loadXoxoAdminSupportCases=async function(){const result=await originalLoad.apply(this,arguments);try{const {data:u}=await supabaseClient.auth.getUser();if(u?.user?.id!=="d9ea1914-fdba-465c-9700-5e640ff48763")return result;const {data:cases}=await supabaseClient.from("support_cases").select("case_number,guest_email").not("guest_email","is",null);for(const c of cases||[]){const card=[...document.querySelectorAll("#xoxoAdminSupportCases .xoxo-support-case")].find(el=>el.textContent.includes("Support case #"+c.case_number));const meta=card?.querySelector(".xoxo-admin-meta");if(meta)meta.textContent="Guest · "+c.guest_email;}}catch(e){console.warn("Guest support admin labels",e);}return result;};
      const originalOpenCase=window.openXoxoAdminSupportCase;
      if(originalOpenCase)window.openXoxoAdminSupportCase=async function(id){const result=await originalOpenCase.apply(this,arguments);try{const {data:u}=await supabaseClient.auth.getUser();if(u?.user?.id!=="d9ea1914-fdba-465c-9700-5e640ff48763")return result;const {data:c}=await supabaseClient.from("support_cases").select("guest_email,guest_name,user_id").eq("id",id).maybeSingle();if(c&&!c.user_id){const head=document.querySelector("#xoxoAdminSupportConversation .xoxo-support-chat-head");if(head){const p=document.createElement("div");p.className="xoxo-admin-meta";p.textContent="Guest · "+(c.guest_name?c.guest_name+" · ":"")+c.guest_email;head.appendChild(p);}const profile=document.querySelector("#xoxoAdminSupportConversation button[onclick='openXoxoSupportUserProfile()']");if(profile)profile.hidden=true;}}catch(e){console.warn("Guest support details",e);}return result;};
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
