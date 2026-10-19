import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

test('browser smoke: select image, simulate delivery, reveal, reset and select again', async () => {
 const browser = await chromium.launch({ headless: true });
 try {
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const html=await readFile(new URL('../xoxo-reveal-studio-beta.html',import.meta.url),'utf8');
  await page.setContent(html,{waitUntil:'load'});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
  const input=page.locator('#file');
  await input.setInputFiles({name:'tiny.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>document.querySelector('#localSend').disabled===false);
  await page.locator('#localSend').click();
  assert.equal(await page.locator('#revealCard').isVisible(),true);
  await page.locator('#revealTrack').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(()=>document.querySelector('#revealViewer').classList.contains('open'));
  assert.equal(await page.locator('#revealImage').isVisible(),true);
  await page.locator('#revealClose').click();
  await page.locator('#revealReset').click();
  await input.setInputFiles({name:'tiny.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>document.querySelector('#localSend').disabled===false);
  assert.deepEqual(errors,[]);
 } finally { await browser.close(); }
});
