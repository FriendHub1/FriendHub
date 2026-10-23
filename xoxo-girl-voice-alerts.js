/* XOXO Girl voice alerts — BETA. No automatic activation. */
(function (root) {
  'use strict';
  const KEY = 'xoxo_voice_alerts_enabled';
  const PHRASES = {
    es: {dm:'Pssst… alguien quiere robarte una sonrisa.',like:'Mmm… parece que le gustó lo que publicaste.',comment:'Oye, belleza… alguien tiene algo que decirte.',follow:'Uy, uy… alguien quiere conocerte.',repost:'¡Mira nada más! Alguien compartió tu publicación.',whisper:'Shhh… tienes un nuevo susurro.',other:'Pssst… tienes una notificación nueva en XOXO Avenue.'},
    en: {dm:'Psst… someone wants to make you smile.',like:'Mmm… someone liked your post.',comment:'Hey, gorgeous… someone left you a comment.',follow:'Ooh… someone wants to know you better.',repost:'Look at that! Someone shared your post.',whisper:'Shh… a new whisper is waiting.',other:'Psst… you have a new XOXO Avenue notification.'},
    'pt-BR': {dm:'Psiu… alguém quer arrancar um sorriso seu.',like:'Hmm… alguém curtiu sua publicação.',comment:'Ei, lindura… alguém comentou sua publicação.',follow:'Olha só… alguém quer te conhecer.',repost:'Alguém compartilhou sua publicação!',whisper:'Shhh… chegou um novo sussurro.',other:'Psiu… você tem uma nova notificação no XOXO Avenue.'},
    fr: {dm:'Psst… quelqu’un veut te faire sourire.',like:'Mmm… quelqu’un aime ta publication.',comment:'Coucou, beauté… tu as un nouveau commentaire.',follow:'Oh là là… quelqu’un veut te connaître.',repost:'Quelqu’un a partagé ta publication !',whisper:'Chut… un nouveau murmure t’attend.',other:'Psst… tu as une nouvelle notification sur XOXO Avenue.'},
    pl: {dm:'Psst… ktoś chce wywołać twój uśmiech.',like:'Mmm… komuś spodobał się twój post.',comment:'Hej, piękna osobo… masz nowy komentarz.',follow:'Oho… ktoś chce cię lepiej poznać.',repost:'Ktoś udostępnił twój post!',whisper:'Ciii… czeka na ciebie nowy szept.',other:'Psst… masz nowe powiadomienie w XOXO Avenue.'},
    de: {dm:'Psst… jemand möchte dich zum Lächeln bringen.',like:'Mmm… jemandem gefällt dein Beitrag.',comment:'Hey, du Schöne… du hast einen neuen Kommentar.',follow:'Oh… jemand möchte dich kennenlernen.',repost:'Jemand hat deinen Beitrag geteilt!',whisper:'Psst… ein neues Flüstern wartet auf dich.',other:'Psst… du hast eine neue Benachrichtigung bei XOXO Avenue.'},
    nb: {dm:'Psst… noen vil få deg til å smile.',like:'Mmm… noen likte innlegget ditt.',comment:'Hei, vakre deg… du har fått en kommentar.',follow:'Oi… noen vil bli bedre kjent med deg.',repost:'Noen delte innlegget ditt!',whisper:'Hysj… en ny hvisking venter på deg.',other:'Psst… du har et nytt varsel på XOXO Avenue.'},
    cs: {dm:'Psst… někdo ti chce vykouzlit úsměv.',like:'Hmm… někomu se líbí tvůj příspěvek.',comment:'Ahoj, krásko… máš nový komentář.',follow:'Jé… někdo tě chce poznat.',repost:'Někdo sdílel tvůj příspěvek!',whisper:'Pššt… čeká na tebe nový šepot.',other:'Psst… máš nové oznámení na XOXO Avenue.'}
  };
  const EXCLUDED = new Set(['jewel','jewels','secret_letter','secret_letters','letter','letters']);
  const ALIASES = {message:'dm',direct_message:'dm',dm:'dm',likes:'like',liked:'like',comments:'comment',reply:'comment',follower:'follow',new_follower:'follow',reposts:'repost',whispers:'whisper'};
  const queue = [];
  const seen = new Set();
  let speaking = false, lastAnnounced = 0, audioContext = null;
  function enabled() { try { return root.localStorage.getItem(KEY) === 'true'; } catch (_) { return false; } }
  function setEnabled(value) { try { root.localStorage.setItem(KEY, String(Boolean(value))); } catch (_) {} if (!value) { queue.length = 0; root.speechSynthesis?.cancel(); speaking = false; } return enabled(); }
  function normalizeLang(lang) { const l = String(lang || root.document?.documentElement?.lang || 'en').toLowerCase(); if (l.startsWith('pt')) return 'pt-BR'; if (l.startsWith('no') || l.startsWith('nb')) return 'nb'; return Object.keys(PHRASES).find(k => k.toLowerCase() === l) || l.split('-')[0] in PHRASES && l.split('-')[0] || 'en'; }
  function pickVoice(lang) {
    const voices = root.speechSynthesis?.getVoices?.() || [];
    const matching = voices.filter(v => v.lang?.toLowerCase().startsWith(lang.toLowerCase().split('-')[0]));
    return matching.find(v => /samantha|victoria|karen|moira|amelie|anna|paulina|luciana|female|femina|maria|sofia|zuzana/i.test(v.name)) || matching[0] || null;
  }
  function chime() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    try {
      audioContext ||= new AC();
      if (audioContext.state !== 'running') return;
      const t = audioContext.currentTime;
      [659.25, 783.99, 987.77].forEach((freq, i) => {
        const osc = audioContext.createOscillator(), gain = audioContext.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        const start = t + i * 0.11;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.055, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(start); osc.stop(start + 0.47);
      });
    } catch (_) { /* Audio unavailable: speech can still work. */ }
  }
  function drain() {
    if (speaking || !enabled() || !queue.length || !root.speechSynthesis) return;
    const item = queue.shift();
    speaking = true;
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = item.lang;
    utterance.rate = 0.92; utterance.pitch = 1.13; utterance.volume = 0.85;
    const voice = pickVoice(item.lang); if (voice) utterance.voice = voice;
    const done = () => { speaking = false; drain(); };
    utterance.onend = done; utterance.onerror = done;
    chime();
    try { root.speechSynthesis.speak(utterance); } catch (_) { done(); }
  }
  function announce(type, opts = {}) {
    if (!enabled() || !root.speechSynthesis || root.document?.hidden) return false;
    const raw = String(type || 'other').toLowerCase();
    if (EXCLUDED.has(raw)) return false;
    const kind = ALIASES[raw] || raw;
    const lang = normalizeLang(opts.lang);
    const id = opts.id == null ? null : String(opts.id);
    if (id && seen.has(id)) return false;
    if (id) { seen.add(id); if (seen.size > 300) seen.delete(seen.values().next().value); }
    const text = (PHRASES[lang] || PHRASES.en)[kind] || PHRASES[lang].other;
    const now = Date.now();
    if (now - lastAnnounced < 1200 && queue.length > 2) return false;
    lastAnnounced = now;
    queue.push({text,lang}); drain(); return true;
  }
  function preview(type = 'dm', lang) { return announce(type, {lang}); }
  root.XOXOGirl = Object.freeze({announce,preview,enabled,setEnabled,phrases:PHRASES});
})(window);
