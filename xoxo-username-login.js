/* XOXO Avenue — username login (10 languages)
 * Email login and signup remain on the existing Supabase Auth flow.
 * Username login is resolved server-side by the Worker; email addresses are never returned by the lookup endpoint.
 */
(function () {
  'use strict';

  var copy = {
    en: { label: 'Email or username', placeholder: 'you@example.com or @username', invalid: 'Invalid username or password.', network: 'We could not sign you in. Please try again.', success: 'Logged in successfully!' },
    es: { label: 'Correo electrónico o nombre de usuario', placeholder: 'tu@email.com o @usuario', invalid: 'Nombre de usuario o contraseña incorrectos.', network: 'No pudimos iniciar sesión. Inténtalo de nuevo.', success: '¡Sesión iniciada correctamente!' },
    'pt-BR': { label: 'E-mail ou nome de usuário', placeholder: 'voce@email.com ou @usuario', invalid: 'Nome de usuário ou senha incorretos.', network: 'Não foi possível entrar. Tente novamente.', success: 'Login realizado com sucesso!' },
    de: { label: 'E-Mail oder Benutzername', placeholder: 'du@beispiel.de oder @benutzername', invalid: 'Benutzername oder Passwort ungültig.', network: 'Anmeldung nicht möglich. Bitte versuche es erneut.', success: 'Erfolgreich angemeldet!' },
    nb: { label: 'E-post eller brukernavn', placeholder: 'deg@eksempel.no eller @brukernavn', invalid: 'Ugyldig brukernavn eller passord.', network: 'Vi kunne ikke logge deg inn. Prøv igjen.', success: 'Du er logget inn!' },
    pl: { label: 'E-mail lub nazwa użytkownika', placeholder: 'ty@email.com lub @nazwa', invalid: 'Nieprawidłowa nazwa użytkownika lub hasło.', network: 'Nie udało się zalogować. Spróbuj ponownie.', success: 'Zalogowano pomyślnie!' },
    fr: { label: 'E-mail ou nom d’utilisateur', placeholder: 'vous@email.com ou @pseudo', invalid: 'Nom d’utilisateur ou mot de passe incorrect.', network: 'Connexion impossible. Veuillez réessayer.', success: 'Connexion réussie !' },
    cs: { label: 'E-mail nebo uživatelské jméno', placeholder: 'vy@email.cz nebo @jmeno', invalid: 'Nesprávné uživatelské jméno nebo heslo.', network: 'Přihlášení se nezdařilo. Zkuste to znovu.', success: 'Úspěšně přihlášeno!' },
    sv: { label: 'E-post eller användarnamn', placeholder: 'du@email.com eller @användarnamn', invalid: 'Ogiltigt användarnamn eller lösenord.', network: 'Det gick inte att logga in. Försök igen.', success: 'Du är inloggad!' },
    it: { label: 'Email o nome utente', placeholder: 'tu@email.com o @nomeutente', invalid: 'Nome utente o password non validi.', network: 'Impossibile accedere. Riprova.', success: 'Accesso effettuato!' }
  };

  function language() {
    var value = 'en';
    try {
      value = typeof getFriendHubLanguage === 'function'
        ? getFriendHubLanguage()
        : (localStorage.getItem('friendhub_language') || document.documentElement.lang || 'en');
    } catch (_) {}
    value = String(value || 'en').replace('_', '-');
    if (value === 'pt' || value.toLowerCase().indexOf('pt-') === 0) return 'pt-BR';
    if (value === 'no' || value === 'nb' || value.toLowerCase().indexOf('nb-') === 0) return 'nb';
    value = value.toLowerCase();
    return copy[value] ? value : 'en';
  }

  function isSignup() {
    var group = document.getElementById('confirmPasswordGroup');
    return !!group && group.style.display !== 'none';
  }

  function refreshIdentifierField() {
    var input = document.getElementById('authEmail');
    var label = document.querySelector('label[for="authEmail"]');
    if (!input || !label) return;
    var signup = isSignup();
    var strings = copy[language()];
    input.type = signup ? 'email' : 'text';
    input.autocomplete = 'username';
    input.inputMode = 'text';
    label.textContent = signup ? ({
      en: 'Email', es: 'Correo electrónico', 'pt-BR': 'E-mail', de: 'E-Mail',
      nb: 'E-post', pl: 'E-mail', fr: 'E-mail', cs: 'E-mail', sv: 'E-post', it: 'Email'
    })[language()] : strings.label;
    input.placeholder = signup ? 'you@example.com' : strings.placeholder;
  }

  function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  var originalUpdateAuthModal = window.updateAuthModal;
  if (typeof originalUpdateAuthModal === 'function') {
    window.updateAuthModal = function () {
      var result = originalUpdateAuthModal.apply(this, arguments);
      refreshIdentifierField();
      return result;
    };
  }

  ['openAuth', 'toggleAuthMode'].forEach(function (name) {
    var original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function () {
      var result = original.apply(this, arguments);
      refreshIdentifierField();
      return result;
    };
  });

  var originalSubmitAuth = window.submitAuth;
  if (typeof originalSubmitAuth === 'function') {
    window.submitAuth = async function () {
      var field = document.getElementById('authEmail');
      var identifier = String(field && field.value || '').trim();
      if (isSignup() || looksLikeEmail(identifier)) {
        return originalSubmitAuth.apply(this, arguments);
      }

      var password = String((document.getElementById('authPassword') || {}).value || '');
      if (!identifier || !password) {
        showAuthMessage(
          language() === 'es' ? 'Ingresa tu nombre de usuario y contraseña.' :
          language() === 'pt-BR' ? 'Digite seu nome de usuário e senha.' :
          language() === 'de' ? 'Bitte gib deinen Benutzernamen und dein Passwort ein.' :
          language() === 'nb' ? 'Skriv inn brukernavn og passord.' :
          language() === 'pl' ? 'Wpisz nazwę użytkownika i hasło.' :
          language() === 'fr' ? 'Saisissez votre nom d’utilisateur et votre mot de passe.' :
          language() === 'cs' ? 'Zadejte uživatelské jméno a heslo.' :
          language() === 'sv' ? 'Ange användarnamn och lösenord.' :
          language() === 'it' ? 'Inserisci nome utente e password.' :
          language() === 'en' ? 'Please enter your username and password.' :
          'Ingresa tu nombre de usuario y contraseña.',
          'error'
        );
        return;
      }

      var username = identifier.replace(/^@+/, '');
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/.test(username)) {
        showAuthMessage(copy[language()].invalid, 'error');
        return;
      }

      var button = document.getElementById('authSubmitBtn');
      if (button) button.disabled = true;
      try {
        var response = await fetch('/api/auth/username-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ username: username, password: password })
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.access_token || !result.refresh_token) {
          showAuthMessage(response.status === 401 ? copy[language()].invalid : copy[language()].network, 'error');
          return;
        }

        var sessionResult = await supabaseClient.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token
        });
        if (sessionResult.error || !sessionResult.data || !sessionResult.data.user) {
          showAuthMessage(copy[language()].invalid, 'error');
          return;
        }

        currentUser = sessionResult.data.user;
        showAuthMessage(copy[language()].success, 'success');
        setTimeout(async function () {
          closeModal('authModal');
          await loadCurrentProfile();
          await loadPosts();
          await loadNotifications();
          startNotificationRefresh();
          updateAuthUI();
          await openSharedPostFromUrl();
        }, 700);
      } catch (error) {
        console.error('XOXO username sign-in failed:', error);
        showAuthMessage(copy[language()].network, 'error');
      } finally {
        if (button) button.disabled = false;
      }
    };
  }

  document.addEventListener('DOMContentLoaded', refreshIdentifierField);
  var languageSelect = document.getElementById('languageSelect');
  if (languageSelect) languageSelect.addEventListener('change', function () {
    setTimeout(refreshIdentifierField, 0);
  });
  try {
    new MutationObserver(refreshIdentifierField).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    });
  } catch (_) {}
  refreshIdentifierField();
})();
