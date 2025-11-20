// ==UserScript==
// @name         GhostPixel Bot (Dax233's Fork)
// @namespace    https://github.com/Dax233
// @version      0.3.4
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
};

// GUI 日志输出辅助函数
function logToGui(msg) {
  const logArea = document.getElementById("ghost-log-area");
  if (logArea) {
    const time = new Date().toLocaleTimeString();
    logArea.innerHTML += `<div>[${time}] ${msg}</div>`;
    logArea.scrollTop = logArea.scrollHeight;
  }
}

function log(lvl, ...args) {
  const msg = args.join(" ");
  console.log(
    `%c[ghostBot] %c[${lvl.label}]`,
    "color: rebeccapurple;",
    `color:${lvl.color};`,
    ...args
  );
  // 同步输出到 GUI，除非是 debug
  if (lvl.label !== "DBG") {
    logToGui(msg);
  }
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

  // GUI 配置对象
  const botConfig = {
    energyThreshold: 10, // 默认攒 10 点能量
    autoRestart: true,
  };

  // 创建 GUI
  function createGUI() {
    const panel = document.createElement("div");
    panel.id = "ghost-bot-panel";
    panel.style.cssText = `
          position: fixed; top: 50px; right: 20px; width: 280px;
          background: rgba(20, 20, 30, 0.9); color: #eee;
          border: 1px solid #444; border-radius: 8px;
          padding: 12px; z-index: 10000; font-family: sans-serif;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5); backdrop-filter: blur(5px);
      `;

    panel.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #555; padding-bottom:5px;">
              <h3 style="margin:0; font-size:16px; color:#a8d0dc;">👻 GhostPixel Bot</h3>
              <span style="font-size:12px; cursor:pointer;" onclick="this.parentElement.parentElement.remove()">✕</span>
          </div>
          
          <div id="ghost-status-line" style="margin-bottom:10px; font-size:14px; color:#ff595e;">
              状态: 🔴 已停止
          </div>

          <div style="margin-bottom:10px; font-size:13px;">
              <label title="等待能量达到此数值再一次性绘制">充能阈值 (1-${
                typeof maxEnergy !== "undefined" ? maxEnergy : "Max"
              }):</label>
              <input type="number" id="energy-threshold-input" value="${
                botConfig.energyThreshold
              }" min="1" max="200" 
                  style="width:50px; background:#333; color:white; border:1px solid #555; border-radius:4px; padding:2px;">
          </div>

          <div style="display:flex; gap:5px; margin-bottom:10px;">
              <button id="btn-start" style="flex:1; background:#1982c4; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer;">启动</button>
              <button id="btn-stop" style="flex:1; background:#8b1d24; color:white; border:none; padding:6px; border-radius:4px; cursor:pointer;">停止</button>
          </div>

          <div style="background:#111; height:120px; overflow-y:auto; font-size:11px; padding:5px; border-radius:4px; border:1px solid #444; color:#aaa;" id="ghost-log-area">
              <div>[System] GUI 加载完成...</div>
          </div>
      `;

    document.body.appendChild(panel);

    // 绑定事件
    document.getElementById("btn-start").onclick = () => {
      if (usw.ghostBot) usw.ghostBot.start();
    };
    document.getElementById("btn-stop").onclick = () => {
      if (usw.ghostBot) usw.ghostBot.stop();
    };
    document.getElementById("energy-threshold-input").onchange = (e) => {
      let val = parseInt(e.target.value);
      if (val < 1) val = 1;
      botConfig.energyThreshold = val;
      log(LOG_LEVELS.info, `能量阈值已更新为: ${val}`);
    };
  }

  // 更新 GUI 状态的辅助函数
  function updateGuiStatus(status, color = "white") {
    const el = document.getElementById("ghost-status-line");
    if (el) {
      el.innerHTML = `状态: ${status}`;
      el.style.color = color;
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

    log(LOG_LEVELS.info, "attempting AutoLogin");
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
    log(LOG_LEVELS.debug, "Filtering pixels with pre-computed tile data...");

    // IMPORTANT: We no longer clear the tilePixelCache here, to keep it "warm".

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
    log(
      LOG_LEVELS.info,
      `Calculation complete. Found ${pixelsToPlace.length} pixels to place.`
    );
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
    } else log(LOG_LEVELS.info, `Placed ${pixels.length} pixels!`);
  });

  let stopWhileLoop = false;
  let promiseResolve;

  const startGhostBot = withErrorHandling(async () => {
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft) {
      log(LOG_LEVELS.warn, "Ghost image not loaded.");
      updateGuiStatus("❌ Ghost 图未加载", "red");
      return;
    }

    log(LOG_LEVELS.info, "Starting Ghost Bot...");
    updateGuiStatus("🟢 运行中", "#8ac926");

    stopWhileLoop = false;
    while (!stopWhileLoop) {
      isPageVisible = true;
      log(LOG_LEVELS.info, "Synchronizing with the server...");
      await synchronize("full");

      const pixelsToPlace = getPixelsToPlace();
      const totalPixelsInTemplate = ghostPixelData.length;

      if (pixelsToPlace.length === 0) {
        log(LOG_LEVELS.info, `All pixels are correctly placed.`);
        updateGuiStatus("✨ 已完成", "#ffca3a");
        break;
      }

      // 能量逻辑
      const userThreshold = Math.min(botConfig.energyThreshold, maxEnergy);
      const pixelsNeeded = pixelsToPlace.length;
      let shouldWait = false;

      if (pixelsNeeded >= userThreshold) {
        if (currentEnergy < userThreshold) {
          shouldWait = true;
        }
      }
      if (!shouldWait && currentEnergy > 0) {
        const pixelsThisRequest = pixelsToPlace.slice(0, currentEnergy);
        const pixelsAfterThisRequest =
          totalPixelsInTemplate -
          pixelsToPlace.length +
          pixelsThisRequest.length;

        log(
          LOG_LEVELS.info,
          `Placing ${pixelsThisRequest.length} pixels (${pixelsAfterThisRequest}/${totalPixelsInTemplate})...`
        );

        await sendPixels(
          pixelsThisRequest.map((d) => ({
            GridX: d.gridCoord.x,
            GridY: d.gridCoord.y,
            Color: d.color.websiteId(),
          }))
        );

        if (!tokenUser) {
          log(LOG_LEVELS.warn, "logged out => stopping the bot");
          updateGuiStatus("⚠️ 已登出", "orange");
          break;
        }

        // 绘制后重新计算剩余像素
        const remainingAfterSend = getPixelsToPlace();
        if (remainingAfterSend.length === 0) {
          log(LOG_LEVELS.info, `All pixels are now correctly placed.`);
          updateGuiStatus("✨ 已完成", "#ffca3a");
          break;
        }
      }

      // 计算下一次等待时间
      // 目标能量：如果是“等待模式”，目标就是阈值；否则目标是尽可能多，但要受限于 maxEnergy
      const targetEnergyCalc = Math.min(
        maxEnergy,
        pixelsToPlace.length,
        userThreshold
      );
      const energyNeeded = targetEnergyCalc - currentEnergy;

      // 如果 energyNeeded <= 0，说明当前能量已经达标（或者刚画完清零了需要回满），
      // 但由于 while 循环，如果刚画完，currentEnergy 变小了，energyNeeded 就会变大。
      // 修正：这里我们直接计算要 sleep 多久才能达到 userThreshold

      let waitSeconds = 0;
      if (currentEnergy < userThreshold) {
        waitSeconds = (userThreshold - currentEnergy) * energyRate;
      }

      // 确保至少有最小等待时间，防止死循环请求
      if (waitSeconds <= 0) waitSeconds = 2;

      log(
        LOG_LEVELS.info,
        `Waiting for energy... Target: ${userThreshold} (Need ${waitSeconds.toFixed(
          1
        )}s)`
      );

      updateGuiStatus(
        `⏳ 充能中... (${currentEnergy}/${userThreshold})`,
        "#1982c4"
      );

      await new Promise((resolve) => {
        promiseResolve = resolve;
        setTimeout(resolve, waitSeconds * 1000);
      });
    }
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
      log(LOG_LEVELS.info, "Ghost bot stopped.");
      updateGuiStatus("🔴 已停止", "#ff595e");
    },
    reload: () => setGhostPixelData(),
    // 暴露配置给控制台调试用
    config: botConfig,
  };

  // 初始化 GUI
  setTimeout(createGUI, 1500); // 稍微延迟一点加载 GUI，确保页面元素就绪

  log(LOG_LEVELS.info, "GhostPixel Bot GUI loaded.");
})();
