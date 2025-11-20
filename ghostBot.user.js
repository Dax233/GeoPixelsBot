// ==UserScript==
// @name         GhostPixel Bot (Dax233's Fork)
// @namespace    https://github.com/Dax233
// @version      0.4.1
// @description  A bot to place pixels from the ghost image on https://geopixels.net
// @author       Dax233 (Original by nymtuta)
// @match        https://*.geopixels.net/*
// @updateURL    https://github.com/Dax233/GeoPixelsBot/raw/refs/heads/main/ghostBot.user.js
// @downloadURL  https://github.com/Dax233/GeoPixelsBot/raw/refs/heads/main/ghostBot.user.js
// @homepage     https://github.com/Dax233/GeoPixelsBot
// @icon         https://raw.githubusercontent.com/Dax233/GeoPixelsBot/refs/heads/main/img/icon.png
// @license      GPL-3.0
// @grant        unsafeWindow
// ==/UserScript==

//#region Utils
Number.prototype.iToH = function () {
  return this.toString(16).padStart(2, "0");
};
String.prototype.hToI = function () {
  return parseInt(this, 16);
};

String.prototype.toFullHex = function () {
  let h = this.toLowerCase();
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4 || h.length === 5)
    h = "#" + [...h.slice(1)].map((c) => c + c).join("");
  if (h.length === 7) h += "ff";
  return h;
};

class Color {
  constructor(r, g, b, a = 255) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  static fromObject(obj) {
    return new Color(obj.r, obj.g, obj.b, obj.a);
  }

  static fromHex(hex) {
    hex = hex.toFullHex();
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) throw new Error("Invalid hex color: " + hex);
    return new Color(r[1].hToI(), r[2].hToI(), r[3].hToI(), r[4].hToI());
  }
  hex = () =>
    `#${this.r.iToH()}${this.g.iToH()}${this.b.iToH()}${this.a.iToH()}`;
  websiteId = () =>
    this.a == 0 ? -1 : (this.r << 16) + (this.g << 8) + this.b;
  valueOf = this.websiteId;
  val = this.valueOf;
}
const pixelToGridCoord = (i, topLeft, size) => ({
  x: topLeft.x + (i % size.width),
  y: topLeft.y - Math.floor(i / size.width),
});
const LOG_LEVELS = {
  error: { label: "ERR", color: "red" },
  info: { label: "INF", color: "lime" },
  warn: { label: "WRN", color: "yellow" },
  debug: { label: "DBG", color: "cyan" },
  success: { label: "SUC", color: "#00ff00" },
};

function log(lvl, ...args) {
  console.log(
    `%c[ghostBot] %c[${lvl.label}]`,
    "color: rebeccapurple;",
    `color:${lvl.color};`,
    ...args
  );
}

class ImageData {
  constructor(imageData, topLeft, size) {
    this.data = imageData.map((d) => ({
      i: d.i,
      gridCoord: pixelToGridCoord(d.i, topLeft, size),
      color: Color.fromObject(d),
    }));
  }
}
const FREE_COLORS = [
  "#FFFFFF",
  "#FFCA3A",
  "#FF595E",
  "#F3BBC2",
  "#BD637D",
  "#6A4C93",
  "#A8D0DC",
  "#1A535C",
  "#1982C4",
  "#8AC926",
  "#6B4226",
  "#CFD078",
  "#8B1D24",
  "#C49A6C",
  "#000000",
  "#00000000",
].map((c) => Color.fromHex(c));

const freeColorSet = new Set(FREE_COLORS.map((c) => c.val()));

function withErrorHandling(asyncFn) {
  return async function (...args) {
    try {
      return await asyncFn(...args);
    } catch (e) {
      log(LOG_LEVELS.error, e.message);
      console.error(e);
    }
  };
}
const TILE_SIZE = 1000;
const offscreen = document.createElement("canvas");
const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
const tilePixelCache = new Map(); // key: "x,y", value: Uint8ClampedArray

// helper to load or reuse pixel data
function getTileData(tileKey, bitmap) {
  if (!tilePixelCache.has(tileKey)) {
    offscreen.width = bitmap.width;
    offscreen.height = bitmap.height;
    offCtx.drawImage(bitmap, 0, 0);
    const { data } = offCtx.getImageData(0, 0, bitmap.width, bitmap.height);
    tilePixelCache.set(tileKey, data);
  }
  return tilePixelCache.get(tileKey);
}

// helper to test one ghost‐pixel against the tile data
function needsPlacing(pixel, tileKey, tileData, width, height) {
  const [tx, ty] = tileKey.split(",").map(Number);
  const lx = pixel.gridCoord.x - tx;
  const ly = pixel.gridCoord.y - ty;
  if (lx < 0 || lx >= width || ly < 0 || ly >= height) {
    // Log a warning because this indicates a potential logic error in grouping or coordinates.
    console.warn(
      `[ghostBot] Out-of-bounds pixel detected: (${pixel.gridCoord.x},${pixel.gridCoord.y})`
    );
    return true; // Should not happen if grouping is correct, but as a safeguard.
  }
  const idx = (ly * width + lx) * 4;
  return (
    tileData[idx] !== pixel.color.r ||
    tileData[idx + 1] !== pixel.color.g ||
    tileData[idx + 2] !== pixel.color.b ||
    tileData[idx + 3] !== pixel.color.a
  );
}

// Refactored Logic Helper
function evaluateAction({mode, currentEnergy, pixelCount, threshold, maxEnergy}) {
  let target = 0;
  if (mode === 'maintain') {
      target = 1;
  } else {
      const effectiveThreshold = Math.min(maxEnergy, threshold);
      target = pixelCount >= effectiveThreshold ? effectiveThreshold : pixelCount;
      // Ensure at least 1 if there are pixels to place
      if (pixelCount > 0) target = Math.max(1, target);
  }

  // Safe check for undefined energy
  const safeEnergy = (typeof currentEnergy === 'number' && !isNaN(currentEnergy)) ? currentEnergy : 0;

  // Should act immediately if we have enough energy AND there are pixels to place
  const shouldAct = safeEnergy >= target && pixelCount > 0;

  return {
    shouldAct,
    target
  };
}

// Extracted Styles and HTML for cleaner main script
const GUI_STYLES = `
  #ghostBot-gui-panel {
      position: fixed; top: 50px; right: 20px; width: 300px;
      background: rgba(20, 20, 30, 0.95); color: #eee;
      border: 1px solid #444; border-radius: 8px;
      padding: 12px; z-index: 10000; font-family: 'Segoe UI', sans-serif;
      box-shadow: 0 8px 20px rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      font-size: 13px;
      transition: height 0.3s ease, width 0.3s ease, padding 0.3s ease;
  }
  
  /* Minimized State Styles */
  #ghostBot-gui-panel.gb-minimized {
      width: auto;
      min-width: 200px;
      padding-bottom: 6px;
  }
  #ghostBot-gui-panel.gb-minimized .gb-content {
      display: none;
  }
  #ghostBot-gui-panel.gb-minimized .gb-header {
      margin-bottom: 0;
      border-bottom: none;
      padding-bottom: 0;
  }

  .gb-header {
      display:flex; justify-content:space-between; align-items:center; 
      margin-bottom:12px; border-bottom:1px solid #555; padding-bottom:8px;
      cursor: move; /* Draggable cursor */
      user-select: none;
  }
  
  .gb-window-ctrls { display:flex; align-items:center; gap: 12px; }
  .gb-min-btn { cursor:pointer; color:#888; font-weight:bold; font-size: 14px; }
  .gb-min-btn:hover { color: #fff; }
  
  .gb-title { margin:0; font-size:16px; color:#a8d0dc; font-weight:bold; }
  .gb-ver { font-size:10px; color:#666; }
  .gb-close { font-size:16px; cursor:pointer; color:#888; font-weight:bold; }
  .gb-close:hover { color: #fff; }
  
  .gb-content { display: block; } /* Wrapper for collapsible content */

  #ghost-status-line {
      margin-bottom:12px; font-size:14px; font-weight:bold; 
      color:#ff595e; display:flex; align-items:center; gap:5px;
  }
  
  .gb-controls { display:flex; gap:10px; margin-bottom:10px; }
  .gb-ctrl-group { display:flex; flex-direction:column; }
  .gb-label { margin-bottom:4px; color:#ccc; }
  .gb-input { 
      width:100%; background:#333; color:white; 
      border:1px solid #555; border-radius:4px; padding:4px; box-sizing:border-box;
  }
  
  .gb-stats {
      background:#1a1a24; padding:10px; border-radius:6px; 
      border:1px solid #444; margin-bottom:12px;
  }
  .gb-row-between { display:flex; justify-content:space-between; }
  .gb-progress-meta { margin-bottom:2px; }
  .gb-progress-track { height:6px; background:#333; border-radius:3px; overflow:hidden; margin-bottom:8px; }
  #stats-progress-bar { width:0%; height:100%; background:#1982c4; transition: width 0.3s ease; }
  
  .gb-stat-item { font-size:12px; margin-bottom:5px; }
  .gb-stat-val { font-family:monospace; color:#eee; }
  
  #maintain-stats { 
      display:none; border-top:1px solid #333; 
      padding-top:5px; margin-top:5px; 
  }
  
  .gb-actions { display:flex; gap:8px; }
  .gb-btn {
      flex:1; border:none; padding:8px; border-radius:4px; 
      cursor:pointer; font-weight:bold; transition:all 0.2s;
  }
  .gb-btn-start { background:#1982c4; color:white; }
  .gb-btn-start:disabled { background:#444; color:#aaa; cursor:not-allowed; }
  
  .gb-btn-stop { background:#8b1d24; color:white; }
  .gb-btn-stop:disabled { background:#444; color:#aaa; cursor:not-allowed; }

  .gb-notification {
      position: fixed; bottom: 30px; right: 30px;
      background: #ffca3a; color: #222;
      padding: 16px 24px; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      font-size: 1.1em; font-weight: bold; font-family: 'Segoe UI', sans-serif;
      z-index: 10001; animation: gb-slide-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  @keyframes gb-slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
  }
`;

// Pure static HTML string
const GUI_HTML = `
  <div id="ghostBot-gui-panel">
    <div class="gb-header">
      <h3 class="gb-title">👻 GhostPixel Bot <span class="gb-ver">v0.4.1</span></h3>
      <div class="gb-window-ctrls">
        <span class="gb-min-btn" title="最小化/还原">_</span>
        <span class="gb-close" title="关闭">✕</span>
      </div>
    </div>
    <div class="gb-content">
        <div id="ghost-status-line">
          <span id="gb-status-icon">🔴</span>
          <span id="gb-status-text"> 状态: 已停止</span>
        </div>
        <div class="gb-controls">
          <div class="gb-ctrl-group" style="flex:1">
            <label class="gb-label">运行模式:</label>
            <select id="bot-mode-select" class="gb-input">
              <option value="build">🔨 建造模式</option>
              <option value="maintain">🛡️ 维护模式</option>
            </select>
          </div>
          <div class="gb-ctrl-group" style="flex:0.6">
            <label class="gb-label">充能阈值:</label>
            <input id="energy-threshold-input" type="number" class="gb-input" min="1" max="200">
          </div>
        </div>
        <div class="gb-stats">
          <div class="gb-row-between gb-progress-meta">
            <span style="color:#bbb">进度</span>
            <span id="stats-progress-text" style="color:#1982c4; font-weight:bold">0%</span>
          </div>
          <div class="gb-progress-track">
            <div id="stats-progress-bar"></div>
          </div>
          <div class="gb-row-between gb-stat-item">
            <span style="color:#bbb">🖌️ 像素完成度</span>
            <span id="stats-pixel-count" class="gb-stat-val">- / -</span>
          </div>
          <div id="maintain-stats">
            <div class="gb-row-between gb-stat-item">
              <span style="color:#8ac926">🛡️ 已修复总数</span>
              <span id="fix-count-display" class="gb-stat-val" style="color:#8ac926; font-weight:bold">0</span>
            </div>
          </div>
        </div>
        <div class="gb-actions">
          <button id="btn-start" class="gb-btn gb-btn-start">启动</button>
          <button id="btn-stop" class="gb-btn gb-btn-stop" disabled>停止</button>
        </div>
    </div>
  </div>
`;
//#endregion

(function () {
  const usw = unsafeWindow;
  let ghostPixelData;
  let ignoredColors = new Set();
  const gIdOnloadElement = document.getElementById("g_id_onload");
  let GOOGLE_CLIENT_ID;

  // 状态变量
  let isRunning = false;
  let fixCounter = 0;
  
  let lastKnownEnergy = undefined; 
  let lastCachedProgress = { total: 0, remaining: 0, pct: "0.0" };

  // GUI 配置对象
  const botConfig = {
    energyThreshold: 10, // 默认攒 10 点能量
    mode: "build", // "build" | "maintain"
    autoRestart: true,
  };

  // Notification Helper (DOM Helper)
  const showCompletionNotification = (message) => {
      const notification = document.createElement('div');
      notification.className = 'gb-notification';
      notification.innerText = message;
      document.body.appendChild(notification);

      // Remove after 4 seconds
      setTimeout(() => {
          notification.style.transition = "opacity 0.5s";
          notification.style.opacity = "0";
          setTimeout(() => notification.remove(), 500);
      }, 4000);
  };

  // Utility: Make an element draggable with boundary checks
  function makeDraggable(handleEl, panelEl) {
      let isDragging = false;
      let startX, startY, initialLeft, initialTop;

      // Helper to keep panel within window bounds
      const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

      const onMouseMove = (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          
          const rect = panelEl.getBoundingClientRect();
          const winWidth = window.innerWidth;
          const winHeight = window.innerHeight;

          const newLeft = clamp(initialLeft + dx, 0, winWidth - rect.width);
          const newTop = clamp(initialTop + dy, 0, winHeight - rect.height);

          panelEl.style.left = `${newLeft}px`;
          panelEl.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
          isDragging = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };

      handleEl.addEventListener('mousedown', (e) => {
          // Ignore if clicking controls
          if(e.target.closest('.gb-window-ctrls')) return;
          
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          
          const rect = panelEl.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;
          
          // Switch to absolute positioning
          panelEl.style.right = 'auto';
          panelEl.style.bottom = 'auto';
          panelEl.style.left = `${initialLeft}px`;
          panelEl.style.top = `${initialTop}px`;
          
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
          e.preventDefault();
      });
      
      // Handle Window Resize (Keep panel on screen)
      window.addEventListener('resize', () => {
           const rect = panelEl.getBoundingClientRect();
           const winWidth = window.innerWidth;
           const winHeight = window.innerHeight;
           
           let newLeft = rect.left;
           let newTop = rect.top;
           let changed = false;

           if (newLeft + rect.width > winWidth) { newLeft = winWidth - rect.width; changed = true; }
           if (newTop + rect.height > winHeight) { newTop = winHeight - rect.height; changed = true; }
           if (newLeft < 0) { newLeft = 0; changed = true; }
           if (newTop < 0) { newTop = 0; changed = true; }

           if (changed) {
               panelEl.style.left = `${newLeft}px`;
               panelEl.style.top = `${newTop}px`;
           }
      });
  }

  // Utility: Setup minimize and close buttons
  function setupWindowControls(panelEl) {
      const closeBtn = panelEl.querySelector('.gb-close');
      const minBtn = panelEl.querySelector('.gb-min-btn');

      if (closeBtn) {
          closeBtn.addEventListener('click', () => panelEl.remove());
      }

      if (minBtn) {
          // SVG icons for minimize and restore
          const minimizeIcon = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="12" width="10" height="2" fill="currentColor"/></svg>`;
          const restoreIcon = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="4" width="10" height="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="6" width="6" height="4" fill="currentColor"/></svg>`;

          // Initial icon and tooltip
          minBtn.innerHTML = minimizeIcon;
          minBtn.title = "Minimize";

          minBtn.addEventListener('click', () => {
              panelEl.classList.toggle('gb-minimized');
              const isMin = panelEl.classList.contains('gb-minimized');
              minBtn.innerHTML = isMin ? restoreIcon : minimizeIcon;
              minBtn.title = isMin ? "Restore" : "Minimize";
          });
      }
  }

  // 创建 GUI
  const createGUI = () => {
    // Guard against duplicate panels
    if (document.getElementById('ghostBot-gui-panel')) return;

    // 1. 注入样式到 HEAD
    const style = document.createElement('style');
    style.textContent = GUI_STYLES;
    document.head.appendChild(style);

    // 2. 构建面板
    const wrapper = document.createElement('div');
    wrapper.innerHTML = GUI_HTML;
    const panel = wrapper.firstElementChild;
    
    // 3. 安全地设置动态值
    const thresholdInput = panel.querySelector('#energy-threshold-input');
    if (thresholdInput) {
        thresholdInput.value = botConfig.energyThreshold;
    }

    document.body.appendChild(panel);

    // 4. 应用新的辅助函数
    const header = panel.querySelector('.gb-header');
    makeDraggable(header, panel);
    setupWindowControls(panel);

    // 5. 事件委托 (Controls)
    panel.addEventListener('click', e => {
        if (e.target.id === 'btn-start') if(usw.ghostBot) usw.ghostBot.start();
        if (e.target.id === 'btn-stop') if(usw.ghostBot) usw.ghostBot.stop();
    });

    panel.addEventListener('change', e => {
        if (e.target.id === 'bot-mode-select') {
            botConfig.mode = e.target.value;
            const stats = panel.querySelector('#maintain-stats');
            if (stats) stats.style.display = botConfig.mode === 'maintain' ? 'block' : 'none';
            log(LOG_LEVELS.info, `模式已切换为: ${e.target.options[e.target.selectedIndex].text}`);
        }
        if (e.target.id === 'energy-threshold-input') {
            let val = parseInt(e.target.value, 10);
            if (val < 1) val = 1;
            botConfig.energyThreshold = val;
            log(LOG_LEVELS.info, `能量阈值已更新为: ${val}`);
        }
    });

    // 更新 UI 状态辅助
    const setUiRunning = (running) => {
        isRunning = running;
        const btnStart = panel.querySelector("#btn-start");
        const btnStop = panel.querySelector("#btn-stop");
        const modeSelect = panel.querySelector("#bot-mode-select");
        if (btnStart && btnStop && modeSelect) {
            if (running) {
                btnStart.disabled = true;
                btnStop.disabled = false;
                modeSelect.disabled = true;
            } else {
                btnStart.disabled = false;
                btnStop.disabled = true;
                modeSelect.disabled = false;
            }
        }
    };

    const fixCountDisplay = panel.querySelector("#fix-count-display");
    const statsProgressText = panel.querySelector("#stats-progress-text");
    const statsProgressBar = panel.querySelector("#stats-progress-bar");
    const statsPixelCount = panel.querySelector("#stats-pixel-count");

    // 导出内部函数供外部调用更新
    usw.ghostBotGui = {
        setRunning: setUiRunning,
        updateFixCount: (count) => {
            if (fixCountDisplay) fixCountDisplay.innerText = count;
        },
        updateProgress: (total, remaining) => {
            if (!statsPixelCount) return;
            
            // Caching Mechanism: Prevent flickering when total is briefly 0
            if (total === 0) {
                if (lastCachedProgress.total > 0) return;
            }

            const placed = total - remaining;
            const pct = total > 0 ? ((placed / total) * 100).toFixed(1) : "0.0";
            
            // Update Cache
            lastCachedProgress = { total, remaining, pct };

            statsPixelCount.innerText = `${placed} / ${total}`;
            statsProgressText.innerText = `${pct}%`;
            statsProgressBar.style.width = `${pct}%`;
            
            if (pct === "100.0") {
                statsProgressText.style.color = "#ffca3a";
                statsProgressBar.style.background = "#ffca3a";
            } else {
                statsProgressText.style.color = "#1982c4";
                statsProgressBar.style.background = "#1982c4";
            }
        }
    };
  }

  // 更新 GUI 状态文字 (移除 innerHTML)
  const updateGuiStatus = (status, color = "white", icon = "ℹ️") => {
    const iconEl = document.getElementById("gb-status-icon");
    const textEl = document.getElementById("gb-status-text");
    
    if (iconEl) iconEl.innerText = icon;
    if (textEl) {
        textEl.innerText = status;
        textEl.style.color = color;
    }
  }

  if (gIdOnloadElement) {
    GOOGLE_CLIENT_ID = gIdOnloadElement.getAttribute("data-client_id");
  } else {
    log(
      LOG_LEVELS.warn,
      'Could not find the Google Sign-In element ("g_id_onload"). Auto-relogin may fail.'
    );
    // GOOGLE_CLIENT_ID will remain undefined, and subsequent calls will handle it.
  }

  const tryRelog = withErrorHandling(async () => {
    tokenUser = "";

    log(LOG_LEVELS.info, "Attempting AutoLogin...");
    await usw.tryAutoLogin();

    if (!tokenUser.length) {
      log(LOG_LEVELS.info, "AutoLogin failed, attempting relog with google");
      await new Promise((resolve) => {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (e) => {
            const r = await fetch("/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: e.credential }),
            });
            if (!r.ok)
              return log(LOG_LEVELS.info, "Google authentication failed");
            const data = await r.json();
            await logIn(data);

            resolve();
          },
          auto_select: true,
          context: "signin",
        });

        google.accounts.id.prompt();
      });
    }

    log(LOG_LEVELS.info, `Relog ${tokenUser.length ? "successful" : "failed"}`);
    return !!tokenUser.length;
  });

  const getGhostImageData = () => {
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft) {
      log(LOG_LEVELS.warn, "Ghost image not ready.");
      return null;
    }
    const data = [];
    for (let i = 0; i < ghostImageOriginalData.data.length; i += 4) {
      data.push({
        i: i / 4,
        r: ghostImageOriginalData.data[i],
        g: ghostImageOriginalData.data[i + 1],
        b: ghostImageOriginalData.data[i + 2],
        a: ghostImageOriginalData.data[i + 3],
      });
    }
    return new ImageData(
      data,
      { x: ghostImageTopLeft.gridX, y: ghostImageTopLeft.gridY },
      ghostImage
    );
  };

  const orderGhostPixels = (pixels) => {
    const freqMap = new Map();
    pixels.forEach((pixel) => {
      const val = pixel.color.val();
      freqMap.set(val, (freqMap.get(val) || 0) + 1);
    });
    return pixels.sort((a, b) => {
      const aFreq = freqMap.get(a.color.val());
      const bFreq = freqMap.get(b.color.val());
      return aFreq - bFreq;
    });
  };

  const setGhostPixelData = () => {
    log(LOG_LEVELS.info, "Setting/Reloading ghost pixel data...");
    const availableColorSet = new Set(
      Colors.map((c) => Color.fromHex(c).val())
    );
    const imageData = getGhostImageData();
    if (!imageData) {
      ghostPixelData = [];
      return;
    }
    if (typeof Colors === "undefined" || !Array.isArray(Colors)) {
      log(LOG_LEVELS.error, "Page's `Colors` variable not available.");
      ghostPixelData = [];
      return;
    }
    ghostPixelData = imageData.data
      .filter(
        (d) =>
          (usw.ghostBot.placeTransparentGhostPixels || d.color.a > 0) &&
          (usw.ghostBot.placeFreeColors || !freeColorSet.has(d.color.val())) &&
          availableColorSet.has(d.color.val()) &&
          !ignoredColors.has(d.color.val())
      )
      .map((p) => {
        const tileX = Math.floor(p.gridCoord.x / TILE_SIZE) * TILE_SIZE;
        const tileY = Math.floor(p.gridCoord.y / TILE_SIZE) * TILE_SIZE;
        return {
          ...p,
          tileX,
          tileY,
          tileKey: `${tileX},${tileY}`,
        };
      });
    log(
      LOG_LEVELS.info,
      `Filtered ghost pixels. Total valid pixels to track: ${ghostPixelData.length}`
    );
  };

  const getPixelsToPlace = () => {
    if (!ghostPixelData) setGhostPixelData();
    // log(LOG_LEVELS.debug, "Scanning canvas..."); // Reduce spam
    
    // 修复：每次扫描前清空缓存，强制从 synchronize() 后的新位图读取数据以便于多人协作
    tilePixelCache.clear(); 

    if (
      typeof tileImageCache === "undefined" ||
      !(tileImageCache instanceof Map)
    ) {
      log(LOG_LEVELS.error, "Page's `tileImageCache` Map is not available.");
      return [];
    }

    const pixelsToPlace = [];

    for (const p of ghostPixelData) {
      const tile = tileImageCache.get(p.tileKey);
      if (tile?.colorBitmap) {
        const tileData = getTileData(p.tileKey, tile.colorBitmap);
        if (
          needsPlacing(
            p,
            p.tileKey,
            tileData,
            tile.colorBitmap.width,
            tile.colorBitmap.height
          )
        ) {
          pixelsToPlace.push(p);
        }
      } else {
        // If the tile isn't in the cache, it definitely needs placing.
        pixelsToPlace.push(p);
      }
    }
    
    return orderGhostPixels(pixelsToPlace);
  };

  const sendPixels = withErrorHandling(async (pixels) => {
    const r = await fetch("https://geopixels.net/PlacePixel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Token: tokenUser,
        Subject: subject,
        UserId: userID,
        Pixels: pixels.map((c) => ({ ...c, UserId: userID })),
      }),
    });
    if (!r.ok) {
      log(LOG_LEVELS.warn, "Failed to place pixels: " + (await r.text()));
      if (r.status == 401 && (await tryRelog())) await sendPixels(pixels);
      return false;
    } else {
        log(LOG_LEVELS.info, `Placed ${pixels.length} pixels.`);
        return true;
    }
  });

  // Helper to get real-time energy safely
  const getCurrentEnergy = () => {
      let energy = undefined;
      
      // Try getting from unsafeWindow (game state) first
      if (typeof usw.currentEnergy !== "undefined") {
          energy = usw.currentEnergy;
      } else if (typeof currentEnergy !== "undefined") {
          // Fallback to global scope if accessible
          energy = currentEnergy;
      }

      // Only update cache if we got a valid number
      if (typeof energy === 'number' && !isNaN(energy)) {
          lastKnownEnergy = energy;
          return energy;
      }

      // Return cached value if undefined, BUT it might still be undefined if never set
      return lastKnownEnergy;
  }

  // Refactored: Polling-based wait helper function
  const pollForEnergy = async (targetEnergy, checkStop) => {
    while (true) {
        if (checkStop()) return; 

        const current = getCurrentEnergy();
        
        // Handle case where energy is still unknown (undefined)
        // We act as if we have 0 energy and wait
        const effectiveEnergy = (typeof current === 'number') ? current : 0;

        if (effectiveEnergy >= targetEnergy) {
            return; // Energy reached!
        }

        // Update UI
        const displayStr = (typeof current === 'undefined') ? '?' : current;
        const energyStatus = `(${displayStr}/${targetEnergy})`;
        updateGuiStatus(`充能中... ${energyStatus}`, "#1982c4", "⏳");
        
        // Dynamic Wait:
        // If we are far from target (>5), wait 30s.
        // If we are close (<=5), wait 200ms to be snappy.
        const deficit = targetEnergy - effectiveEnergy;
        const waitTime = deficit > 5 ? 30000 : 200;

        await new Promise(r => setTimeout(r, waitTime));
    }
  };

  let stopWhileLoop = false;
  let promiseResolve;

  const startGhostBot = withErrorHandling(async () => {
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft) {
      log(LOG_LEVELS.warn, "Ghost image not loaded.");
      updateGuiStatus("Ghost 图未加载", "red", "❌");
      return;
    }

    if (isRunning) return; // Prevent double start
    
    log(LOG_LEVELS.info, `Starting Ghost Bot in [${botConfig.mode.toUpperCase()}] mode...`);
    usw.ghostBotGui.setRunning(true);
    stopWhileLoop = false;

    // 只有开始时重置计数器，除非是继续维护
    if (botConfig.mode === 'maintain' && fixCounter === 0) {
        usw.ghostBotGui.updateFixCount(0);
    }

    while (!stopWhileLoop) {
      isPageVisible = true;
      // log(LOG_LEVELS.debug, "Syncing...");
      await synchronize("full");

      const pixelsToPlace = getPixelsToPlace();
      const totalPixelsInTemplate = ghostPixelData.length;

      // 更新统计数据
      usw.ghostBotGui.updateProgress(totalPixelsInTemplate, pixelsToPlace.length);

      if (pixelsToPlace.length === 0) {
        if (botConfig.mode === 'build') {
            // 建造模式：任务完成，停止
            log(LOG_LEVELS.success, `Build Complete! All pixels match.`);
            updateGuiStatus("画作已完成！", "#ffca3a", "✨");
            usw.ghostBot.stop();
            // Replace alert with non-blocking notification
            showCompletionNotification("GhostPixel Bot: 建造完成！");
            break;
        } else {
            // 维护模式：等待并重试
            updateGuiStatus("监控中... 画面完美", "#8ac926", "🛡️");
            await new Promise(r => setTimeout(r, 5000)); 
            continue;
        }
      }
      
      // Get Energy Safe
      const rawEnergy = getCurrentEnergy();
      // Review Fix: Handle undefined energy by defaulting to 0 for calculation logic
      const safeEnergy = (typeof rawEnergy === 'number') ? rawEnergy : 0;

      // Energy initialization timeout logic
      if (typeof window.energyWaitStart === 'undefined') {
        window.energyWaitStart = Date.now();
      }
      const ENERGY_WAIT_TIMEOUT_MS = 60000; // 1 minute timeout
      if (safeEnergy === 0 && (Date.now() - window.energyWaitStart) > ENERGY_WAIT_TIMEOUT_MS) {
        throw new Error("Energy was never initialized. Exiting to prevent indefinite waiting.");
      }
      if (safeEnergy > 0) {
        window.energyWaitStart = undefined; // Reset if energy is available
      }

      // Determine Target
      const {shouldAct, target} = evaluateAction({
        mode: botConfig.mode,
        currentEnergy: safeEnergy,
        pixelCount: pixelsToPlace.length,
        threshold: botConfig.energyThreshold,
        maxEnergy,
      });

      if (shouldAct) {
        // 决定这次发多少
        const countToSend = Math.min(safeEnergy, pixelsToPlace.length);
        const pixelsThisRequest = pixelsToPlace.slice(0, countToSend);

        updateGuiStatus(`正在绘制 ${pixelsThisRequest.length} 个点...`, "#A8D0DC", "🖌️");

        const success = await sendPixels(
          pixelsThisRequest.map((d) => ({
            GridX: d.gridCoord.x,
            GridY: d.gridCoord.y,
            Color: d.color.websiteId(),
          }))
        );

        if (!tokenUser) {
          log(LOG_LEVELS.warn, "Logged out => stopping.");
          updateGuiStatus("已登出", "orange", "⚠️");
          usw.ghostBot.stop();
          break;
        }

        if (success) {
             // 绘制成功后，立即更新一次统计显示（减少滞后感）
             const estimatedRemaining = pixelsToPlace.length - pixelsThisRequest.length;
             usw.ghostBotGui.updateProgress(totalPixelsInTemplate, estimatedRemaining);

             if (botConfig.mode === 'maintain') {
                fixCounter += pixelsThisRequest.length;
                usw.ghostBotGui.updateFixCount(fixCounter);
                log(LOG_LEVELS.success, `Fixed ${pixelsThisRequest.length} pixel(s). Total fixed: ${fixCounter}`);
             }
        }
      }

      // Wait until energy is sufficient
      // Pass a stop check function to the helper
      await pollForEnergy(target, () => stopWhileLoop || !isRunning);
    }
    
    // 循环结束（手动停止）
    usw.ghostBotGui.setRunning(false);
  });

  usw.ghostBot = {
    placeTransparentGhostPixels: false,
    placeFreeColors: true,
    ignoreColors: withErrorHandling((input, sep = ",") => {
      const colorList = Array.isArray(input) ? input : input.split(sep);
      ignoredColors = new Set(colorList.map((c) => Color.fromHex(c).val()));
      log(LOG_LEVELS.info, "New ignored colors :", ignoredColors);
      setGhostPixelData();
    }),
    start: startGhostBot,
    stop: () => {
      stopWhileLoop = true;
      promiseResolve?.();
      log(LOG_LEVELS.info, "Stopping bot command received.");
      updateGuiStatus("已停止", "#ff595e", "🔴");
      usw.ghostBotGui.setRunning(false);
    },
    reload: () => setGhostPixelData(),
    // 暴露配置给控制台调试用
    config: botConfig,
  };

  // 初始化 GUI
  const ensureSingleGUI = () => {
    createGUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureSingleGUI);
  } else {
    ensureSingleGUI();
  }

  log(LOG_LEVELS.info, "GhostPixel Bot v0.4 Loaded.");
})();