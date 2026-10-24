/* XOXO Girl BETA integration adapter. Loaded only when explicitly included in index.html. */
(function () {
  'use strict';
  const labels = {
    en:['XOXO Girl voice alerts','Play a sample'],
    es:['Avisos de voz de XOXO Girl','Escuchar prueba'],
    'pt-BR':['Alertas de voz XOXO Girl','Ouvir exemplo'],
    fr:['Alertes vocales XOXO Girl','Écouter un exemple'],
    pl:['Powiadomienia głosowe XOXO Girl','Odtwórz próbkę'],
    de:['XOXO Girl Sprachmeldungen','Beispiel anhören'],
    nb:['XOXO Girl talevarsler','Spill av prøve'],
    cs:['Hlasová upozornění XOXO Girl','Přehrát ukázku'],
    sv:['XOXO Girl röstaviseringar','Spela upp exempel'],
    it:['Avvisi vocali XOXO Girl','Ascolta un esempio']
  };
  const key = 'xoxo_girl_seen_notification_ids_v1';
  let userId = null, primed = false, seen = new Set(), lastCheck = 0;
  const language = () => { try { return localStorage.getItem('friendhub_language') || 'en'; } catch (_) { return 'en'; } };
  const excluded = /^(?:jewel|jewels|secret_letter|secret_letters|letter|letters)(?:_|$)/i;
  const kind = type => {
    const t = String(type || '').toLowerCase();
    if (excluded.test(t)) return null;
    if (t === 'whisper_reaction' || t === 'whisper_reply' || t === 'whisper') return 'whisper';
    if (t === 'message' || t === 'direct_message') return 'dm';
    return ['like','comment','follow','repost','dm'].includes(t) ? t : 'other';
  };
  function persist() {
    if (!userId) return;
    try { sessionStorage.setItem(key + ':' + userId, JSON.stringify([...seen].slice(-250))); } catch (_) {}
  }
  function setUser(id) {
    const next = id ? String(id) : null;
    if (next === userId) return;
    userId = next; primed = false; lastCheck = 0; seen = new Set();
    try { seen = new Set(JSON.parse(sessionStorage.getItem(key + ':' + userId) || '[]')); } catch (_) {}
  }
  function receive(items, id) {
    setUser(id);
    if (!userId || !Array.isArray(items)) return;
    const now = Date.now();
    const first = !primed;
    primed = true;
    for (const item of items) {
      const notificationId = String(item?.id || '');
      if (!notificationId || seen.has(notificationId)) continue;
      seen.add(notificationId);
      // First load establishes a baseline; stale notifications never play.
      if (first || !item?.created_at || now - Date.parse(item.created_at) > 90000 || item.is_read) continue;
      const category = kind(item.type);
      if (category) window.XOXOGirl?.announce(category, { id: userId + ':' + notificationId, lang: language() });
    }
    if (seen.size > 300) seen = new Set([...seen].slice(-250));
    persist(); lastCheck = now;
  }
  function renderToggle() {
    if (document.getElementById('xoxo-girl-toggle')) return;
    const host = document.querySelector('#notificationPanel .notification-panel-header') || document.querySelector('#notificationPanel') || document.querySelector('[id*=notificationPanel]') || document.body;
    if (!host || !window.XOXOGirl) return;
    const row = document.createElement('div');
    row.id = 'xoxo-girl-toggle';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #7865ad;background:#25134b;color:#fff;flex-wrap:wrap';
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:9px;flex:1;cursor:pointer;font-weight:600';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = window.XOXOGirl.enabled();
    checkbox.setAttribute('aria-label','XOXO Girl');
    const caption = document.createElement('span');
    label.append(checkbox,caption);
    const sample = document.createElement('button');
    sample.type = 'button';
    sample.style.cssText = 'border:1px solid #e3b8ff;border-radius:12px;background:#6b319d;color:white;padding:6px 10px';
    function translate() {
      const words = labels[language()] || labels.en;
      caption.textContent = '🎀 ' + words[0];
      sample.textContent = words[1];
    }
    checkbox.addEventListener('change', () => {
      window.XOXOGirl.setEnabled(checkbox.checked);
      // A direct user gesture allows browsers to unlock their audio engines.
      window.XOXOGirl.unlock?.();
      if (checkbox.checked) window.XOXOGirl.preview('other',language());
    });
    sample.addEventListener('click', () => {
      if (!checkbox.checked) return;
      window.XOXOGirl.unlock?.();
      window.XOXOGirl.preview('dm',language());
    });
    sample.disabled = !checkbox.checked;
    checkbox.addEventListener('change', () => { sample.disabled = !checkbox.checked; });
    const voiceSelect = document.createElement('select');
    voiceSelect.setAttribute('aria-label','XOXO Girl voice');
    voiceSelect.style.cssText = 'max-width:100%;border:1px solid #e3b8ff;border-radius:9px;background:#341b5c;color:white;padding:6px;';
    function refreshVoices() {
      const current = window.XOXOGirl.getPreferredVoice?.() || '';
      const available = window.XOXOGirl.availableVoices?.(language()) || [];
      voiceSelect.replaceChildren();
      const auto = new Option('🎙️ Auto voice',''); voiceSelect.add(auto);
      available.forEach(v => voiceSelect.add(new Option(v.name + ' (' + v.lang + ')',v.name)));
      voiceSelect.value = available.some(v => v.name === current) ? current : '';
    }
    voiceSelect.addEventListener('change', () => window.XOXOGirl.setPreferredVoice?.(voiceSelect.value));
    row.append(label,voiceSelect,sample);
    refreshVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged',refreshVoices);
    if (host === document.body) {
      row.style.position = 'fixed'; row.style.right = '12px'; row.style.bottom = '12px'; row.style.zIndex = '2147483000'; row.style.maxWidth = '360px';
      host.append(row);
    } else if (host.id === 'notificationPanel') {
      host.prepend(row);
    } else {
      host.after(row);
    }
    translate();
    document.addEventListener('change', translate);
    document.addEventListener('xoxo-language-changed', () => { translate(); refreshVoices(); });
  }
  window.XOXOGirlIntegration = Object.freeze({ receive, setUser, renderToggle });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',renderToggle,{once:true});
  else renderToggle();
})();
