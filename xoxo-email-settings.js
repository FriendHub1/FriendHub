/* XOXO Avenue — Change email settings, localized in 10 languages */
(function () {
"use strict";
if (window.__xoxoEmailSettingsLoaded) return;
window.__xoxoEmailSettingsLoaded = true;
const T = {
en:{button:"✉️ Change email",title:"Change your email",subtitle:"Update the email address connected to your XOXO Avenue account.",current:"Current email",next:"New email address",confirm:"Confirm new email address",password:"Current password",send:"Send verification email 💌",working:"Sending…",required:"Please complete all fields.",invalid:"Enter a valid email address.",mismatch:"The email addresses do not match.",same:"Your new email must be different from your current email.",success:"Verification email sent! Check your current and new inboxes for confirmation links.",pending:"Your email will not change until the required confirmations are completed.",secure:"Your current email stays active until verification is complete.",close:"Close",error:"We couldn't start the email change. Check your details and try again.",noUser:"We couldn't verify your account. Please sign in again.",passwordError:"The current password is incorrect."},
es:{button:"✉️ Cambiar correo",title:"Cambiar tu correo",subtitle:"Actualiza el correo asociado a tu cuenta de XOXO Avenue.",current:"Correo actual",next:"Nuevo correo electrónico",confirm:"Confirma el nuevo correo",password:"Contraseña actual",send:"Enviar correo de verificación 💌",working:"Enviando…",required:"Completa todos los campos.",invalid:"Introduce un correo electrónico válido.",mismatch:"Los correos electrónicos no coinciden.",same:"El nuevo correo debe ser diferente al actual.",success:"¡Correo de verificación enviado! Revisa el correo actual y el nuevo para confirmar el cambio.",pending:"Tu correo no cambiará hasta completar las confirmaciones necesarias.",secure:"Tu correo actual seguirá activo hasta completar la verificación.",close:"Cerrar",error:"No pudimos iniciar el cambio. Revisa tus datos e inténtalo de nuevo.",noUser:"No pudimos verificar tu cuenta. Inicia sesión nuevamente.",passwordError:"La contraseña actual es incorrecta."},
"pt-br":{button:"✉️ Alterar e-mail",title:"Alterar seu e-mail",subtitle:"Atualize o e-mail associado à sua conta XOXO Avenue.",current:"E-mail atual",next:"Novo endereço de e-mail",confirm:"Confirme o novo e-mail",password:"Senha atual",send:"Enviar e-mail de verificação 💌",working:"Enviando…",required:"Preencha todos os campos.",invalid:"Digite um endereço de e-mail válido.",mismatch:"Os endereços de e-mail não coincidem.",same:"O novo e-mail deve ser diferente do atual.",success:"E-mail de verificação enviado! Confira o e-mail atual e o novo para confirmar a alteração.",pending:"Seu e-mail só será alterado após as confirmações necessárias.",secure:"Seu e-mail atual continuará ativo até a verificação ser concluída.",close:"Fechar",error:"Não foi possível iniciar a alteração. Confira os dados e tente novamente.",noUser:"Não foi possível verificar sua conta. Entre novamente.",passwordError:"A senha atual está incorreta."},
de:{button:"✉️ E-Mail ändern",title:"E-Mail-Adresse ändern",subtitle:"Aktualisiere die E-Mail-Adresse deines XOXO Avenue-Kontos.",current:"Aktuelle E-Mail",next:"Neue E-Mail-Adresse",confirm:"Neue E-Mail-Adresse bestätigen",password:"Aktuelles Passwort",send:"Bestätigungs-E-Mail senden 💌",working:"Wird gesendet…",required:"Bitte fülle alle Felder aus.",invalid:"Bitte gib eine gültige E-Mail-Adresse ein.",mismatch:"Die E-Mail-Adressen stimmen nicht überein.",same:"Die neue E-Mail-Adresse muss sich von der aktuellen unterscheiden.",success:"Bestätigungs-E-Mail gesendet! Prüfe dein aktuelles und neues E-Mail-Postfach.",pending:"Deine E-Mail-Adresse wird erst nach den erforderlichen Bestätigungen geändert.",secure:"Deine aktuelle E-Mail-Adresse bleibt bis zum Abschluss der Verifizierung aktiv.",close:"Schließen",error:"Die Änderung konnte nicht gestartet werden. Bitte überprüfe deine Angaben.",noUser:"Dein Konto konnte nicht verifiziert werden. Bitte melde dich erneut an.",passwordError:"Das aktuelle Passwort ist falsch."},
nb:{button:"✉️ Endre e-post",title:"Endre e-postadresse",subtitle:"Oppdater e-postadressen som er knyttet til XOXO Avenue-kontoen din.",current:"Nåværende e-post",next:"Ny e-postadresse",confirm:"Bekreft ny e-postadresse",password:"Nåværende passord",send:"Send bekreftelses-e-post 💌",working:"Sender…",required:"Fyll ut alle feltene.",invalid:"Skriv inn en gyldig e-postadresse.",mismatch:"E-postadressene samsvarer ikke.",same:"Den nye e-postadressen må være forskjellig fra den nåværende.",success:"Bekreftelses-e-post sendt! Sjekk både den nåværende og den nye innboksen.",pending:"E-postadressen endres først etter nødvendige bekreftelser.",secure:"Den nåværende e-postadressen forblir aktiv til bekreftelsen er fullført.",close:"Lukk",error:"Vi kunne ikke starte endringen. Kontroller opplysningene og prøv igjen.",noUser:"Vi kunne ikke bekrefte kontoen din. Logg inn på nytt.",passwordError:"Nåværende passord er feil."},
pl:{button:"✉️ Zmień e-mail",title:"Zmień adres e-mail",subtitle:"Zaktualizuj adres e-mail powiązany z kontem XOXO Avenue.",current:"Obecny e-mail",next:"Nowy adres e-mail",confirm:"Potwierdź nowy adres e-mail",password:"Obecne hasło",send:"Wyślij e-mail weryfikacyjny 💌",working:"Wysyłanie…",required:"Uzupełnij wszystkie pola.",invalid:"Wpisz prawidłowy adres e-mail.",mismatch:"Adresy e-mail nie są zgodne.",same:"Nowy adres musi być inny niż obecny.",success:"Wysłano e-mail weryfikacyjny! Sprawdź obecną i nową skrzynkę pocztową.",pending:"Adres e-mail zmieni się dopiero po wymaganych potwierdzeniach.",secure:"Obecny adres pozostanie aktywny do zakończenia weryfikacji.",close:"Zamknij",error:"Nie udało się rozpocząć zmiany. Sprawdź dane i spróbuj ponownie.",noUser:"Nie udało się zweryfikować konta. Zaloguj się ponownie.",passwordError:"Obecne hasło jest nieprawidłowe."},
fr:{button:"✉️ Changer l’e-mail",title:"Changer votre adresse e-mail",subtitle:"Mettez à jour l’adresse e-mail associée à votre compte XOXO Avenue.",current:"E-mail actuel",next:"Nouvelle adresse e-mail",confirm:"Confirmer la nouvelle adresse e-mail",password:"Mot de passe actuel",send:"Envoyer l’e-mail de vérification 💌",working:"Envoi…",required:"Veuillez remplir tous les champs.",invalid:"Veuillez saisir une adresse e-mail valide.",mismatch:"Les adresses e-mail ne correspondent pas.",same:"La nouvelle adresse doit être différente de l’adresse actuelle.",success:"E-mail de vérification envoyé ! Consultez vos boîtes de réception actuelle et nouvelle.",pending:"L’adresse ne changera qu’après les confirmations nécessaires.",secure:"Votre adresse actuelle reste active jusqu’à la fin de la vérification.",close:"Fermer",error:"Impossible de commencer le changement. Vérifiez vos informations et réessayez.",noUser:"Impossible de vérifier votre compte. Veuillez vous reconnecter.",passwordError:"Le mot de passe actuel est incorrect."},
cs:{button:"✉️ Změnit e-mail",title:"Změnit e-mailovou adresu",subtitle:"Aktualizujte e-mail propojený s účtem XOXO Avenue.",current:"Současný e-mail",next:"Nová e-mailová adresa",confirm:"Potvrdit novou e-mailovou adresu",password:"Současné heslo",send:"Odeslat ověřovací e-mail 💌",working:"Odesílání…",required:"Vyplňte všechna pole.",invalid:"Zadejte platnou e-mailovou adresu.",mismatch:"E-mailové adresy se neshodují.",same:"Nová adresa se musí lišit od současné.",success:"Ověřovací e-mail byl odeslán! Zkontrolujte současnou i novou e-mailovou schránku.",pending:"E-mail se změní až po dokončení potřebných potvrzení.",secure:"Současná adresa zůstane aktivní až do dokončení ověření.",close:"Zavřít",error:"Změnu se nepodařilo zahájit. Zkontrolujte údaje a zkuste to znovu.",noUser:"Účet se nepodařilo ověřit. Přihlaste se znovu.",passwordError:"Současné heslo není správné."},
sv:{button:"✉️ Byt e-postadress",title:"Byt e-postadress",subtitle:"Uppdatera e-postadressen som är kopplad till ditt XOXO Avenue-konto.",current:"Nuvarande e-post",next:"Ny e-postadress",confirm:"Bekräfta ny e-postadress",password:"Nuvarande lösenord",send:"Skicka verifieringsmejl 💌",working:"Skickar…",required:"Fyll i alla fält.",invalid:"Ange en giltig e-postadress.",mismatch:"E-postadresserna matchar inte.",same:"Den nya adressen måste skilja sig från den nuvarande.",success:"Verifieringsmejl skickat! Kontrollera både din nuvarande och nya inkorg.",pending:"E-postadressen ändras först efter nödvändiga bekräftelser.",secure:"Din nuvarande adress förblir aktiv tills verifieringen är slutförd.",close:"Stäng",error:"Det gick inte att starta ändringen. Kontrollera uppgifterna och försök igen.",noUser:"Vi kunde inte verifiera ditt konto. Logga in igen.",passwordError:"Det nuvarande lösenordet är felaktigt."},
it:{button:"✉️ Cambia email",title:"Cambia il tuo indirizzo email",subtitle:"Aggiorna l’indirizzo email collegato al tuo account XOXO Avenue.",current:"Email attuale",next:"Nuovo indirizzo email",confirm:"Conferma il nuovo indirizzo email",password:"Password attuale",send:"Invia email di verifica 💌",working:"Invio…",required:"Compila tutti i campi.",invalid:"Inserisci un indirizzo email valido.",mismatch:"Gli indirizzi email non corrispondono.",same:"Il nuovo indirizzo deve essere diverso da quello attuale.",success:"Email di verifica inviata! Controlla la casella attuale e quella nuova.",pending:"L’indirizzo cambierà solo dopo le conferme necessarie.",secure:"L’indirizzo attuale resterà attivo fino al completamento della verifica.",close:"Chiudi",error:"Non è stato possibile avviare la modifica. Controlla i dati e riprova.",noUser:"Non è stato possibile verificare il tuo account. Accedi di nuovo.",passwordError:"La password attuale non è corretta."}
};
function language(){try{let v=(typeof getFriendHubLanguage==="function"?getFriendHubLanguage():localStorage.getItem("friendhub_language"))||document.documentElement.lang||"en";v=String(v).toLowerCase().replace(/_/g,"-");if(v.startsWith("pt"))return "pt-br";if(v==="no"||v.startsWith("nb"))return "nb";return T[v.split("-")[0]]?v.split("-")[0]:"en";}catch(_){return "en";}}
const tr=k=>T[language()][k]||T.en[k];
function client(){return window.supabaseClient||(typeof supabaseClient!=="undefined"?supabaseClient:null);}
function ensureModal(){
if(document.getElementById("xoxoEmailChangeModal"))return;
const css=[
"#xoxoEmailChangeModal{display:none;position:fixed;inset:0;z-index:10060;background:rgba(22,10,45,.66);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:18px}",
"#xoxoEmailChangeModal.active{display:flex}",
"#xoxoEmailChangeModal .xec-card{position:relative;width:min(440px,100%);max-height:90vh;overflow:auto;background:linear-gradient(145deg,#fff 0%,#fbf7ff 100%);border:1px solid #eadcff;border-radius:22px;padding:26px;box-shadow:0 24px 80px rgba(62,25,110,.28)}",
"#xoxoEmailChangeModal h2{font-size:22px;color:#51258b;margin:0 34px 6px 0}",
"#xoxoEmailChangeModal .xec-sub{color:#756781;font-size:14px;margin:0 0 20px}",
"#xoxoEmailChangeModal label{display:block;font-size:13px;font-weight:700;color:#563b70;margin:13px 0 6px}",
"#xoxoEmailChangeModal input{display:block;width:100%;min-height:44px;border:1px solid #ddcbea;border-radius:11px;padding:10px 12px;background:#fff;color:#281b36;box-sizing:border-box}",
"#xoxoEmailChangeModal input:focus{outline:2px solid #c8a5f3;border-color:#a66be0}",
"#xoxoEmailChangeModal .xec-close{position:absolute;right:16px;top:13px;border:0;background:transparent;color:#765b8d;font-size:26px;cursor:pointer}",
"#xoxoEmailChangeModal .xec-submit{width:100%;margin-top:18px;border:0;border-radius:12px;padding:13px;background:#EC4899;color:#fff;font-weight:800;cursor:pointer}",
"#xoxoEmailChangeModal .xec-submit:disabled{opacity:.65;cursor:wait}",
"#xoxoEmailChangeModal .xec-message{display:none;margin-top:12px;padding:12px;border-radius:11px;font-size:13px;line-height:1.5}",
"#xoxoEmailChangeModal .xec-message.show{display:block}",
"#xoxoEmailChangeModal .xec-message.error{background:#fff0f0;color:#a3223b}",
"#xoxoEmailChangeModal .xec-message.success{background:#DCFCE7;color:#166534;border:1px solid #bbf7d0}",
"#xoxoEmailChangeModal .xec-note{margin:12px 0 0;padding:11px 12px;border-radius:10px;background:#f4effb;color:#695579;font-size:12px;line-height:1.45}",
"@media(max-width:520px){#xoxoEmailChangeModal .xec-card{padding:22px}}"
].join("");
const style=document.createElement("style");style.id="xoxoEmailChangeStyles";style.textContent=css;document.head.appendChild(style);
const modal=document.createElement("div");modal.id="xoxoEmailChangeModal";
modal.innerHTML='<div class="xec-card" role="dialog" aria-modal="true" aria-labelledby="xecTitle"><button type="button" class="xec-close" id="xecClose">×</button><h2 id="xecTitle"></h2><p class="xec-sub" id="xecSubtitle"></p><form id="xecForm" novalidate><label for="xecCurrentEmail"></label><input id="xecCurrentEmail" type="email" readonly><label for="xecNewEmail"></label><input id="xecNewEmail" type="email" autocomplete="email" required><label for="xecConfirmEmail"></label><input id="xecConfirmEmail" type="email" autocomplete="email" required><label for="xecPassword"></label><input id="xecPassword" type="password" autocomplete="current-password" required><div class="xec-note" id="xecNote"></div><div id="xecMessage" class="xec-message" role="status" aria-live="polite"></div><button class="xec-submit" id="xecSubmit" type="submit"></button></form></div>';
document.body.appendChild(modal);
document.getElementById("xecClose").addEventListener("click",closeModal);
modal.addEventListener("click",e=>{if(e.target===modal)closeModal();});
document.getElementById("xecForm").addEventListener("submit",submitChange);refreshText();
}
function refreshText(){
const map={xecTitle:"title",xecSubtitle:"subtitle",xecSubmit:"send",xecNote:"secure"};
Object.keys(map).forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=tr(map[id]);});
[["xecCurrentEmail","current"],["xecNewEmail","next"],["xecConfirmEmail","confirm"],["xecPassword","password"]].forEach(([id,k])=>{const el=document.querySelector('label[for="'+id+'"]');if(el)el.textContent=tr(k);});
const close=document.getElementById("xecClose");if(close)close.setAttribute("aria-label",tr("close"));
}
function message(s,type){const el=document.getElementById("xecMessage");el.textContent=s;el.className="xec-message show "+type;}
function closeModal(){const el=document.getElementById("xoxoEmailChangeModal");if(el)el.classList.remove("active");}
async function openModal(){
ensureModal();refreshText();const c=client();if(!c)return;
const {data,error}=await c.auth.getUser();
if(error||!data?.user?.email){document.getElementById("xoxoEmailChangeModal").classList.add("active");message(tr("noUser"),"error");return;}
document.getElementById("xecCurrentEmail").value=data.user.email;
["xecNewEmail","xecConfirmEmail","xecPassword"].forEach(id=>document.getElementById(id).value="");
const m=document.getElementById("xecMessage");m.textContent="";m.className="xec-message";
document.getElementById("xoxoEmailChangeModal").classList.add("active");setTimeout(()=>document.getElementById("xecNewEmail").focus(),40);
}
async function submitChange(e){
e.preventDefault();
const old=document.getElementById("xecCurrentEmail").value.trim(),next=document.getElementById("xecNewEmail").value.trim().toLowerCase(),confirm=document.getElementById("xecConfirmEmail").value.trim().toLowerCase(),password=document.getElementById("xecPassword").value;
if(!old||!next||!confirm||!password)return message(tr("required"),"error");
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next))return message(tr("invalid"),"error");
if(next!==confirm)return message(tr("mismatch"),"error");
if(next===old.toLowerCase())return message(tr("same"),"error");
const c=client();if(!c)return message(tr("noUser"),"error");
const btn=document.getElementById("xecSubmit");btn.disabled=true;btn.textContent=tr("working");
try{
const {data,error}=await c.auth.getUser();if(error||!data?.user?.id||!data.user.email)throw new Error("NO_AUTH_USER");
const check=await c.auth.signInWithPassword({email:data.user.email,password});
if(check.error||!check.data?.user||check.data.user.id!==data.user.id)throw new Error("CURRENT_PASSWORD_INVALID");
const {error:updateError}=await c.auth.updateUser({email:next});if(updateError)throw updateError;
message(tr("success")+" "+tr("pending"),"success");document.getElementById("xecForm").reset();document.getElementById("xecCurrentEmail").value=old;
}catch(err){
const raw=String(err?.message||""),low=raw.toLowerCase();
if(raw==="CURRENT_PASSWORD_INVALID"||low.includes("invalid login credentials")||low.includes("invalid_credentials"))message(tr("passwordError"),"error");
else if(raw==="NO_AUTH_USER")message(tr("noUser"),"error");
else message(tr("error")+(raw&&raw!=="Error"?" "+raw:""),"error");
}finally{btn.disabled=false;btn.textContent=tr("send");}
}
function addButton(){
if(document.getElementById("xoxoChangeEmailBtn"))return;
const userBtn=document.getElementById("changeUsernameBtn");if(!userBtn||!userBtn.parentNode)return;
const b=document.createElement("button");b.type="button";b.id="xoxoChangeEmailBtn";b.className="btn btn-secondary";b.style.cssText="margin-top:0;white-space:nowrap";b.textContent=tr("button");b.addEventListener("click",openModal);
const wrap=document.getElementById("xoxoPasswordChangeButtons");
if(wrap)wrap.appendChild(b);else userBtn.parentNode.insertBefore(b,userBtn.nextSibling);
}
function boot(){ensureModal();addButton();new MutationObserver(addButton).observe(document.body,{childList:true,subtree:true});document.addEventListener("click",e=>{if(e.target.closest("#xoxoChangeEmailBtn"))refreshText();});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();