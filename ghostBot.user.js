// ==UserScript==
// @name         GhostPixel Bot (Dax233's Fork)
// @namespace    https://github.com/Dax233
// @version      0.4.2
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

(function () {
  const usw = unsafeWindow;
  let ghostPixelData;
  let ignoredColors = new Set();
  const gIdOnloadElement = document.getElementById("g_id_onload");
  let GOOGLE_CLIENT_ID;

  // --- 运行时状态 ---
  let isRunning = false;
  let fixCounter = 0;
  let sessionStartTime = 0;
  let sessionPixelsPlaced = 0;

  // --- 配置管理 ---
  const DEFAULT_CONFIG = {
    energyThreshold: 10,
    maxEnergyLimit: 200,
    mode: "build",
    placeTransparent: false,
    placeFree: true,
    audioAlert: false,
  };

  let botConfig = { ...DEFAULT_CONFIG };
  try {
    const saved = localStorage.getItem("ghostBotConfig_v2");
    if (saved) botConfig = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
  } catch (e) {
    console.error("Failed to load config", e);
  }

  // Wrap localStorage write in try/catch
  const saveConfig = () => {
    try {
      localStorage.setItem("ghostBotConfig_v2", JSON.stringify(botConfig));
    } catch (e) {
      console.warn(
        "Failed to save config; continuing without persisting changes",
        e
      );
    }
  };

  // Centralized config update helper
  const updateConfig = (key, value) => {
    botConfig[key] = value;
    if (key === "placeFree") {
      usw.ghostBot.placeFreeColors = value;
      usw.ghostBot.reload();
    }
    if (key === "placeTransparent") {
      usw.ghostBot.placeTransparentGhostPixels = value;
      usw.ghostBot.reload();
    }
    saveConfig();
  };

  //#region Utils & Helpers
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
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
        hex
      );
      if (!r) throw new Error("Invalid hex color: " + hex);
      return new Color(r[1].hToI(), r[2].hToI(), r[3].hToI(), r[4].hToI());
    }
    hex = () =>
      `#${this.r.iToH()}${this.g.iToH()}${this.b.iToH()}${this.a.iToH()}`;
    websiteId = () =>
      this.a == 0 ? -1 : (this.r << 16) + (this.g << 8) + this.b;
    val = () => this.websiteId();
  }

  const pixelToGridCoord = (i, topLeft, size) => ({
    x: topLeft.x + (i % size.width),
    y: topLeft.y - Math.floor(i / size.width),
  });

  const LOG_LEVELS = {
    error: { label: "ERR", color: "red" },
    info: { label: "INF", color: "lime" },
    warn: { label: "WRN", color: "yellow" },
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
  const tilePixelCache = new Map();

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

  function needsPlacing(pixel, tileKey, tileData, width, height) {
    const [tx, ty] = tileKey.split(",").map(Number);
    const lx = pixel.gridCoord.x - tx;
    const ly = pixel.gridCoord.y - ty;
    if (lx < 0 || lx >= width || ly < 0 || ly >= height) return true;
    const idx = (ly * width + lx) * 4;
    return (
      tileData[idx] !== pixel.color.r ||
      tileData[idx + 1] !== pixel.color.g ||
      tileData[idx + 2] !== pixel.color.b ||
      tileData[idx + 3] !== pixel.color.a
    );
  }

  // Re-used evaluateAction for logic separation
  function evaluateAction({
    mode,
    currentEnergy,
    pixelCount,
    threshold,
    maxEnergy,
  }) {
    let target = 0;
    if (mode === "maintain") target = 1;
    else {
      const effectiveThreshold = Math.min(maxEnergy, threshold);
      target =
        pixelCount >= effectiveThreshold ? effectiveThreshold : pixelCount;
      if (pixelCount > 0) target = Math.max(1, target);
    }
    return { shouldAct: currentEnergy >= target && pixelCount > 0, target };
  }

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  // Notification function
  const showCompletionNotification = (message) => {
    const notification = document.createElement("div");
    notification.className = "gb-notification";
    notification.innerText = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.transition = "opacity 0.5s";
      notification.style.opacity = "0";
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  };

  const detectMaxEnergy = () => {
    if (typeof usw.maxEnergy !== "undefined") return usw.maxEnergy;
    if (typeof maxEnergy !== "undefined") return maxEnergy;
    return null;
  };

  // Effective Max Energy Logic
  const getEffectiveMaxEnergy = () => {
    const detected = detectMaxEnergy();
    if (detected) return detected;
    if (botConfig.maxEnergyLimit) return botConfig.maxEnergyLimit;
    return 200;
  };

  // ETA Logic
  const computeEta = (sessionStartTime, sessionPixelsPlaced, remaining) => {
    if (!isRunning || sessionStartTime <= 0 || remaining <= 0)
      return "ETA: --:--";

    const elapsedSec = (Date.now() - sessionStartTime) / 1000;
    if (sessionPixelsPlaced <= 2 || elapsedSec <= 5) return "ETA: 计算中...";

    const pixelsPerSec = sessionPixelsPlaced / elapsedSec;
    if (pixelsPerSec <= 0) return "ETA: ...";

    const remainingSec = remaining / pixelsPerSec;
    let etaStr;
    if (remainingSec < 60) etaStr = `${Math.floor(remainingSec)}s`;
    else if (remainingSec < 3600)
      etaStr = `${Math.floor(remainingSec / 60)}m ${Math.floor(
        remainingSec % 60
      )}s`;
    else if (remainingSec < 86400)
      etaStr = `${Math.floor(remainingSec / 3600)}h ${Math.floor(
        (remainingSec % 3600) / 60
      )}m`;
    else if (remainingSec < 15552000)
      etaStr = `${Math.floor(remainingSec / 86400)}d ${Math.floor(
        (remainingSec % 86400) / 3600
      )}h`;
    else etaStr = `> 180d`;

    return `ETA: ${etaStr}`;
  };
  //#endregion

  // GUI Styles & Components
  const GUI_STYLES = `
    /* Launcher Button */
    #ghostBot-launcher {
        width: 40px; height: 40px;
        background: white; border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 16px; user-select: none;
        transition: transform 0.2s, background 0.2s;
        position: relative; z-index: 9000;
    }
    #ghostBot-launcher:hover { transform: scale(1.1); background: #f0f0f0; }

    /* Main Panel */
    #ghostBot-gui-panel {
        position: fixed; top: 60px; left: 60px; width: 300px;
        background: rgba(20, 20, 30, 0.95); color: #eee;
        border: 1px solid #444; border-radius: 8px;
        padding: 12px; z-index: 10000; font-family: 'Segoe UI', sans-serif;
        box-shadow: 0 8px 20px rgba(0,0,0,0.6); backdrop-filter: blur(8px);
        font-size: 13px; display: none; /* Hidden by default */
    }
    #ghostBot-gui-panel.gb-visible { display: block; animation: gb-fade-in 0.2s ease-out; }
    @keyframes gb-fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

    #ghostBot-gui-panel.gb-minimized { width: auto; min-width: 200px; padding-bottom: 6px; }
    #ghostBot-gui-panel.gb-minimized .gb-content { display: none; }
    #ghostBot-gui-panel.gb-minimized .gb-header { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }

    .gb-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #555; padding-bottom:8px; cursor: move; user-select: none; }
    .gb-window-ctrls { display:flex; align-items:center; gap: 12px; }
    .gb-min-btn, .gb-close { cursor:pointer; color:#888; font-weight:bold; font-size: 14px; }
    .gb-min-btn:hover, .gb-close:hover { color: #fff; }
    .gb-title { margin:0; font-size:16px; color:#a8d0dc; font-weight:bold; }
    .gb-ver { font-size:10px; color:#666; }

    #ghost-status-line { margin-bottom:12px; font-size:14px; font-weight:bold; color:#ff595e; display:flex; align-items:center; gap:5px; }
    .gb-controls { display:flex; flex-direction:column; gap:10px; margin-bottom:10px; }
    .gb-ctrl-row { display:flex; flex-direction:column; gap: 5px; }
    .gb-label-row { display:flex; justify-content:space-between; align-items:center; }
    .gb-label { color:#ccc; font-size: 12px; }
    .gb-refresh-btn { cursor: pointer; font-size: 14px; color: #888; transition: transform 0.3s ease; }
    .gb-refresh-btn:hover { color: #fff; transform: rotate(180deg); }
    .gb-input { width:100%; background:#333; color:white; border:1px solid #555; border-radius:4px; padding:4px; box-sizing:border-box; }
    .gb-input-group { display: flex; gap: 6px; align-items: center; width: 100%; }
    .gb-slider { flex: 1; cursor: pointer; height: 6px; accent-color: #1982c4; }
    .gb-num-small { width: 50px; text-align: center; font-family: monospace; }

    .gb-settings { background: #252530; border: 1px solid #3d3d4d; border-radius: 4px; padding: 8px; margin-bottom: 10px; }
    .gb-setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .gb-checkbox { cursor: pointer; }

    .gb-stats { background:#1a1a24; padding:10px; border-radius:6px; border:1px solid #444; margin-bottom:12px; }
    .gb-row-between { display:flex; justify-content:space-between; }
    .gb-progress-track { height:6px; background:#333; border-radius:3px; overflow:hidden; margin-bottom:8px; }
    #stats-progress-bar { width:0%; height:100%; background:#1982c4; transition: width 0.3s ease; }
    .gb-stat-item { font-size:12px; margin-bottom:5px; }
    .gb-stat-val { font-family:monospace; color:#eee; }
    #stats-eta { font-size: 11px; color: #888; text-align: right; margin-top: -4px; margin-bottom: 6px; }
    #maintain-stats { display:none; border-top:1px solid #333; padding-top:5px; margin-top:5px; }

    .gb-actions { display:flex; gap:8px; }
    .gb-btn { flex:1; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; transition:all 0.2s; }
    .gb-btn-start { background:#1982c4; color:white; }
    .gb-btn-start:disabled { background:#444; color:#aaa; cursor:not-allowed; }
    .gb-btn-stop { background:#8b1d24; color:white; }
    .gb-btn-stop:disabled { background:#444; color:#aaa; cursor:not-allowed; }

    .gb-notification { position: fixed; bottom: 30px; right: 30px; background: #ffca3a; color: #222; padding: 16px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); font-size: 1.1em; font-weight: bold; font-family: 'Segoe UI', sans-serif; z-index: 10001; animation: gb-slide-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes gb-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  `;

  const GUI_HTML = `
    <div class="gb-header">
      <h3 class="gb-title">👻 GhostPixel Bot <span class="gb-ver">v0.4.2</span></h3>
      <div class="gb-window-ctrls">
        <span class="gb-min-btn" title="最小化/还原">_</span>
        <span class="gb-close" title="隐藏面板 (后台继续运行)">✕</span>
      </div>
    </div>
    <div class="gb-content">
        <div id="ghost-status-line">
          <span id="gb-status-icon">🔴</span>
          <span id="gb-status-text"> 状态: 已停止</span>
        </div>
        <div class="gb-controls">
          <div class="gb-ctrl-row">
            <label class="gb-label">运行模式:</label>
            <select id="bot-mode-select" class="gb-input">
              <option value="build">🔨 建造</option>
              <option value="maintain">🛡️ 维护</option>
            </select>
          </div>
          <div class="gb-ctrl-row">
            <div class="gb-label-row">
                 <label class="gb-label">充能阈值:</label>
                 <span id="btn-refresh-max" class="gb-refresh-btn" title="刷新最大能量上限">🔄</span>
            </div>
            <div class="gb-input-group">
                <input id="energy-threshold-slider" type="range" min="1" max="200" class="gb-slider" title="拖动调整">
                <input id="energy-threshold-input" type="number" class="gb-input gb-num-small" min="1" max="200" title="精准输入">
            </div>
          </div>
        </div>
        <div class="gb-settings">
             <div class="gb-setting-row">
                <label class="gb-label" for="chk-free-color" title="是否绘制白色/黑色等常见背景色">绘制免费/背景色</label>
                <input type="checkbox" id="chk-free-color" class="gb-checkbox">
            </div>
            <div class="gb-setting-row">
                <label class="gb-label" for="chk-transparent" title="是否尝试绘制透明像素">绘制透明层</label>
                <input type="checkbox" id="chk-transparent" class="gb-checkbox">
            </div>
            <div class="gb-setting-row">
                <label class="gb-label" for="chk-audio" title="任务完成时播放提示音">完成提示音</label>
                <input type="checkbox" id="chk-audio" class="gb-checkbox">
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
          <div id="stats-eta">ETA: --:--</div>
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

  // UI Initialization
  const initLauncher = () => {
    // Inject Styles
    const style = document.createElement("style");
    style.textContent = GUI_STYLES;
    document.head.appendChild(style);

    // Wait for #controls-left
    const checkControls = setInterval(() => {
      const controlsLeft = document.getElementById("controls-left");
      if (controlsLeft) {
        clearInterval(checkControls);
        createLauncherButton(controlsLeft);
        createPanel(); // Prepare panel but keep hidden
      }
    }, 500);
  };

  const createLauncherButton = (parent) => {
    const btn = document.createElement("div");
    btn.id = "ghostBot-launcher";
    btn.innerHTML = "👻";
    btn.title = "打开 GhostPixel Bot";
    btn.onclick = () => {
      const panel = document.getElementById("ghostBot-gui-panel");
      if (panel) {
        panel.classList.add("gb-visible");
        btn.style.display = "none";
        // Trigger max energy update when opening, ensuring data is loaded
        if (usw.ghostBotGui && usw.ghostBotGui.refreshMax)
          usw.ghostBotGui.refreshMax();
      }
    };
    parent.appendChild(btn);
  };

  // Split createPanel into smaller helpers
  const wirePanelDragging = (panel) => {
    const header = panel.querySelector(".gb-header");
    let isDragging = false,
      startX,
      startY,
      initialLeft,
      initialTop;
    const onMove = (e) => {
      if (!isDragging) return;
      const rect = panel.getBoundingClientRect();
      const winW = window.innerWidth,
        winH = window.innerHeight;
      const newLeft = Math.min(
        Math.max(initialLeft + (e.clientX - startX), 0),
        winW - rect.width
      );
      const newTop = Math.min(
        Math.max(initialTop + (e.clientY - startY), 0),
        winH - rect.height
      );
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    };
    const onUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".gb-window-ctrls")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = `${initialLeft}px`;
      panel.style.top = `${initialTop}px`;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  };

  const wirePanelControls = (panel) => {
    const thresholdInput = panel.querySelector("#energy-threshold-input");
    const thresholdSlider = panel.querySelector("#energy-threshold-slider");
    const modeSelect = panel.querySelector("#bot-mode-select");
    const chkFree = panel.querySelector("#chk-free-color");
    const chkTrans = panel.querySelector("#chk-transparent");
    const chkAudio = panel.querySelector("#chk-audio");
    const statsDiv = panel.querySelector("#maintain-stats");

    // Close / Minimize Logic
    panel.querySelector(".gb-close").addEventListener("click", () => {
      panel.classList.remove("gb-visible");
      const launcher = document.getElementById("ghostBot-launcher");
      if (launcher) launcher.style.display = "flex";
    });
    const minBtn = panel.querySelector(".gb-min-btn");
    minBtn.addEventListener("click", () => {
      panel.classList.toggle("gb-minimized");
      minBtn.innerText = panel.classList.contains("gb-minimized") ? "□" : "_";
    });

    // Inputs
    panel.addEventListener("click", (e) => {
      if (e.target.id === "btn-start") if (usw.ghostBot) usw.ghostBot.start();
      if (e.target.id === "btn-stop") if (usw.ghostBot) usw.ghostBot.stop();
      if (e.target.id === "btn-refresh-max") {
        if (usw.ghostBotGui) usw.ghostBotGui.refreshMax(true);
        e.target.style.transform = "rotate(360deg)";
        setTimeout(() => (e.target.style.transform = "rotate(0deg)"), 500);
      }
    });

    // Use updateConfig helper
    panel.addEventListener("change", (e) => {
      if (e.target.id === "bot-mode-select") {
        updateConfig("mode", e.target.value);
        if (statsDiv)
          statsDiv.style.display =
            botConfig.mode === "maintain" ? "block" : "none";
      }
      if (e.target.id === "chk-free-color")
        updateConfig("placeFree", e.target.checked);
      if (e.target.id === "chk-transparent")
        updateConfig("placeTransparent", e.target.checked);
      if (e.target.id === "chk-audio")
        updateConfig("audioAlert", e.target.checked);
    });

    // Threshold setting logic
    const setThreshold = (rawVal) => {
      const max = getEffectiveMaxEnergy();
      let val = parseInt(rawVal, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > max) val = max;

      if (thresholdInput) thresholdInput.value = val;
      if (thresholdSlider) thresholdSlider.value = val;
      updateConfig("energyThreshold", val);
    };

    if (thresholdSlider)
      thresholdSlider.addEventListener("input", (e) =>
        setThreshold(e.target.value)
      );
    if (thresholdInput)
      thresholdInput.addEventListener("input", (e) =>
        setThreshold(e.target.value)
      );

    // Initial Values
    if (thresholdInput) thresholdInput.value = botConfig.energyThreshold;
    if (thresholdSlider) thresholdSlider.value = botConfig.energyThreshold;
    if (modeSelect) modeSelect.value = botConfig.mode;
    if (chkFree) chkFree.checked = botConfig.placeFree;
    if (chkTrans) chkTrans.checked = botConfig.placeTransparent;
    if (chkAudio) chkAudio.checked = botConfig.audioAlert;
    if (statsDiv)
      statsDiv.style.display = botConfig.mode === "maintain" ? "block" : "none";
  };

  const createPanel = () => {
    const panel = document.createElement("div");
    panel.id = "ghostBot-gui-panel";
    panel.innerHTML = GUI_HTML;
    document.body.appendChild(panel);

    wirePanelDragging(panel);
    wirePanelControls(panel);

    // Expose GUI methods
    const setUiRunning = (running) => {
      isRunning = running;
      const btnStart = panel.querySelector("#btn-start");
      const btnStop = panel.querySelector("#btn-stop");
      const modeSelect = panel.querySelector("#bot-mode-select");
      if (btnStart && btnStop && modeSelect) {
        btnStart.disabled = running;
        btnStop.disabled = !running;
        modeSelect.disabled = running;
      }
    };

    // Core: Update Max Energy & Clamp
    const updateMaxEnergyLimit = (forceSave = false) => {
      const newMax = getEffectiveMaxEnergy();
      if (forceSave) updateConfig("maxEnergyLimit", newMax);

      const thresholdSlider = panel.querySelector("#energy-threshold-slider");
      const thresholdInput = panel.querySelector("#energy-threshold-input");

      if (thresholdSlider && thresholdInput) {
        thresholdSlider.max = newMax;
        thresholdInput.max = newMax;
        if (botConfig.energyThreshold > newMax) {
          updateConfig("energyThreshold", newMax);
          thresholdSlider.value = newMax;
          thresholdInput.value = newMax;
        }
      }
      log(LOG_LEVELS.info, `Max energy synced: ${newMax}`);
    };

    const fixCountDisplay = panel.querySelector("#fix-count-display");
    const statsProgressText = panel.querySelector("#stats-progress-text");
    const statsProgressBar = panel.querySelector("#stats-progress-bar");
    const statsPixelCount = panel.querySelector("#stats-pixel-count");
    const statsEta = panel.querySelector("#stats-eta");

    usw.ghostBotGui = {
      setRunning: setUiRunning,
      refreshMax: updateMaxEnergyLimit,
      updateFixCount: (count) => {
        if (fixCountDisplay) fixCountDisplay.innerText = count;
      },
      updateProgress: (total, remaining, etaText) => {
        if (!statsPixelCount) return;
        // 如果总数为0（数据未加载或异常），则不更新UI，避免闪烁0%
        if (total <= 0) return;

        const placed = total - remaining;
        const pct = total > 0 ? ((placed / total) * 100).toFixed(1) : "0.0";
        statsPixelCount.innerText = `${placed} / ${total}`;
        statsProgressText.innerText = `${pct}%`;
        statsProgressBar.style.width = `${pct}%`;
        const isComplete = pct === "100.0";
        statsProgressText.style.color = isComplete ? "#ffca3a" : "#1982c4";
        statsProgressBar.style.background = isComplete ? "#ffca3a" : "#1982c4";

        if (statsEta && etaText) statsEta.innerText = etaText;
      },
    };

    // Initial sync
    updateMaxEnergyLimit();
  };

  const updateGuiStatus = (status, color = "white", icon = "ℹ️") => {
    const iconEl = document.getElementById("gb-status-icon");
    const textEl = document.getElementById("gb-status-text");
    if (iconEl) iconEl.innerText = icon;
    if (textEl) {
      textEl.innerText = status;
      textEl.style.color = color;
    }
  };

  if (gIdOnloadElement) {
    GOOGLE_CLIENT_ID = gIdOnloadElement.getAttribute("data-client_id");
  } else {
    log(
      LOG_LEVELS.warn,
      'Could not find the Google Sign-In element ("g_id_onload").'
    );
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
    return !!tokenUser.length;
  });

  const getGhostImageData = () => {
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft)
      return null;
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
    return pixels.sort(
      (a, b) => freqMap.get(a.color.val()) - freqMap.get(b.color.val())
    );
  };

  const setGhostPixelData = () => {
    log(LOG_LEVELS.info, "Setting/Reloading ghost pixel data...");
    // Colors check
    if (typeof Colors === "undefined" || !Array.isArray(Colors)) {
      log(LOG_LEVELS.error, "Page's `Colors` variable not available.");
      ghostPixelData = [];
      return;
    }

    const availableColorSet = new Set(
      Colors.map((c) => Color.fromHex(c).val())
    );
    const imageData = getGhostImageData();
    if (!imageData) {
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
        return { ...p, tileX, tileY, tileKey: `${tileX},${tileY}` };
      });
    log(
      LOG_LEVELS.info,
      `Filtered ghost pixels. Total: ${ghostPixelData.length}`
    );
  };

  const getPixelsToPlace = () => {
    if (!ghostPixelData) setGhostPixelData();
    tilePixelCache.clear();
    // tileImageCache check
    if (
      typeof tileImageCache === "undefined" ||
      !(tileImageCache instanceof Map)
    ) {
      log(LOG_LEVELS.error, "Page's `tileImageCache` Map is not available.");
      return [];
    }
    const pixelsToPlace = [];
    if (ghostPixelData) {
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
          )
            pixelsToPlace.push(p);
        } else pixelsToPlace.push(p);
      }
    }
    return orderGhostPixels(pixelsToPlace);
  };

  // Infinite recursion protection
  const sendPixels = withErrorHandling(async (pixels, retryCount = 0) => {
    if (retryCount > 3) {
      log(
        LOG_LEVELS.error,
        "Failed to place pixels after 3 retries. Stopping recursion."
      );
      return false;
    }
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
      if (r.status == 401 && (await tryRelog())) {
        return await sendPixels(pixels, retryCount + 1);
      }
      return false;
    }
    return true;
  });

  const getCurrentEnergy = () => {
    if (typeof usw.currentEnergy !== "undefined") return usw.currentEnergy;
    if (typeof currentEnergy !== "undefined") return currentEnergy;
    return 0;
  };

  // Consolidated Wait Logic with Throttling
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitForEnergyAndPixels(totalPixelsInTemplate) {
    let throttleCounter = 0;
    let lastPixels = getPixelsToPlace(); // Initial check

    while (!stopWhileLoop && isRunning) {
      const currentEnergy = getCurrentEnergy();
      const safeMaxEnergy = getEffectiveMaxEnergy();

      // Throttle expensive pixel calculation (every 5 ticks/seconds)
      if (throttleCounter % 5 === 0) {
        lastPixels = getPixelsToPlace();
        // Update progress bar during wait
        if (usw.ghostBotGui) {
          const etaText = computeEta(
            sessionStartTime,
            sessionPixelsPlaced,
            lastPixels.length
          );
          usw.ghostBotGui.updateProgress(
            totalPixelsInTemplate,
            lastPixels.length,
            etaText
          );
        }
      }

      const { shouldAct, target } = evaluateAction({
        mode: botConfig.mode,
        currentEnergy,
        pixelCount: lastPixels.length,
        threshold: botConfig.energyThreshold,
        maxEnergy: safeMaxEnergy,
      });

      if (shouldAct && lastPixels.length > 0) {
        return { currentEnergy, pixelsToPlace: lastPixels }; // Ready
      }

      // UI Status Update (Waiting...)
      const spinner = ["|", "/", "-", "\\"][throttleCounter % 4];
      updateGuiStatus(
        `充能中... ${spinner} (${currentEnergy}/${target}) [Req: ${botConfig.energyThreshold}]`,
        "#1982c4",
        "⏳"
      );

      throttleCounter++;
      await sleep(1000);
    }
    return null; // Stopped
  }

  let stopWhileLoop = false;
  let promiseResolve;

  const startGhostBot = withErrorHandling(async () => {
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft) {
      log(LOG_LEVELS.warn, "Ghost image not loaded.");
      updateGuiStatus("Ghost 图未加载", "red", "❌");
      return;
    }
    if (isRunning) return;
    log(
      LOG_LEVELS.info,
      `Starting Ghost Bot in [${botConfig.mode.toUpperCase()}] mode...`
    );

    if (usw.ghostBotGui) usw.ghostBotGui.setRunning(true);

    stopWhileLoop = false;
    sessionStartTime = Date.now();
    sessionPixelsPlaced = 0;
    if (botConfig.mode === "maintain" && fixCounter === 0 && usw.ghostBotGui)
      usw.ghostBotGui.updateFixCount(0);

    while (!stopWhileLoop) {
      isPageVisible = true;
      await synchronize("full");

      let pixelsToPlace = getPixelsToPlace();
      const totalPixelsInTemplate = ghostPixelData ? ghostPixelData.length : 0;

      if (totalPixelsInTemplate === 0) {
        log(LOG_LEVELS.warn, "Ghost data empty, retrying...");
        updateGuiStatus("等待数据...", "yellow", "⚠️");
        await sleep(1000);
        continue;
      }

      // Initial progress update
      if (usw.ghostBotGui) {
        const etaText = computeEta(
          sessionStartTime,
          sessionPixelsPlaced,
          pixelsToPlace.length
        );
        usw.ghostBotGui.updateProgress(
          totalPixelsInTemplate,
          pixelsToPlace.length,
          etaText
        );
      }

      // Use centralized wait function
      const readyState = await waitForEnergyAndPixels(totalPixelsInTemplate);
      if (!readyState) break; // Stopped

      const { currentEnergy, pixelsToPlace: readyPixels } = readyState;
      pixelsToPlace = readyPixels;

      if (pixelsToPlace.length === 0) {
        if (botConfig.mode === "build") {
          log(LOG_LEVELS.success, `Build Complete!`);
          updateGuiStatus("画作已完成！", "#ffca3a", "✨");
          if (botConfig.audioAlert) playNotificationSound();
          showCompletionNotification("GhostPixel Bot: 建造完成！");
          usw.ghostBot.stop();
          break;
        } else {
          updateGuiStatus("监控中... 画面完美", "#8ac926", "🛡️");
          await sleep(5000);
          continue;
        }
      }

      // Execution
      const countToSend = Math.min(currentEnergy, pixelsToPlace.length);
      const pixelsThisRequest = pixelsToPlace.slice(0, countToSend);

      if (pixelsThisRequest.length > 0) {
        updateGuiStatus(
          `正在绘制 ${pixelsThisRequest.length} 个点...`,
          "#A8D0DC",
          "🖌️"
        );
        const success = await sendPixels(
          pixelsThisRequest.map((d) => ({
            GridX: d.gridCoord.x,
            GridY: d.gridCoord.y,
            Color: d.color.websiteId(),
          }))
        );

        if (!tokenUser) {
          updateGuiStatus("已登出", "orange", "⚠️");
          usw.ghostBot.stop();
          break;
        }
        if (success) {
          sessionPixelsPlaced += pixelsThisRequest.length;
          const estimatedRemaining =
            pixelsToPlace.length - pixelsThisRequest.length;

          if (usw.ghostBotGui) {
            const etaText = computeEta(
              sessionStartTime,
              sessionPixelsPlaced,
              estimatedRemaining
            );
            usw.ghostBotGui.updateProgress(
              totalPixelsInTemplate,
              estimatedRemaining,
              etaText
            );
          }

          if (botConfig.mode === "maintain") {
            fixCounter += pixelsThisRequest.length;
            if (usw.ghostBotGui) usw.ghostBotGui.updateFixCount(fixCounter);
          }
        }
      }

      // Anti-stuck mechanism for 0 energy
      const safeEnergy = getCurrentEnergy();
      if (typeof window.energyWaitStart === "undefined")
        window.energyWaitStart = Date.now();
      if (safeEnergy === 0 && Date.now() - window.energyWaitStart > 60000)
        window.energyWaitStart = Date.now();
      if (safeEnergy > 0) window.energyWaitStart = undefined;
    }

    if (usw.ghostBotGui) usw.ghostBotGui.setRunning(false);
  });

  usw.ghostBot = {
    placeTransparentGhostPixels: botConfig.placeTransparent,
    placeFreeColors: botConfig.placeFree,
    ignoreColors: withErrorHandling((input, sep = ",") => {
      const colorList = Array.isArray(input) ? input : input.split(sep);
      ignoredColors = new Set(colorList.map((c) => Color.fromHex(c).val()));
      setGhostPixelData();
    }),
    start: startGhostBot,
    stop: () => {
      stopWhileLoop = true;
      promiseResolve?.();
      log(LOG_LEVELS.info, "Stopping bot command received.");
      updateGuiStatus("已停止", "#ff595e", "🔴");
      if (usw.ghostBotGui) usw.ghostBotGui.setRunning(false);
    },
    reload: () => setGhostPixelData(),
    config: botConfig,
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initLauncher);
  else initLauncher();

  log(LOG_LEVELS.info, "GhostPixel Bot v0.4.2 Loaded.");
})();
