import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../xoxo-reveal-studio-beta.html',import.meta.url),'utf8');
test('local demo requires media before mock delivery and starts receiver card hidden',()=>{
 assert.match(html,/id="localSend"[^>]*disabled/);
 assert.match(html,/card\.hidden=true/);
 assert.match(html,/send\.disabled=!available/);
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
