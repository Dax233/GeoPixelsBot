// Local fake page only. All non-loopback traffic and all bot network APIs are denied.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const beforePath=process.argv[2];
const output=process.argv[3] || `${root}/docs/screenshots`;
mkdirSync(output,{recursive:true});
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="fr"><head><title>GhostPixel — page factice locale</title></head><body style="background:#cbd5e1"><div id="g_id_onload"></div><div id="controls-left"></div></body></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}`;
const executable=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let browser;
const results=[];
try {
 browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})});
 for(const [name,path,lang,width] of [
   ...(beforePath?[['before',beforePath,'zh-CN',1280]]:[]),
   ['fr',`${root}/ghostBot.user.js`,'fr-FR',1280],
   ['en',`${root}/ghostBot.user.js`,'en-US',1280],
   ['zh',`${root}/ghostBot.user.js`,'zh-CN',1280],
   ['fr-narrow',`${root}/ghostBot.user.js`,'fr-FR',390],
 ]) {
  const context=await browser.newContext({viewport:{width,height:900},locale:lang});
  const page=await context.newPage(); let external=0; const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin===url)return route.continue();
    external++;return route.abort();
  });
  await page.goto(url);
  await page.evaluate(()=>{
    window.unsafeWindow=window; window.GM_info={script:{version:'0.4.3'}};
    window.maxEnergy=200;window.Colors=[];window.ghostImage=null;window.ghostImageOriginalData=null;window.ghostImageTopLeft=null;
    window.__networkCalls=0;
    const deny=()=>{window.__networkCalls++;throw new Error('Network forbidden in local preview');};
    window.fetch=deny;window.XMLHttpRequest=deny;window.WebSocket=deny;window.synchronize=deny;
  });
  const source=readFileSync(path,'utf8');
  const instrumented=name==='before'?source:source.replace(/\}\)\(\);\s*$/,`
    window.__displayTest = { updateGuiStatus, showCompletionNotification, setLanguage, setRunning(v) { isRunning=v; } };
  })();`);
  await page.addScriptTag({content:instrumented});
  await page.locator('#ghostBot-launcher').click();
  await page.locator('#ghostBot-gui-panel').waitFor({state:'visible'});
  if(name!=='before') {
   await page.evaluate(()=>{
    window.__displayTest.setRunning(true);
    window.ghostBotGui.updateProgress({total:2261547,remaining:2261547-2954,placed:100,sessionStart:Date.now()-100000});
    window.ghostBotGui.updateFixCount(2954);
    window.__displayTest.updateGuiStatus('充能中... | (10/200) [Req: 200]','#1982c4','⏳');
   });
   const overflows=await page.locator('#ghostBot-gui-panel').evaluate(panel=>{
     const rect=panel.getBoundingClientRect();
     return [...panel.querySelectorAll('.gb-label, .gb-btn, .gb-stat-val, #gb-status-text, #stats-eta')]
      .filter(el=>el.getClientRects().length && (el.scrollWidth>el.clientWidth+2 || el.getBoundingClientRect().right>rect.right+1))
      .map(el=>({text:el.textContent,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
   });
   assert.deepEqual(overflows,[],`${name}: text overflow`);
   const panelRect=await page.locator('#ghostBot-gui-panel').boundingBox();
   assert.ok(panelRect.x+panelRect.width<=width,`${name}: panel outside viewport`);
   await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
   await page.selectOption('#bot-language-select','en'); await page.selectOption('#bot-language-select','fr');
   assert.equal(await page.locator('#btn-start').textContent(),'Démarrer');
   const configBefore=await page.evaluate(()=>localStorage.getItem('ghostBotConfig_v2'));
   assert.equal(await page.evaluate(()=>window.__networkCalls),0);
   assert.deepEqual(errors,[]);
   results.push({name,viewport:width,overflows,configBefore,externalRequests:external,errors});
  } else {await page.screenshot({path:`${output}/before.png`,fullPage:true});results.push({name,externalRequests:external,errors});}
  // No Start click and no real API surface has been used.
  await context.close();
 }
 const after=results.filter(r=>r.name!=='before');
 assert.ok(after.every(r=>r.externalRequests===0));
 writeFileSync(`${output}/results.json`,JSON.stringify({browser:await browser.version(),results},null,2)+'\n');
 console.log(JSON.stringify({browser:await browser.version(),results},null,2));
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
