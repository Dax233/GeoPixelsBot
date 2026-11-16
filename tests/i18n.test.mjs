import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'acorn';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { setup, source, visibleStrings } from './helpers.mjs';
const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
const cleanSpace = s => s.replace(/[\u00a0\u202f]/g, ' ');

test('all 63 keys have en/fr/zh translations and identical placeholders', () => {
  const { ui, dom } = setup();
  assert.equal(Object.keys(ui.MESSAGES).length, 63);
  for (const [key, entry] of Object.entries(ui.MESSAGES)) for (const lang of ['en', 'fr', 'zh']) {
    assert.equal(typeof entry[lang], 'string', `${key}.${lang}`);
    assert.ok(entry[lang].length, `${key}.${lang}`);
    assert.deepEqual(placeholders(entry[lang]), placeholders(entry.en), key);
    if (lang === 'fr') assert.doesNotMatch(entry.fr, /\p{Script=Han}/u, key);
  }
  for (const [, key] of ui.messagePatterns) assert.ok(ui.MESSAGES[key]);
  dom.window.close();
});

test('French panel, tooltips and accessibility labels have no Chinese or untranslated English', () => {
  const { w, dom } = setup(); const text = visibleStrings(w);
  assert.doesNotMatch(text, /\p{Script=Han}/u);
  assert.doesNotMatch(text, /\b(Start|Stop|Build|Maintain|Charging|Energy Threshold|Place Free Colors|Audio Alerts|Progress|ETA|Settings)\b/);
  for (const expected of ['Démarrer', 'Arrêter', 'Mode construction', 'Mode maintenance', 'Progression', 'Seuil d’énergie', 'Temps restant estimé']) assert.ok(text.includes(expected), expected);
  assert.equal(w.document.getElementById('ghostBot-gui-panel').lang, 'fr');
  for (const el of w.document.querySelectorAll('[data-gb-title]')) assert.equal(el.getAttribute('aria-label'), el.title);
  dom.window.close();
});

test('dynamic status, notifications and legacy diagnostics route through French translations', () => {
  const { w, ui, dom, logs } = setup();
  const cases = [
    ['充能中... | (10/200) [Req: 200]', 'Recharge en cours'],
    ['正在绘制 2954 个点 (批次 2)...', 'Placement de 2 954 pixels (lot 2)'],
    ['等待数据...', 'En attente des données'], ['Ghost 图未加载', 'Image fantôme non chargée'],
    ['画作已完成！', 'Construction terminée'], ['监控中... 画面完美', 'Surveillance'],
    ['已登出', 'Déconnecté'], ['已停止', 'Arrêté'],
    ['Max energy synced: 200', 'Énergie maximale actualisée'],
    ['Filtered ghost pixels. Total: 2261547', 'Pixels retenus'],
    ['Rate limited (429). Waiting 5000ms...', 'Limite de requêtes atteinte'],
    ['Starting Ghost Bot in [BUILD] mode...', 'Mode construction'],
    ['Starting Ghost Bot in [MAINTAIN] mode...', 'Mode maintenance'],
    ['Failed to place pixels: detail', 'Échec du placement des pixels'],
    ['Invalid hex color: #oops', 'Couleur hexadécimale incorrecte'],
  ];
  for (const [raw, expected] of cases) {
    const text = cleanSpace(ui.translateMessage(raw));
    assert.ok(text.includes(expected), `${raw} => ${text}`);
    assert.doesNotMatch(text, /\p{Script=Han}/u);
    ui.updateGuiStatus(raw);
    assert.equal(w.document.getElementById('gb-status-text').innerText, ui.translateMessage(raw));
  }
  for (const [key, entry] of Object.entries(ui.MESSAGES)) if (entry.source) assert.equal(ui.translateMessage(entry.source), entry.fr, key);
  ui.showCompletionNotification('GhostPixel Bot: 建造完成！');
  assert.match(w.document.querySelector('.gb-notification').innerText, /construction terminée/);
  assert.ok(logs.some(row => row.join(' ').includes('chargé.')));
  assert.equal(ui.translateMessage('Opaque upstream payload'), 'Opaque upstream payload');
  dom.window.close();
});

test('missing translation falls back to English; unknown and prototype keys are safe', () => {
  const { ui, dom } = setup();
  delete ui.MESSAGES.start.fr;
  assert.equal(ui.t('start'), 'Start');
  assert.equal(ui.t('unknown'), 'unknown');
  assert.equal(ui.t('__proto__'), '__proto__');
  ui.setLanguage('unsupported'); assert.equal(ui.getLanguage(), 'en');
  dom.window.close();
});

test('automatic language selection, saved choice, and blocked storage work', () => {
  for (const [opts, lang] of [[{locale:'fr-FR'},'fr'],[{locale:'zh-TW'},'zh'],[{locale:'en-US'},'en'],[{locale:'pl-PL'},'en'],[{savedLanguage:'zh'},'zh'],[{savedLanguage:'invalid'},'fr'],[{storageBlocked:true},'fr'],[{config:'broken JSON'},'fr']]) {
    const { ui, dom } = setup(opts); assert.equal(ui.getLanguage(), lang); ui.setLanguage('en'); dom.window.close();
  }
});

test('changing language keeps all existing settings, controls, listeners and running presentation', () => {
  const config = { energyThreshold:37, maxEnergyLimit:123, mode:'maintain', placeFree:false, placeTransparent:true, audioAlert:true, extraSetting:'retain' };
  const { w, ui, dom } = setup({config});
  const before = w.localStorage.getItem('ghostBotConfig_v2');
  const button = w.document.getElementById('btn-start');
  w.ghostBotGui.setRunning(true);
  const picker = w.document.getElementById('bot-language-select'); picker.value='en'; picker.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(ui.getLanguage(),'en'); assert.equal(w.localStorage.getItem('ghostBotLanguage_v1'),'en');
  assert.equal(w.localStorage.getItem('ghostBotConfig_v2'),before);
  assert.equal(w.document.getElementById('btn-start'),button); assert.equal(button.disabled,true);
  assert.equal(w.document.getElementById('energy-threshold-input').value,'37');
  assert.equal(w.ghostBot.config.extraSetting,'retain');
  ui.setLanguage('fr');
  const audio = w.document.getElementById('chk-audio'); audio.checked=false; audio.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.ghostBot.config.audioAlert,false); assert.equal(w.ghostBot.config.mode,'maintain');
  dom.window.close();
});

test('French counts and percentages use locale formatting while CSS keeps a decimal point', () => {
  const { w, ui, dom } = setup();
  w.ghostBotGui.updateProgress({total:2261547,remaining:2261547-2954,sessionStart:0,placed:0});
  assert.equal(cleanSpace(w.document.getElementById('stats-pixel-count').innerText),'2 954 / 2 261 547');
  assert.equal(cleanSpace(w.document.getElementById('stats-progress-text').innerText),'0,1 %');
  assert.equal(w.document.getElementById('stats-progress-bar').style.width,'0.1%');
  w.ghostBotGui.updateFixCount(2954); assert.equal(cleanSpace(w.document.getElementById('fix-count-display').innerText),'2 954');
  ui.setLanguage('en'); assert.equal(w.document.getElementById('stats-pixel-count').innerText,'2,954 / 2,261,547');
  dom.window.close();
});

test('ETA calculations retain boundaries and use French units', () => {
  const { w, ui, dom } = setup();
  w.Date.now=()=>1000000; ui.setRunning(true);
  assert.match(ui.computeEta(0,0,10),/--:--/);
  assert.match(ui.computeEta(990000,1,10),/calcul en cours/);
  const eta = seconds => cleanSpace(ui.computeEta(990000,10,seconds)); // 1 px/s
  assert.match(eta(59),/: 59 s$/); assert.match(eta(60),/: 1 min 0 s$/);
  assert.match(eta(3600),/: 1 h 0 min$/); assert.match(eta(39*86400+13*3600),/: 39 j 13 h$/);
  assert.match(eta(15552000),/> 180 j$/);
  dom.window.close();
});

test('panel version comes from GM_info and never from a second numeric constant', () => {
  const version=source.match(/^\/\/ @version\s+(.+)$/m)[1].trim();
  for (const value of [version,'9.8.7',null]) {
    const { w, dom }=setup({version:value}); assert.equal(w.document.getElementById('gb-version').textContent,`v${value ?? '?'}`); dom.window.close();
  }
  assert.equal((source.match(/0\.4\.3/g)||[]).length,1);
  assert.doesNotMatch(source,/0\.4\.2/);
});

test('syntax parses as ES2022 without modules and retains Tampermonkey metadata', () => {
  assert.doesNotThrow(()=>parse(source,{ecmaVersion:2022,sourceType:'script'}));
  for (const line of ['// @grant        unsafeWindow','// @grant        GM_info','// @match        https://*.geopixels.net/*','// @license      GPL-3.0','// @author       Dax233 (Original by nymtuta)']) assert.ok(source.includes(line));
  assert.ok(source.startsWith('// ==UserScript=='));
});

function functionNodes(text) {
  const ast=parse(text,{ecmaVersion:2022}); const nodes=new Map();
  const visit=(node,path='')=>{
    if(!node || typeof node!=='object')return;
    if(node.type==='VariableDeclarator' && node.id.type==='Identifier') nodes.set(node.id.name,text.slice(node.init?.start,node.init?.end));
    if(node.type==='Property' && (node.value.type==='ArrowFunctionExpression'||node.value.type==='FunctionExpression')) nodes.set(`property:${node.key.name||node.key.value}`,text.slice(node.value.start,node.value.end));
    if(node.type==='ClassDeclaration')nodes.set(`class:${node.id.name}`,text.slice(node.start,node.end));
    for(const value of Object.values(node)) if(Array.isArray(value))value.forEach(v=>visit(v));else if(value && typeof value==='object')visit(value);
  }; visit(ast); return nodes;
}

test('every protected network, placement, energy, retry and maintenance function is byte-identical to upstream', () => {
  const manifest=JSON.parse(readFileSync(new URL('./business-baseline.json',import.meta.url)));
  const nodes=functionNodes(source);
  for(const [name,hash] of Object.entries(manifest.functions)) {
    assert.ok(nodes.has(name),name);
    assert.equal(createHash('sha256').update(nodes.get(name)).digest('hex'),hash,name);
  }
  // Assert the baseline itself comes from the recorded public upstream commit whenever history is available.
  const upstream=execFileSync('git',['show',`${manifest.commit}:ghostBot.user.js`],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  const upstreamNodes=functionNodes(upstream);
  for(const [name,hash] of Object.entries(manifest.functions)) assert.equal(createHash('sha256').update(upstreamNodes.get(name)).digest('hex'),hash,`baseline ${name}`);
});

test('initialization and every display-only action make zero network or synchronization calls', () => {
  const ctx=setup(); const {w,ui,dom}=ctx;
  ui.setLanguage('en'); ui.setLanguage('zh'); ui.setLanguage('fr');
  ui.updateGuiStatus('等待数据...'); w.ghostBotGui.updateProgress({total:10,remaining:4,placed:6,sessionStart:0});
  ui.showCompletionNotification('GhostPixel Bot: 建造完成！');
  w.document.querySelector('.gb-min-btn').click(); w.document.querySelector('.gb-close').click();
  assert.equal(ctx.networkCalls,0); dom.window.close();
});


test('personal build defaults to French without changing runtime logic or author license', () => {
  const output=new URL('../test-results/personal.user.js',import.meta.url);
  execFileSync(process.execPath,['scripts/build-personal.mjs',fileURLToPath(output)],{encoding:'utf8'});
  const personal=readFileSync(output,'utf8');
  const {ui,dom}=setup({script:personal,locale:'pl-PL'});
  assert.equal(ui.getLanguage(),'fr'); dom.window.close();
  const saved=setup({script:personal,locale:'pl-PL',savedLanguage:'zh'});
  assert.equal(saved.ui.getLanguage(),'zh');saved.dom.window.close();
  const body=text=>text.slice(text.indexOf('(function () {')).replace('const DEFAULT_LANGUAGE = "fr";','const DEFAULT_LANGUAGE = "auto";');
  assert.equal(body(personal),body(source));
  assert.match(personal,/^\/\/ @updateURL\s+none$/m);
  assert.match(personal,/^\/\/ @downloadURL\s+none$/m);
  assert.equal(readFileSync(new URL('../LICENSE.md',import.meta.url),'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','efda7d8:LICENSE.md'],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
});
