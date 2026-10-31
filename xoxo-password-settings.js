/* XOXO Avenue — Profile password settings */
(function () {
  "use strict";

  const I18N = {
    en: { change:"🔑 Change password", title:"Change your password", subtitle:"Keep your XOXO Avenue account secure.", current:"Current password", next:"New password", confirm:"Confirm new password", save:"Update password 💜", forgot:"Forgot your current password?", reset:"Send a secure reset link to my email", success:"Your password has been updated successfully.", mismatch:"The new passwords do not match.", short:"Your new password must be at least 8 characters.", required:"Please complete all password fields.", close:"Close", working:"Updating…" },
    es: { change:"🔑 Cambiar contraseña", title:"Cambia tu contraseña", subtitle:"Mantén segura tu cuenta de XOXO Avenue.", current:"Contraseña actual", next:"Nueva contraseña", confirm:"Confirma la nueva contraseña", save:"Actualizar contraseña 💜", forgot:"¿No recuerdas tu contraseña actual?", reset:"Enviar un enlace seguro a mi correo", success:"Tu contraseña se actualizó correctamente.", mismatch:"Las nuevas contraseñas no coinciden.", short:"La nueva contraseña debe tener al menos 8 caracteres.", required:"Completa todos los campos.", close:"Cerrar", working:"Actualizando…" },
    "pt-br": { change:"🔑 Alterar senha", title:"Altere sua senha", subtitle:"Mantenha sua conta XOXO Avenue segura.", current:"Senha atual", next:"Nova senha", confirm:"Confirme a nova senha", save:"Atualizar senha 💜", forgot:"Esqueceu sua senha atual?", reset:"Enviar um link seguro para meu e-mail", success:"Sua senha foi atualizada.", mismatch:"As novas senhas não coincidem.", short:"A nova senha deve ter pelo menos 8 caracteres.", required:"Preencha todos os campos.", close:"Fechar", working:"Atualizando…" },
    de: { change:"🔑 Passwort ändern", title:"Passwort ändern", subtitle:"Schütze dein XOXO Avenue-Konto.", current:"Aktuelles Passwort", next:"Neues Passwort", confirm:"Neues Passwort bestätigen", save:"Passwort aktualisieren 💜", forgot:"Aktuelles Passwort vergessen?", reset:"Sicheren Link per E-Mail senden", success:"Dein Passwort wurde aktualisiert.", mismatch:"Die neuen Passwörter stimmen nicht überein.", short:"Das neue Passwort muss mindestens 8 Zeichen haben.", required:"Bitte alle Felder ausfüllen.", close:"Schließen", working:"Wird aktualisiert…" },
    nb: { change:"🔑 Endre passord", title:"Endre passord", subtitle:"Hold XOXO Avenue-kontoen din sikker.", current:"Nåværende passord", next:"Nytt passord", confirm:"Bekreft nytt passord", save:"Oppdater passord 💜", forgot:"Har du glemt passordet?", reset:"Send en sikker lenke til e-posten min", success:"Passordet er oppdatert.", mismatch:"De nye passordene samsvarer ikke.", short:"Passordet må være minst 8 tegn.", required:"Fyll ut alle feltene.", close:"Lukk", working:"Oppdaterer…" },
    pl: { change:"🔑 Zmień hasło", title:"Zmień hasło", subtitle:"Zadbaj o bezpieczeństwo konta XOXO Avenue.", current:"Obecne hasło", next:"Nowe hasło", confirm:"Potwierdź nowe hasło", save:"Zaktualizuj hasło 💜", forgot:"Nie pamiętasz obecnego hasła?", reset:"Wyślij bezpieczny link na mój e-mail", success:"Hasło zostało zmienione.", mismatch:"Nowe hasła nie są zgodne.", short:"Hasło musi mieć co najmniej 8 znaków.", required:"Uzupełnij wszystkie pola.", close:"Zamknij", working:"Aktualizowanie…" },
    fr: { change:"🔑 Changer le mot de passe", title:"Changer votre mot de passe", subtitle:"Protégez votre compte XOXO Avenue.", current:"Mot de passe actuel", next:"Nouveau mot de passe", confirm:"Confirmer le nouveau mot de passe", save:"Mettre à jour 💜", forgot:"Vous avez oublié votre mot de passe actuel ?", reset:"Envoyer un lien sécurisé par e-mail", success:"Votre mot de passe a été mis à jour.", mismatch:"Les nouveaux mots de passe ne correspondent pas.", short:"Le mot de passe doit contenir au moins 8 caractères.", required:"Veuillez remplir tous les champs.", close:"Fermer", working:"Mise à jour…" },
    cs: { change:"🔑 Změnit heslo", title:"Změnit heslo", subtitle:"Chraňte svůj účet XOXO Avenue.", current:"Současné heslo", next:"Nové heslo", confirm:"Potvrdit nové heslo", save:"Aktualizovat heslo 💜", forgot:"Zapomněli jste současné heslo?", reset:"Poslat bezpečný odkaz na e-mail", success:"Heslo bylo úspěšně změněno.", mismatch:"Nová hesla se neshodují.", short:"Heslo musí mít alespoň 8 znaků.", required:"Vyplňte všechna pole.", close:"Zavřít", working:"Aktualizace…" },
    sv: { change:"🔑 Byt lösenord", title:"Byt lösenord", subtitle:"Håll ditt XOXO Avenue-konto säkert.", current:"Nuvarande lösenord", next:"Nytt lösenord", confirm:"Bekräfta nytt lösenord", save:"Uppdatera lösenord 💜", forgot:"Har du glömt ditt nuvarande lösenord?", reset:"Skicka en säker länk till min e-post", success:"Ditt lösenord har uppdaterats.", mismatch:"De nya lösenorden matchar inte.", short:"Lösenordet måste vara minst 8 tecken.", required:"Fyll i alla fält.", close:"Stäng", working:"Uppdaterar…" },
    it: { change:"🔑 Cambia password", title:"Cambia password", subtitle:"Proteggi il tuo account XOXO Avenue.", current:"Password attuale", next:"Nuova password", confirm:"Conferma nuova password", save:"Aggiorna password 💜", forgot:"Hai dimenticato la password attuale?", reset:"Invia un link sicuro alla mia email", success:"La password è stata aggiornata.", mismatch:"Le nuove password non corrispondono.", short:"La password deve contenere almeno 8 caratteri.", required:"Compila tutti i campi.", close:"Chiudi", working:"Aggiornamento…" }
  };

  function lang() {
    try {
      const raw = (typeof getFriendHubLanguage === "function" ? getFriendHubLanguage() : localStorage.getItem("friendhub_language")) || document.documentElement.lang || "en";
      const value = String(raw).toLowerCase().replace(/_/g, "-");
      if (value.startsWith("pt")) return "pt-br";
      if (value === "no" || value.startsWith("nb")) return "nb";
      const base = value.split("-")[0];
      return I18N[base] ? base : "en";
    } catch (_) { return "en"; }
  }
  function tr(key) { return I18N[lang()][key] || I18N.en[key]; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

  function ensureModal() {
    if (document.getElementById("xoxoPasswordChangeModal")) return;
    const style = document.createElement("style");
    style.id = "xoxoPasswordChangeStyles";
    style.textContent = `
      #xoxoPasswordChangeModal{display:none;position:fixed;inset:0;z-index:10050;background:rgba(22,10,45,.66);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:18px}
      #xoxoPasswordChangeModal.active{display:flex}
      #xoxoPasswordChangeModal .xpc-card{position:relative;width:min(440px,100%);max-height:90vh;overflow:auto;background:linear-gradient(145deg,#fff 0%,#fbf7ff 100%);border:1px solid #eadcff;border-radius:22px;padding:26px;box-shadow:0 24px 80px rgba(62,25,110,.28)}
      #xoxoPasswordChangeModal h2{font-size:22px;color:#51258b;margin:0 34px 6px 0}
      #xoxoPasswordChangeModal .xpc-sub{color:#756781;font-size:14px;margin:0 0 20px}
      #xoxoPasswordChangeModal label{display:block;font-size:13px;font-weight:700;color:#563b70;margin:13px 0 6px}
      #xoxoPasswordChangeModal input{display:block;width:100%;min-height:44px;border:1px solid #ddcbea;border-radius:11px;padding:10px 12px;background:#fff;color:#281b36}
      #xoxoPasswordChangeModal input:focus{outline:2px solid #c8a5f3;border-color:#a66be0}
      #xoxoPasswordChangeModal .xpc-close{position:absolute;right:16px;top:13px;border:0;background:transparent;color:#765b8d;font-size:26px;cursor:pointer}
      #xoxoPasswordChangeModal .xpc-submit{width:100%;margin-top:18px;border:0;border-radius:12px;padding:12px;background:linear-gradient(100deg,#7135b5,#b04fd1);color:#fff;font-weight:800;cursor:pointer}
      #xoxoPasswordChangeModal .xpc-forgot{display:block;margin:14px auto 0;border:0;background:none;color:#7435a8;text-decoration:underline;font-weight:700;cursor:pointer}
      #xoxoPasswordChangeModal .xpc-message{display:none;margin-top:12px;padding:10px 12px;border-radius:10px;font-size:13px}
      #xoxoPasswordChangeModal .xpc-message.show{display:block}
      #xoxoPasswordChangeModal .xpc-message.error{background:#fff0f0;color:#a3223b}
      #xoxoPasswordChangeModal .xpc-message.success{background:#effcf3;color:#17643a}
      #xoxoPasswordChangeModal .xpc-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
      #xoxoPasswordChangeModal .xpc-row .xpc-submit{flex:1}
      @media(max-width:520px){#xoxoPasswordChangeButtons{display:flex!important;gap:8px;flex-wrap:wrap}#xoxoPasswordChangeButtons button{flex:1 1 100%;margin-top:8px!important}}
    `;
    document.head.appendChild(style);
    const modal = document.createElement("div");
    modal.id = "xoxoPasswordChangeModal";
    modal.innerHTML = `
      <div class="xpc-card" role="dialog" aria-modal="true" aria-labelledby="xpcTitle">
        <button type="button" class="xpc-close" id="xpcClose" aria-label="Close">×</button>
        <h2 id="xpcTitle"></h2><p class="xpc-sub" id="xpcSubtitle"></p>
        <form id="xpcForm">
          <label for="xpcCurrent"></label><input id="xpcCurrent" type="password" autocomplete="current-password" required>
          <label for="xpcNew"></label><input id="xpcNew" type="password" autocomplete="new-password" minlength="8" required>
          <label for="xpcConfirm"></label><input id="xpcConfirm" type="password" autocomplete="new-password" minlength="8" required>
          <div id="xpcMessage" class="xpc-message" role="status" aria-live="polite"></div>
          <button class="xpc-submit" id="xpcSubmit" type="submit"></button>
        </form>
        <button type="button" class="xpc-forgot" id="xpcForgot"></button>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById("xpcClose").addEventListener("click", closeModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
    document.getElementById("xpcForgot").addEventListener("click", sendRecovery);
    document.getElementById("xpcForm").addEventListener("submit", submitChange);
    refreshModalText();
  }
  function refreshModalText() {
    const fields = { xpcTitle:"title", xpcSubtitle:"subtitle", xpcSubmit:"save", xpcForgot:"forgot" };
    Object.keys(fields).forEach(id => { const el = document.getElementById(id); if (el) el.textContent = tr(fields[id]); });
    const labels = [["xpcCurrent","current"],["xpcNew","next"],["xpcConfirm","confirm"]];
    labels.forEach(([id,key]) => { const label = document.querySelector('label[for="'+id+'"]'); if (label) label.textContent = tr(key); });
    const close = document.getElementById("xpcClose"); if (close) close.setAttribute("aria-label", tr("close"));
  }
  function showMessage(message, type) {
    const box = document.getElementById("xpcMessage");
    box.textContent = message;
    box.className = "xpc-message show " + type;
  }
  function closeModal() {
    const modal = document.getElementById("xoxoPasswordChangeModal");
    if (modal) modal.classList.remove("active");
  }
  function openModal() {
    ensureModal();
    refreshModalText();
    ["xpcCurrent","xpcNew","xpcConfirm"].forEach(id => { document.getElementById(id).value = ""; });
    const box = document.getElementById("xpcMessage");
    box.textContent = ""; box.className = "xpc-message";
    document.getElementById("xoxoPasswordChangeModal").classList.add("active");
    setTimeout(() => document.getElementById("xpcCurrent").focus(), 40);
  }
  async function submitChange(event) {
    event.preventDefault();
    const current = document.getElementById("xpcCurrent").value;
    const next = document.getElementById("xpcNew").value;
    const confirm = document.getElementById("xpcConfirm").value;
    if (!current || !next || !confirm) return showMessage(tr("required"), "error");
    if (next.length < 8) return showMessage(tr("short"), "error");
    if (next !== confirm) return showMessage(tr("mismatch"), "error");
    if (!window.supabaseClient && typeof supabaseClient === "undefined") return showMessage("Authentication is unavailable. Please reload and try again.", "error");
    const button = document.getElementById("xpcSubmit");
    button.disabled = true; button.textContent = tr("working");
    try {
      const client = typeof supabaseClient !== "undefined" ? supabaseClient : window.supabaseClient;
      const { error } = await client.auth.updateUser({ password: next, current_password: current });
      if (error) throw error;
      showMessage(tr("success"), "success");
      document.getElementById("xpcForm").reset();
      setTimeout(closeModal, 1500);
    } catch (error) {
      const raw = String(error && error.message || "");
      const lower = raw.toLowerCase();
      const message = lower.includes("current") || lower.includes("password") || lower.includes("invalid")
        ? (lang() === "es" ? "La contraseña actual no es correcta o no se pudo verificar. Inténtalo de nuevo o usa la recuperación por correo." : "The current password could not be verified. Try again or use email recovery.")
        : raw;
      showMessage(message, "error");
    } finally {
      button.disabled = false; button.textContent = tr("save");
    }
  }
  function sendRecovery() {
    try {
      if (typeof currentUser === "undefined" || !currentUser || !currentUser.email) {
        showMessage(lang() === "es" ? "No encontramos un correo asociado a esta sesión. Contacta con soporte." : "No email is available for this session. Please contact support.", "error");
        return;
      }
      closeModal();
      if (typeof openResetPassword === "function") {
        openResetPassword();
        const email = document.getElementById("resetEmail");
        if (email) email.value = currentUser.email;
      } else {
        showMessage("Password recovery is unavailable. Please use Forgot Password on the login screen.", "error");
      }
    } catch (error) { console.error("[XOXO password settings]", error); }
  }
  function addButton() {
    const usernameButton = document.getElementById("changeUsernameBtn");
    if (!usernameButton || document.getElementById("xoxoChangePasswordBtn")) return;
    const wrap = document.createElement("div");
    wrap.id = "xoxoPasswordChangeButtons";
    wrap.style.cssText = "display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:10px";
    usernameButton.parentNode.insertBefore(wrap, usernameButton);
    wrap.appendChild(usernameButton);
    usernameButton.style.marginTop = "0";
    const button = document.createElement("button");
    button.type = "button";
    button.id = "xoxoChangePasswordBtn";
    button.className = "btn btn-secondary";
    button.style.cssText = "margin-top:0;white-space:nowrap";
    button.textContent = tr("change");
    button.addEventListener("click", openModal);
    wrap.appendChild(button);
  }
  function boot() {
    ensureModal();
    addButton();
    const observer = new MutationObserver(() => addButton());
    observer.observe(document.body, { childList:true, subtree:true });
    document.addEventListener("click", event => {
      if (event.target.closest("#xoxoChangePasswordBtn")) refreshModalText();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();