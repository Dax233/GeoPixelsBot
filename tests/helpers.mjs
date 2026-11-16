import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
export const source = readFileSync(new URL('../ghostBot.user.js', import.meta.url), 'utf8');
export function setup({ locale = 'fr-FR', savedLanguage, config, storageBlocked = false, script = source, version = '0.4.3' } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="g_id_onload"></div><div id="controls-left"></div></body></html>', {
    url: 'http://127.0.0.1:4173/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  Object.defineProperty(w.navigator, 'language', { value: locale });
  if (savedLanguage !== undefined) w.localStorage.setItem('ghostBotLanguage_v1', savedLanguage);
  if (config) w.localStorage.setItem('ghostBotConfig_v2', typeof config === 'string' ? config : JSON.stringify(config));
  if (storageBlocked) {
    w.Storage.prototype.getItem = () => { throw new Error('Storage blocked'); };
    w.Storage.prototype.setItem = () => { throw new Error('Storage blocked'); };
  }
  const logs = [], intervals = [];
  for (const level of ['log', 'warn', 'error']) w.console[level] = (...args) => logs.push([level, ...args]);
  w.setInterval = (fn) => { intervals.push(fn); return intervals.length; };
  w.clearInterval = () => {};
  w.setTimeout = () => 1;
  w.HTMLCanvasElement.prototype.getContext = () => ({});
  w.unsafeWindow = w;
  if (version !== null) w.GM_info = { script: { version } };
  w.maxEnergy = 200; w.Colors = []; w.ghostImage = null;
  w.ghostImageOriginalData = null; w.ghostImageTopLeft = null;
  let networkCalls = 0;
  const deny = () => { networkCalls++; throw new Error('Network prohibited in offline tests'); };
  w.fetch = deny; w.XMLHttpRequest = deny; w.WebSocket = deny; w.synchronize = deny;
  w.eval(script.replace(/\}\)\(\);\s*$/, `
    window.__i18nTest = { t, setLanguage, translateMessage, MESSAGES, messagePatterns,
      computeEta, showCompletionNotification, updateGuiStatus,
      setRunning(value) { isRunning = value; },
      getLanguage() { return language; } };
  })();`));
  for (const fn of intervals) fn();
  return { dom, w, ui: w.__i18nTest, logs, get networkCalls() { return networkCalls; } };
}
export function visibleStrings(w) {
  const panel = w.document.getElementById('ghostBot-gui-panel').cloneNode(true);
  panel.querySelector('#bot-language-select').remove(); // Native language names are intentionally untranslated.
  const text = panel.textContent;
  const attrs = [...panel.querySelectorAll('[title], [aria-label]')].flatMap(el => [el.title, el.getAttribute('aria-label') || '']);
  return [text, ...attrs].join('\n');
}
