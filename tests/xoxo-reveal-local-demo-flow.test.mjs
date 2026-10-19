import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../xoxo-reveal-studio-beta.html',import.meta.url),'utf8');
test('local demo requires media before mock delivery and starts receiver card hidden',()=>{
 assert.match(html,/id="localSend"[^>]*disabled/);
 assert.match(html,/card\.hidden=true/);
 assert.match(html,/else if\(!available\)\{send\.disabled=true/);
});
test('mock delivery exposes the receiver reveal only after an explicit click',()=>{
 assert.match(html,/send\.addEventListener\('click'/);
 assert.match(html,/card\.hidden=false/);
 assert.match(html,/card\.scrollIntoView/);
});
test('demo labels distinguish local simulation from real messaging',()=>{
 assert.match(html,/Demostración local: no utiliza cuentas, mensajes reales ni Supabase/);
 assert.match(html,/No se ha enviado nada/);
});

test('a newly selected asset resets the consumed viewer before another mock send',()=>{
 assert.match(html,/previewURL!==lastURL/);
 assert.match(html,/reset\.click\(\)/);
 assert.match(html,/send\.disabled=false/);
});

test('gallery input clears its value after capturing the file so the same file can be selected again',()=>{
 assert.match(html,/const file=e\.target\.files\?\.\[0\]/);
 assert.match(html,/e\.target\.value=''/);
});

test('reveal slider is keyboard focusable and exposes accessible range semantics',()=>{
 assert.match(html,/id="revealTrack" role="slider" tabindex="0"/);
 assert.match(html,/aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"/);
 assert.match(html,/track\.addEventListener\('keydown'/);
 assert.match(html,/e\.key==='ArrowRight'/);
 assert.match(html,/e\.key==='Home'/);
 assert.match(html,/e\.key==='End'/);
});

test('reveal slider updates its accessible percentage and spoken description',()=>{
 assert.match(html,/track\.setAttribute\('aria-valuenow',String\(percent\)\)/);
 assert.match(html,/track\.setAttribute\('aria-valuetext'/);
 assert.match(html,/100 por ciento\. Listo para revelar/);
});

test('reset clears media sources and asynchronous handlers to prevent stale reveal callbacks',()=>{
 assert.match(html,/img\.removeAttribute\('src'\)/);
 assert.match(html,/img\.onload=null/);
 assert.match(html,/video\.onloadeddata=null/);
 assert.match(html,/video\.oncanplay=null/);
 assert.match(html,/dragging=false/);
 assert.match(html,/revealClock'\)\.textContent='●'/);
});
