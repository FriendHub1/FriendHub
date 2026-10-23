/* XOXO Girl — BETA notification observer and opt-in switch. */
(function (root) {
  'use strict';
  const STORAGE = 'xoxo_girl_seen_v1_';
  const MAX_AGE_MS = 90000;
  const LABELS = {
    es:['🎀 Voz XOXO Girl','Activar anuncios de notificaciones','Probar voz'],
    en:['🎀 XOXO Girl Voice','Speak new notifications','Test voice'],
    'pt-BR':['🎀 Voz XOXO Girl','Anunciar novas notificações','Testar voz'],
    fr:['🎀 Voix XOXO Girl','Annoncer les notifications','Tester la voix'],
    pl:['🎀 Głos XOXO Girl','Ogłaszaj nowe powiadomienia','Testuj głos'],
    de:['🎀 XOXO Girl Stimme','Neue Benachrichtigungen ansagen','Stimme testen'],
    nb:['🎀 XOXO Girl-stemme','Les opp nye varsler','Test stemme'],
    cs:['🎀 Hlas XOXO Girl','Předčítat nová oznámení','Vyzkoušet hlas']
  };
  let userId = null, baseline = false, known = new Set(), startedAt = Date.now();
  const isIgnored = type => /^(?:jewel|jewels|secret_letter|secret_letters|letter|letters)(?:_|$)/i.test(String(type||''));
  function language() {
    try { const x=root.localStorage.getItem('friendhub_language'); return LABELS[x] ? x : 'en'; }
    catch (_) { return 'en'; }
  }
  function readSeen(id) {
    try { const v=JSON.parse(root.sessionStorage.getItem(STORAGE+id)||'[]'); return Array.isArray(v) ? new Set(v.map(String)) : new Set(); }
    catch (_) { return new Set(); }
  }
  function persist() {
    if (!userId) return;
    try { root.sessionStorage.setItem(STORAGE+userId, JSON.stringify(Array.from(known).slice(-500))); } catch (_) {}
  }
  function reset() { userId=null; baseline=false; known.clear(); startedAt=Date.now(); }
  function observe(id, rows) {
    if (!id || !Array.isArray(rows)) return;
    if (userId!==String(id)) {
      reset(); userId=String(id); known=readSeen(userId);
    }
    const incoming=[];
    for (const row of rows) {
      if (!row?.id) continue;
      const key=String(row.id), already=known.has(key);
      known.add(key);
      if (!baseline || already || row.is_read || isIgnored(row.type)) continue;
      const when=Date.parse(row.created_at);
      if (!Number.isFinite(when) || when<startedAt || Date.now()-when>MAX_AGE_MS || when>Date.now()+10000) continue;
      incoming.push(row);
    }
    baseline=true;
    if (known.size>500) known=new Set(Array.from(known).slice(-500));
    persist();
    incoming.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
    for (const row of incoming) root.XOXOGirl?.announce(row.type==='whisper_reply'||row.type==='whisper_reaction'?'whisper':row.type,{id:String(userId)+':'+row.id,lang:language()});
  }
  function render() {
    const panel=root.document.getElementById('notificationPanel');
    if (!panel || root.document.getElementById('xoxoGirlVoiceSettings')) return;
    const text=LABELS[language()];
    const box=root.document.createElement('div');
    box.id='xoxoGirlVoiceSettings';
    box.style.cssText='margin:10px 12px;padding:12px;border:1px solid rgba(214,153,255,.45);border-radius:14px;background:linear-gradient(120deg,rgba(114,30,142,.35),rgba(245,95,183,.13));color:var(--fh-text,#fff)';
    const row=root.document.createElement('label');row.style.cssText='display:flex;align-items:center;gap:10px;justify-content:space-between;cursor:pointer;font-weight:700;font-size:13px';
    const words=root.document.createElement('span');words.textContent=text[0];
    const toggle=root.document.createElement('input');toggle.type='checkbox';toggle.checked=!!root.XOXOGirl?.enabled();toggle.setAttribute('aria-label',text[1]);toggle.style.cssText='width:20px;height:20px;accent-color:#e26af2;flex-shrink:0';
    toggle.addEventListener('change',()=>{root.XOXOGirl?.setEnabled(toggle.checked); if (toggle.checked) root.XOXOGirl?.preview('other',language());});
    row.append(words,toggle);
    const small=root.document.createElement('small');small.textContent=text[1];small.style.cssText='display:block;opacity:.75;margin-top:5px;font-size:11px';
    const test=root.document.createElement('button');test.type='button';test.textContent='♫ '+text[2];test.style.cssText='border:1px solid #bd81e5;color:inherit;background:rgba(165,65,192,.18);border-radius:9px;margin-top:9px;padding:5px 10px;font-size:12px';
    test.addEventListener('click',()=>{if(!root.XOXOGirl?.enabled()){toggle.checked=true;root.XOXOGirl?.setEnabled(true);}root.XOXOGirl?.unlock();root.XOXOGirl?.preview('dm',language());});
    box.append(row,small,test);
    panel.insertBefore(box,panel.querySelector('.notification-tabs')||panel.firstChild);
  }
  root.XOXOGirlBridge=Object.freeze({observe,reset});
  if (root.document.readyState==='loading') root.document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})(window);
