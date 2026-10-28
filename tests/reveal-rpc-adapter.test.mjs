import test from 'node:test';
import assert from 'node:assert/strict';
test('RPC mock returns preparation and session independently', async () => {
  const rpc = async name => ({ data: name === 'prepare' ? [{preparation_id:'demo'}] : [{session_id:'demo'}], error:null });
  assert.equal((await rpc('prepare')).data[0].preparation_id,'demo');
  assert.equal((await rpc('start')).data[0].session_id,'demo');
});
