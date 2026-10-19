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

test('browser smoke: one-view reveal cannot be reopened after closing', async () => {
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  const html=await readFile(new URL('../xoxo-reveal-studio-beta.html',import.meta.url),'utf8');
  await page.setContent(html,{waitUntil:'load'});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
  await page.locator('#file').setInputFiles({name:'once.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>!document.querySelector('#localSend').disabled);
  await page.locator('#localSend').click();
  await page.locator('#revealTrack').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(()=>document.querySelector('#revealViewer').classList.contains('open'));
  await page.locator('#revealClose').click();
  assert.match(await page.locator('#revealFeedback').textContent(),/ya vista o caducada/);
  await page.locator('#revealTrack').focus();
  await page.keyboard.press('End');
  assert.equal(await page.locator('#revealViewer').evaluate(el=>el.classList.contains('open')),false);
  assert.match(await page.locator('#revealFeedback').textContent(),/ya vista o caducada/);
 } finally { await browser.close(); }
});

test('browser smoke: timed reveal closes automatically and cannot reopen after expiry', async () => {
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  const html=await readFile(new URL('../xoxo-reveal-studio-beta.html',import.meta.url),'utf8');
  await page.setContent(html,{waitUntil:'load'});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
  await page.locator('.choice[data-choice="5"]').click();
  await page.locator('#file').setInputFiles({name:'timed.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>!document.querySelector('#localSend').disabled);
  await page.locator('#localSend').click();
  await page.locator('#revealTrack').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(()=>document.querySelector('#revealViewer').classList.contains('open'));
  await page.waitForFunction(()=>!document.querySelector('#revealViewer').classList.contains('open'),{timeout:8000});
  assert.match(await page.locator('#revealFeedback').textContent(),/vista o caducada/);
  await page.locator('#revealTrack').focus();
  await page.keyboard.press('End');
  assert.equal(await page.locator('#revealViewer').evaluate(el=>el.classList.contains('open')),false);
 } finally { await browser.close(); }
});

test('browser smoke: Escape closes the reveal viewer and preserves one-view lock', async () => {
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  const html=await readFile(new URL('../xoxo-reveal-studio-beta.html',import.meta.url),'utf8');
  await page.setContent(html,{waitUntil:'load'});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
  await page.locator('#file').setInputFiles({name:'escape.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>!document.querySelector('#localSend').disabled);
  await page.locator('#localSend').click();
  await page.locator('#revealTrack').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(()=>document.querySelector('#revealViewer').classList.contains('open'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#revealViewer').evaluate(el=>el.classList.contains('open')),false);
  await page.locator('#revealTrack').focus();
  await page.keyboard.press('End');
  assert.equal(await page.locator('#revealViewer').evaluate(el=>el.classList.contains('open')),false);
  assert.match(await page.locator('#revealFeedback').textContent(),/ya vista o caducada/);
 } finally { await browser.close(); }
});
