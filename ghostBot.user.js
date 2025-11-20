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

  // 创建 GUI
  function createGUI() {
    const panel = document.createElement("div");
    panel.id = "ghost-bot-panel";
    panel.style.cssText = `
          position: fixed; top: 50px; right: 20px; width: 300px;
          background: rgba(20, 20, 30, 0.95); color: #eee;
          border: 1px solid #444; border-radius: 8px;
          padding: 12px; z-index: 10000; font-family: 'Segoe UI', sans-serif;
          box-shadow: 0 8px 20px rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          font-size: 13px;
      `;

    panel.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #555; padding-bottom:8px;">
              <h3 style="margin:0; font-size:16px; color:#a8d0dc; font-weight:bold;">👻 GhostPixel Bot <span style="font-size:10px; color:#666;">v0.4</span></h3>
              <span style="font-size:16px; cursor:pointer; color:#888; font-weight:bold;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'" onclick="this.parentElement.parentElement.remove()">✕</span>
          </div>
          
          <div id="ghost-status-line" style="margin-bottom:12px; font-size:14px; font-weight:bold; color:#ff595e; display:flex; align-items:center; gap:5px;">
              <span>🔴</span> <span>状态: 已停止</span>
          </div>

          <div style="display:flex; gap:10px; margin-bottom:10px;">
             <div style="flex:1;">
                <label style="display:block; margin-bottom:4px; color:#ccc;">运行模式:</label>
                <select id="bot-mode-select" style="width:100%; background:#333; color:white; border:1px solid #555; border-radius:4px; padding:4px;">
                    <option value="build">🔨 建造模式</option>
                    <option value="maintain">🛡️ 维护模式</option>
                </select>
             </div>
             <div style="flex:0.6;">
                <label style="display:block; margin-bottom:4px; color:#ccc;">充能阈值:</label>
                <input type="number" id="energy-threshold-input" value="${botConfig.energyThreshold}" min="1" max="200" 
                  style="width:100%; background:#333; color:white; border:1px solid #555; border-radius:4px; padding:4px;">
             </div>
          </div>

          <!-- 统计面板区域 -->
          <div style="background:#1a1a24; padding:10px; border-radius:6px; border:1px solid #444; margin-bottom:12px;">
             
             <!-- 进度条 -->
             <div style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                   <span style="color:#bbb;">进度</span>
                   <span id="stats-progress-text" style="color:#1982c4; font-weight:bold;">0%</span>
                </div>
                <div style="height:6px; background:#333; border-radius:3px; overflow:hidden;">
                   <div id="stats-progress-bar" style="width:0%; height:100%; background:#1982c4; transition: width 0.3s ease;"></div>
                </div>
             </div>

             <!-- 像素统计 -->
             <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                <span style="color:#bbb;">🖌️ 像素完成度</span>
                <span id="stats-pixel-count" style="font-family:monospace; color:#eee;">- / -</span>
             </div>

             <!-- 维护统计 (仅维护模式显示) -->
             <div id="maintain-stats" style="display:none; border-top:1px solid #333; padding-top:5px; margin-top:5px;">
                <div style="display:flex; justify-content:space-between; font-size:12px;">
                    <span style="color:#8ac926;">🛡️ 已修复总数</span>
                    <span id="fix-count-display" style="font-family:monospace; color:#8ac926; font-weight:bold;">0</span>
                </div>
             </div>

          </div>

          <div style="display:flex; gap:8px;">
              <button id="btn-start" style="flex:1; background:#1982c4; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; transition:all 0.2s;">启动</button>
              <button id="btn-stop" disabled style="flex:1; background:#444; color:#aaa; border:none; padding:8px; border-radius:4px; cursor:not-allowed; font-weight:bold; transition:all 0.2s;">停止</button>
          </div>
      `;

    document.body.appendChild(panel);

    // 元素引用
    const btnStart = document.getElementById("btn-start");
    const btnStop = document.getElementById("btn-stop");
    const modeSelect = document.getElementById("bot-mode-select");
    const fixStats = document.getElementById("maintain-stats");
    
    const statsProgressText = document.getElementById("stats-progress-text");
    const statsProgressBar = document.getElementById("stats-progress-bar");
    const statsPixelCount = document.getElementById("stats-pixel-count");
    const fixCountDisplay = document.getElementById("fix-count-display");

    // 更新 UI 状态辅助
    const setUiRunning = (running) => {
        isRunning = running;
        if (running) {
            btnStart.disabled = true;
            btnStart.style.background = "#444";
            btnStart.style.color = "#aaa";
            btnStart.style.cursor = "not-allowed";
            
            btnStop.disabled = false;
            btnStop.style.background = "#8b1d24";
            btnStop.style.color = "white";
            btnStop.style.cursor = "pointer";
            
            modeSelect.disabled = true;
        } else {
            btnStart.disabled = false;
            btnStart.style.background = "#1982c4";
            btnStart.style.color = "white";
            btnStart.style.cursor = "pointer";
            
            btnStop.disabled = true;
            btnStop.style.background = "#444";
            btnStop.style.color = "#aaa";
            btnStop.style.cursor = "not-allowed";

            modeSelect.disabled = false;
        }
    };

    // 绑定事件
    btnStart.onclick = () => {
      if (usw.ghostBot) usw.ghostBot.start();
    };
    btnStop.onclick = () => {
      if (usw.ghostBot) usw.ghostBot.stop();
    };
    
    document.getElementById("energy-threshold-input").onchange = (e) => {
      let val = parseInt(e.target.value);
      if (val < 1) val = 1;
      botConfig.energyThreshold = val;
      log(LOG_LEVELS.info, `能量阈值已更新为: ${val}`);
    };

    modeSelect.onchange = (e) => {
        botConfig.mode = e.target.value;
        if (botConfig.mode === 'maintain') {
            fixStats.style.display = 'block';
        } else {
            fixStats.style.display = 'none';
        }
        log(LOG_LEVELS.info, `模式已切换为: ${e.target.options[e.target.selectedIndex].text}`);
    };

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

  // 更新 GUI 状态文字
  function updateGuiStatus(status, color = "white", icon = "ℹ️") {
    const el = document.getElementById("ghost-status-line");
    if (el) {
      el.innerHTML = `<span>${icon}</span> <span style="color:${color}">${status}</span>`;
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
        if (stopWhileLoop) break;
        
        const energyStatus = `(${currentEnergy}/${targetEnergy})`;
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
            alert("GhostPixel Bot: 建造完成！");
            break;
        } else {
            // 维护模式：等待并重试
            updateGuiStatus("监控中... 画面完美", "#8ac926", "🛡️");
            await new Promise(r => setTimeout(r, 5000)); 
            continue;
        }
      }
      
      // 在维护模式下，阈值强制设为 1，确保发现错误立刻修补
      const userThreshold = botConfig.mode === 'maintain' ? 1 : Math.min(botConfig.energyThreshold, maxEnergy);
      
      // 检查是否有足够能量进行操作
      let shouldAct = false;
      
      if (botConfig.mode === 'maintain') {
          shouldAct = currentEnergy > 0;
      } else {
          // Build mode
          if (pixelsToPlace.length >= userThreshold) {
              shouldAct = currentEnergy >= userThreshold;
          } else {
              // 剩余像素少于阈值，有多少发多少
              shouldAct = currentEnergy >= pixelsToPlace.length || currentEnergy === maxEnergy;
          }
      }

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

      
      let targetEnergyVal = 0;
      
      if (botConfig.mode === 'maintain') {
          targetEnergyVal = 1;
      } else {
           const remainingPixels = Math.max(0, pixelsToPlace.length - currentEnergy); // 粗略估计
           targetEnergyVal = Math.min(maxEnergy, botConfig.energyThreshold);
           if (remainingPixels > 0 && remainingPixels < targetEnergyVal) {
               targetEnergyVal = remainingPixels;
           }
      }

      let waitSeconds = 0;
      if (currentEnergy < targetEnergyVal) {
        waitSeconds = (targetEnergyVal - currentEnergy) * (typeof energyRate !== 'undefined' ? energyRate : 10);
      } else {
          waitSeconds = 1; 
      }
      
      waitSeconds += 0.5; 

      await waitWithCountdown(waitSeconds, targetEnergyVal);
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
  setTimeout(createGUI, 1500); // 稍微延迟一点加载 GUI，确保页面元素就绪

  log(LOG_LEVELS.info, "GhostPixel Bot v0.4 Loaded.");
})();