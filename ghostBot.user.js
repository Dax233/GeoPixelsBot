// ==UserScript==
// @name         GhostPixel Bot
// @namespace    https://github.com/nymtuta
// @version      0.3.3
// @description  A bot to place pixels from the ghost image on https://geopixels.net
// @author       nymtuta & Dax233
// @match        https://*.geopixels.net/*
// @updateURL    https://github.com/nymtuta/GeoPixelsBot/raw/refs/heads/main/ghostBot.user.js
// @downloadURL  https://github.com/nymtuta/GeoPixelsBot/raw/refs/heads/main/ghostBot.user.js
// @homepage     https://github.com/nymtuta/GeoPixelsBot
// @icon         https://raw.githubusercontent.com/nymtuta/GeoPixelsBot/refs/heads/main/img/icon.png
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
  constructor(arg = {}) {
    if (typeof arg === "string") return this.constructorFromHex(arg);
    this.r = arg.r;
    this.g = arg.g;
    this.b = arg.b;
    this.a = arg.a ?? 255;
  }

  constructorFromHex(hex) {
    hex = hex.toFullHex();
    var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r) throw new Error("Invalid hex color: " + hex);
    this.r = r[1].hToI();
    this.g = r[2].hToI();
    this.b = r[3].hToI();
    this.a = r[4].hToI();
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
      color: new Color(d),
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
].map((c) => new Color(c));
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
//#endregion

(function () {
  const usw = unsafeWindow;
  let ghostPixelData;
  let ignoredColors = new Set();
  const GOOGLE_CLIENT_ID = document
    .getElementById("g_id_onload")
    ?.getAttribute("data-client_id");

  const TILE_SIZE = 1000;

  async function tryRelog() {
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
  }
  tryRelog = withErrorHandling(tryRelog);

  function getGhostImageData() {
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
  }

  Array.prototype.orderGhostPixels = function () {
    const freqMap = new Map();
    this.forEach((pixel) => {
      const val = pixel.color.val();
      freqMap.set(val, (freqMap.get(val) || 0) + 1);
    });
    return this.sort(
      (a, b) => freqMap.get(a.color.val()) - freqMap.get(b.color.val())
    );
  };

  function setGhostPixelData() {
    log(LOG_LEVELS.info, "Setting/Reloading ghost pixel data...");
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
    ghostPixelData = imageData.data.filter(
      (d) =>
        (usw.ghostBot.placeTransparentGhostPixels || d.color.a > 0) &&
        (usw.ghostBot.placeFreeColors ||
          !FREE_COLORS.map((c) => c.val()).includes(d.color.val())) &&
        Colors.map((c) => new Color(c).val()).includes(d.color.val()) &&
        !ignoredColors.has(d.color.val())
    );
    log(
      LOG_LEVELS.info,
      `Filtered ghost pixels. Total valid pixels to track: ${ghostPixelData.length}`
    );
  }

  async function getPixelsToPlace() {
    if (!ghostPixelData) setGhostPixelData();
    log(LOG_LEVELS.debug, "Filtering pixels... Grouping by tile.");
    if (
      typeof tileImageCache === "undefined" ||
      !(tileImageCache instanceof Map)
    ) {
      log(LOG_LEVELS.error, "Page's `tileImageCache` Map is not available.");
      return [];
    }

    const pixelsByTile = new Map();
    for (const pixel of ghostPixelData) {
      const tileX = Math.floor(pixel.gridCoord.x / TILE_SIZE) * TILE_SIZE;
      const tileY = Math.floor(pixel.gridCoord.y / TILE_SIZE) * TILE_SIZE;
      const tileKey = `${tileX},${tileY}`;
      if (!pixelsByTile.has(tileKey)) {
        pixelsByTile.set(tileKey, []);
      }
      pixelsByTile.get(tileKey).push(pixel);
    }

    const pixelsToPlace = [];
    const offscreenCanvas = document.createElement("canvas");
    const offscreenCtx = offscreenCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    let tileCount = 0;

    for (const [tileKey, pixelsInTile] of pixelsByTile.entries()) {
      tileCount++;
      log(
        LOG_LEVELS.debug,
        `Processing tile ${tileCount}/${pixelsByTile.size} ('${tileKey}')...`
      );
      const tile = tileImageCache.get(tileKey);

      const [tileX, tileY] = tileKey.split(",").map(Number);

      if (tile && tile.colorBitmap) {
        const bitmap = tile.colorBitmap;
        offscreenCanvas.width = bitmap.width;
        offscreenCanvas.height = bitmap.height;
        offscreenCtx.drawImage(bitmap, 0, 0);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const tilePixelData = offscreenCtx.getImageData(
          0,
          0,
          bitmap.width,
          bitmap.height
        ).data;

        for (const pixel of pixelsInTile) {
          const localX = pixel.gridCoord.x - tileX;
          const localY = pixel.gridCoord.y - tileY;

          if (
            localX >= 0 &&
            localX < TILE_SIZE &&
            localY >= 0 &&
            localY < TILE_SIZE
          ) {
            const index = (localY * TILE_SIZE + localX) * 4;
            const placedColor = new Color({
              r: tilePixelData[index],
              g: tilePixelData[index + 1],
              b: tilePixelData[index + 2],
              a: tilePixelData[index + 3],
            });
            if (placedColor.val() !== pixel.color.val()) {
              pixelsToPlace.push(pixel);
            }
          } else {
            pixelsToPlace.push(pixel);
          }
        }
      } else {
        pixelsToPlace.push(...pixelsInTile);
      }
    }

    log(
      LOG_LEVELS.info,
      `Calculation complete. Found ${pixelsToPlace.length} pixels to place.`
    );
    return pixelsToPlace.orderGhostPixels();
  }

  async function sendPixels(pixels) {
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
  }
  sendPixels = withErrorHandling(sendPixels);

  let stopWhileLoop = false;
  let promiseResolve;

  async function startGhostBot() {
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft) {
      log(LOG_LEVELS.warn, "Ghost image not loaded.");
      return;
    }
    log(LOG_LEVELS.info, "Starting Ghost Bot...");
    stopWhileLoop = false;
    while (!stopWhileLoop) {
      isPageVisible = true;
      log(LOG_LEVELS.info, "Synchronizing with the server...");
      await synchronize("full");
      const waitTimeForWorker = 2000;
      log(
        LOG_LEVELS.debug,
        `Waiting ${waitTimeForWorker / 1000}s for cache to update...`
      );
      await new Promise((r) => setTimeout(r, waitTimeForWorker));

      const pixelsToPlace = await getPixelsToPlace();
      const totalPixelsInTemplate = ghostPixelData.length;
      if (pixelsToPlace.length === 0) {
        log(LOG_LEVELS.info, `All pixels are correctly placed.`);
        break;
      }

      const pixelsThisRequest = pixelsToPlace.slice(0, currentEnergy);
      log(
        LOG_LEVELS.info,
        `Placing ${pixelsThisRequest.length}/${pixelsToPlace.length} pixels...`
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
        break;
      }
      if (pixelsToPlace.length === pixelsThisRequest.length) {
        log(LOG_LEVELS.info, "All pixels are correctly placed.");
        break;
      }

      /* isPageVisible = !document.hidden; */
      const energyToRegen =
        Math.min(maxEnergy, pixelsToPlace.length) -
        currentEnergy +
        pixelsThisRequest.length;
      const waitTime = Math.max(0, energyToRegen) * energyRate * 1000;
      log(
        LOG_LEVELS.info,
        `Waiting for energy regeneration... (${(waitTime / 1000).toFixed(
          1
        )} seconds)`
      );

      await new Promise((resolve) => {
        promiseResolve = resolve;
        setTimeout(resolve, waitTime);
      });
    }
  }
  startGhostBot = withErrorHandling(startGhostBot);

  usw.ghostBot = {
    placeTransparentGhostPixels: false,
    placeFreeColors: true,
    ignoreColors: withErrorHandling((input, sep = ",") => {
      if (!Array.isArray(input)) input = input.split(sep);
      ignoredColors = new Set(input.map((c) => new Color(c).val()));
      log(LOG_LEVELS.info, "New ignored colors :", ignoredColors);
      setGhostPixelData();
    }),
    start: startGhostBot,
    stop: () => {
      stopWhileLoop = true;
      promiseResolve?.();
      log(LOG_LEVELS.info, "Ghost bot stopped.");
    },
    reload: () => setGhostPixelData(),
  };

  log(
    LOG_LEVELS.info,
    "GhostPixel Bot loaded. Use ghostBot.start() to start and ghostBot.stop() to stop."
  );
})();
