// ==UserScript==
// @name         GhostPixel Bot (Dax233's Fork)
// @namespace    https://github.com/Dax233
// @version      0.4.0
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
function evaluateAction({mode, currentEnergy, pixelCount, threshold, maxEnergy, rate = 10}) {
  let target = 0;
  if (mode === 'maintain') {
      target = 1;
  } else {
      const effectiveThreshold = Math.min(maxEnergy, threshold);
      target = pixelCount >= effectiveThreshold ? effectiveThreshold : pixelCount;
      // Ensure at least 1 if there are pixels to place
      if (pixelCount > 0) target = Math.max(1, target);
  }

  const needed = target - currentEnergy;
  
  // Optimization: Return 0 wait if no wait is needed (enough energy)
  const waitSeconds = needed <= 0 ? 0 : needed * rate;

  // Fix: Ensure pixelCount > 0 is checked for all conditions
  // This prevents the bot from acting if there are no pixels, even if energy conditions are met
  const shouldAct = (needed <= 0 || currentEnergy >= pixelCount) && pixelCount > 0;

  return {
    shouldAct,
    waitSeconds,
    target
  };
}

// Styles
const GUI_STYLES = `
  #ghost-bot-panel {
      position: fixed; top: 50px; right: 20px; width: 300px;
      background: rgba(20, 20, 30, 0.95); color: #eee;
      border: 1px solid #444; border-radius: 8px;
      padding: 12px; z-index: 10000; font-family: 'Segoe UI', sans-serif;
      box-shadow: 0 8px 20px rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      font-size: 13px;
  }
  .gb-header {
      display:flex; justify-content:space-between; align-items:center; 
      margin-bottom:12px; border-bottom:1px solid #555; padding-bottom:8px;
  }
  .gb-title { margin:0; font-size:16px; color:#a8d0dc; font-weight:bold; }
  .gb-ver { font-size:10px; color:#666; }
  .gb-close { font-size:16px; cursor:pointer; color:#888; font-weight:bold; }
  .gb-close:hover { color: #fff; }
  
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

  // 创建 GUI - 重构为模板字符串 + 事件委托
  const createGUI = () => {
    const panelHTML = `
      <style>${GUI_STYLES}</style>
      <div id="ghost-bot-panel">
        <div class="gb-header">
          <h3 class="gb-title">👻 GhostPixel Bot <span class="gb-ver">v0.4</span></h3>
          <span class="gb-close">✕</span>
        </div>
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
            <input id="energy-threshold-input" type="number" class="gb-input" min="1" max="200" value="${botConfig.energyThreshold}">
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
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = panelHTML;
    document.body.appendChild(wrapper.firstElementChild);
    
    const panel = document.getElementById('ghost-bot-panel');

    // 事件委托
    panel.addEventListener('click', e => {
        if (e.target.id === 'btn-start') if(usw.ghostBot) usw.ghostBot.start();
        if (e.target.id === 'btn-stop') if(usw.ghostBot) usw.ghostBot.stop();
        if (e.target.classList.contains('gb-close')) panel.remove();
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
            const placed = total - remaining;
            const pct = total > 0 ? ((placed / total) * 100).toFixed(1) : "0.0";
            
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

  // 带 GUI 进度更新的等待函数
  const waitWithCountdown = async (seconds, targetEnergy) => {
    let remaining = Math.ceil(seconds);
    while (remaining > 0) {
        // 检查停止标志 (stopWhileLoop) 或者 isRunning 状态
        // 如果用户想后台运行，我们不检查 document.visibilityState，这确保了后台挂机的能力
        if (stopWhileLoop || !isRunning) break; 
        
        // 尝试从 unsafeWindow 更新 energy (解决审阅意见)
        // 如果无法从 unsafeWindow 获取，则回退到全局变量 currentEnergy
        let displayEnergy = currentEnergy;
        if (typeof usw.currentEnergy !== "undefined") {
            displayEnergy = usw.currentEnergy;
        }

        const energyStatus = `(${displayEnergy}/${targetEnergy})`;
        updateGuiStatus(`充能中... ${energyStatus} - ${remaining}s`, "#1982c4", "⏳");
        
        await new Promise(r => setTimeout(r, 1000));
        remaining--;
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
      
      // Use Refactored helper
      const {shouldAct, waitSeconds, target} = evaluateAction({
        mode: botConfig.mode,
        currentEnergy,
        pixelCount: pixelsToPlace.length,
        threshold: botConfig.energyThreshold,
        maxEnergy,
        rate: typeof energyRate !== 'undefined' ? energyRate : 10
      });

      if (shouldAct) {
        // 决定这次发多少
        const countToSend = Math.min(currentEnergy, pixelsToPlace.length);
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

      await waitWithCountdown(waitSeconds, target);
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createGUI);
  } else {
    createGUI();
  }

  log(LOG_LEVELS.info, "GhostPixel Bot v0.4 Loaded.");
})();