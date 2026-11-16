// ==UserScript==
// @name         GhostPixel Bot (Dax233's Fork)
// @namespace    https://github.com/Dax233
// @version      0.4.3
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

  // Localization is presentation-only and has its own storage key.
  const DEFAULT_LANGUAGE = "auto";
  const LANGUAGE_KEY = "ghostBotLanguage_v1";
  const MESSAGES = {
    "minimize": {
        "en": "Minimize / Restore",
        "zh": "最小化/还原",
        "source": "最小化/还原",
        "fr": "Réduire / Rétablir"
    },
    "hide": {
        "en": "Hide panel (continues in background)",
        "zh": "隐藏面板 (后台继续运行)",
        "source": "隐藏面板 (后台继续运行)",
        "fr": "Masquer le panneau (activité maintenue)"
    },
    "stopped": {
        "en": "Stopped",
        "zh": "已停止",
        "source": "已停止",
        "fr": "Arrêté"
    },
    "initialStatus": {
        "en": "Status: Stopped",
        "zh": "状态：已停止",
        "source": " 状态: 已停止",
        "fr": "État : arrêté"
    },
    "mode": {
        "en": "Mode:",
        "zh": "运行模式：",
        "source": "运行模式:",
        "fr": "Mode :"
    },
    "build": {
        "en": "🔨 Build Mode",
        "zh": "🔨 建造",
        "source": "🔨 建造",
        "fr": "🔨 Mode construction"
    },
    "maintain": {
        "en": "🛡️ Maintain Mode",
        "zh": "🛡️ 维护",
        "source": "🛡️ 维护",
        "fr": "🛡️ Mode maintenance"
    },
    "threshold": {
        "en": "Energy Threshold:",
        "zh": "充能阈值：",
        "source": "充能阈值:",
        "fr": "Seuil d’énergie :"
    },
    "refreshMax": {
        "en": "Refresh Max Energy",
        "zh": "刷新最大能量上限",
        "source": "刷新最大能量上限",
        "fr": "Actualiser l’énergie maximale"
    },
    "dragThreshold": {
        "en": "Drag to adjust",
        "zh": "拖动调整",
        "source": "拖动调整",
        "fr": "Faire glisser pour ajuster"
    },
    "enterThreshold": {
        "en": "Enter an exact value",
        "zh": "精准输入",
        "source": "精准输入",
        "fr": "Saisir une valeur précise"
    },
    "freeHelp": {
        "en": "Include free colors, such as white and black",
        "zh": "是否绘制白色/黑色等常见背景色",
        "source": "是否绘制白色/黑色等常见背景色",
        "fr": "Inclure les couleurs gratuites, comme le blanc et le noir"
    },
    "free": {
        "en": "Place Free Colors",
        "zh": "绘制免费/背景色",
        "source": "绘制免费/背景色",
        "fr": "Utiliser les couleurs gratuites"
    },
    "transparentHelp": {
        "en": "Try placing transparent pixels",
        "zh": "是否尝试绘制透明像素",
        "source": "是否尝试绘制透明像素",
        "fr": "Essayer de placer les pixels transparents"
    },
    "transparent": {
        "en": "Place Transparent Pixels",
        "zh": "绘制透明层",
        "source": "绘制透明层",
        "fr": "Placer les pixels transparents"
    },
    "audioHelp": {
        "en": "Play a sound when the build is complete",
        "zh": "任务完成时播放提示音",
        "source": "任务完成时播放提示音",
        "fr": "Émettre un son à la fin de la construction"
    },
    "audio": {
        "en": "Audio Alerts",
        "zh": "完成提示音",
        "source": "完成提示音",
        "fr": "Alertes sonores"
    },
    "progress": {
        "en": "Progress",
        "zh": "进度",
        "source": "进度",
        "fr": "Progression"
    },
    "etaLabel": {
        "en": "Estimated time left",
        "zh": "预计剩余时间",
        "fr": "Temps restant estimé"
    },
    "etaIdle": {
        "en": "Estimated time left: --:--",
        "zh": "预计剩余时间：--:--",
        "source": "ETA: --:--",
        "fr": "Temps restant estimé : --:--"
    },
    "etaCalculating": {
        "en": "Estimated time left: calculating…",
        "zh": "预计剩余时间：计算中…",
        "source": "ETA: 计算中...",
        "fr": "Temps restant estimé : calcul en cours…"
    },
    "etaPending": {
        "en": "Estimated time left: …",
        "zh": "预计剩余时间：…",
        "source": "ETA: ...",
        "fr": "Temps restant estimé : …"
    },
    "etaOver": {
        "en": "Estimated time left: > 180 d",
        "zh": "预计剩余时间：> 180 天",
        "source": "ETA: > 180d",
        "fr": "Temps restant estimé : > 180 j"
    },
    "pixels": {
        "en": "🖌️ Correct pixels",
        "zh": "🖌️ 像素完成度",
        "source": "🖌️ 像素完成度",
        "fr": "🖌️ Pixels corrects"
    },
    "repairs": {
        "en": "🛡️ Pixels repaired",
        "zh": "🛡️ 已修复总数",
        "source": "🛡️ 已修复总数",
        "fr": "🛡️ Pixels réparés"
    },
    "start": {
        "en": "Start",
        "zh": "启动",
        "source": "启动",
        "fr": "Démarrer"
    },
    "stop": {
        "en": "Stop",
        "zh": "停止",
        "source": "停止",
        "fr": "Arrêter"
    },
    "launcher": {
        "en": "GhostPixel Bot Settings",
        "zh": "GhostPixel Bot 设置",
        "source": "打开 GhostPixel Bot",
        "fr": "Paramètres de GhostPixel Bot"
    },
    "language": {
        "en": "Language",
        "zh": "语言",
        "fr": "Langue"
    },
    "missingGhost": {
        "en": "Ghost image not loaded",
        "zh": "Ghost 图未加载",
        "source": "Ghost 图未加载",
        "fr": "Image fantôme non chargée"
    },
    "waitingData": {
        "en": "Waiting for data…",
        "zh": "等待数据…",
        "source": "等待数据...",
        "fr": "En attente des données…"
    },
    "complete": {
        "en": "Build Complete!",
        "zh": "画作已完成！",
        "source": "画作已完成！",
        "fr": "Construction terminée !"
    },
    "completeToast": {
        "en": "GhostPixel Bot: Build Complete!",
        "zh": "GhostPixel Bot：建造完成！",
        "source": "GhostPixel Bot: 建造完成！",
        "fr": "GhostPixel Bot : construction terminée !"
    },
    "monitoring": {
        "en": "Monitoring… all pixels correct",
        "zh": "监控中… 画面完美",
        "source": "监控中... 画面完美",
        "fr": "Surveillance… tous les pixels sont corrects"
    },
    "loggedOut": {
        "en": "Logged out",
        "zh": "已登出",
        "source": "已登出",
        "fr": "Déconnecté"
    },
    "loadConfig": {
        "en": "Failed to load settings",
        "zh": "无法加载设置",
        "source": "Failed to load config",
        "fr": "Impossible de charger les paramètres"
    },
    "saveConfig": {
        "en": "Could not save settings; changes apply to this session only",
        "zh": "无法保存设置；更改仅在本次会话生效",
        "source": "Failed to save config; continuing without persisting changes",
        "fr": "Impossible d’enregistrer les paramètres ; les changements restent valables pour cette session"
    },
    "audioFailed": {
        "en": "Could not play the alert sound",
        "zh": "无法播放提示音",
        "source": "Audio play failed",
        "fr": "Impossible de jouer l’alerte sonore"
    },
    "noControls": {
        "en": "Could not find #controls-left before the timeout. Launcher not added.",
        "zh": "等待超时，未找到 #controls-left，未添加启动按钮。",
        "source": "Could not find #controls-left after 60s. Launcher not injected.",
        "fr": "Délai dépassé : élément #controls-left introuvable. Bouton non ajouté."
    },
    "noGoogle": {
        "en": "Could not find the Google Sign-In element (\"g_id_onload\").",
        "zh": "找不到 Google 登录元素（\"g_id_onload\"）。",
        "source": "Could not find the Google Sign-In element (\"g_id_onload\").",
        "fr": "Élément de connexion Google (« g_id_onload ») introuvable."
    },
    "autoLogin": {
        "en": "Attempting automatic sign-in…",
        "zh": "正在尝试自动登录…",
        "source": "Attempting AutoLogin...",
        "fr": "Tentative de connexion automatique…"
    },
    "relogin": {
        "en": "Automatic sign-in failed; trying Google sign-in",
        "zh": "自动登录失败，正在尝试 Google 登录",
        "source": "AutoLogin failed, attempting relog with google",
        "fr": "Échec de la connexion automatique ; tentative via Google"
    },
    "googleFailed": {
        "en": "Google sign-in failed",
        "zh": "Google 登录失败",
        "source": "Google authentication failed",
        "fr": "Échec de la connexion Google"
    },
    "reload": {
        "en": "Loading ghost image pixels…",
        "zh": "正在加载图像像素…",
        "source": "Setting/Reloading ghost pixel data...",
        "fr": "Chargement des pixels de l’image fantôme…"
    },
    "noColors": {
        "en": "The page’s `Colors` variable is unavailable.",
        "zh": "页面的 `Colors` 变量不可用。",
        "source": "Page's `Colors` variable not available.",
        "fr": "La variable « Colors » de la page est indisponible."
    },
    "noTiles": {
        "en": "The page’s `tileImageCache` Map is unavailable.",
        "zh": "页面的 `tileImageCache` Map 不可用。",
        "source": "Page's `tileImageCache` Map is not available.",
        "fr": "La table « tileImageCache » de la page est indisponible."
    },
    "noGhostLog": {
        "en": "Ghost image not loaded.",
        "zh": "未加载图像。",
        "source": "Ghost image not loaded.",
        "fr": "Image fantôme non chargée."
    },
    "emptyData": {
        "en": "Ghost image data empty; retrying…",
        "zh": "图像数据为空，正在重试…",
        "source": "Ghost data empty, retrying...",
        "fr": "Données de l’image fantôme vides ; nouvelle tentative…"
    },
    "completeLog": {
        "en": "Build Complete!",
        "zh": "建造完成！",
        "source": "Build Complete!",
        "fr": "Construction terminée !"
    },
    "stopCommand": {
        "en": "Stop command received.",
        "zh": "已收到停止命令。",
        "source": "Stopping bot command received.",
        "fr": "Commande d’arrêt reçue."
    },
    "charging": {
        "en": "Charging… {spinner} ({current}/{target}) [Threshold: {threshold}]",
        "zh": "充能中… {spinner} ({current}/{target}) [阈值：{threshold}]",
        "fr": "Recharge en cours… {spinner} ({current}/{target}) [Seuil : {threshold}]"
    },
    "drawing": {
        "en": "Placing {count} pixels (batch {batch})…",
        "zh": "正在绘制 {count} 个点（批次 {batch}）…",
        "fr": "Placement de {count} pixels (lot {batch})…"
    },
    "maxSynced": {
        "en": "Max energy synced: {value}",
        "zh": "最大能量已同步：{value}",
        "fr": "Énergie maximale actualisée : {value}"
    },
    "filtered": {
        "en": "Filtered ghost pixels. Total: {value}",
        "zh": "筛选后的像素总数：{value}",
        "fr": "Pixels retenus dans l’image fantôme : {value}"
    },
    "placeFailed": {
        "en": "Failed to place pixels: {detail}",
        "zh": "像素放置失败：{detail}",
        "fr": "Échec du placement des pixels : {detail}"
    },
    "rateLimited": {
        "en": "Rate limited (429). Waiting {value} ms…",
        "zh": "触发频率限制（429），等待 {value} 毫秒…",
        "fr": "Limite de requêtes atteinte (429). Attente de {value} ms…"
    },
    "starting": {
        "en": "Starting Ghost Bot in {mode} mode…",
        "zh": "正在启动 Ghost Bot：{mode}…",
        "fr": "Démarrage de Ghost Bot : {mode}…"
    },
    "invalidHex": {
        "en": "Invalid hex color: {detail}",
        "zh": "无效的十六进制颜色：{detail}",
        "fr": "Couleur hexadécimale incorrecte : {detail}"
    },
    "loaded": {
        "en": "GhostPixel Bot v{version} loaded.",
        "zh": "GhostPixel Bot v{version} 已加载。",
        "fr": "GhostPixel Bot v{version} chargé."
    },
    "second": {
        "en": "s",
        "zh": "秒",
        "fr": "s"
    },
    "minute": {
        "en": "min",
        "zh": "分",
        "fr": "min"
    },
    "hour": {
        "en": "h",
        "zh": "小时",
        "fr": "h"
    },
    "day": {
        "en": "d",
        "zh": "天",
        "fr": "j"
    }
};
  const hasLanguage = (value) => ["en", "fr", "zh"].includes(value);
  const detectLanguage = () => {
    const code = (navigator.language || "en").split("-")[0].toLowerCase();
    return hasLanguage(code) && MESSAGES.language[code] ? code : "en";
  };
  let language = DEFAULT_LANGUAGE === "auto" ? detectLanguage() : DEFAULT_LANGUAGE;
  try {
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
    if (hasLanguage(savedLanguage)) language = savedLanguage;
  } catch (_) { /* Storage may be blocked; the UI still works. */ }
  const t = (key, params = {}) => {
    const entry = Object.prototype.hasOwnProperty.call(MESSAGES, key) ? MESSAGES[key] : null;
    const text = entry?.[language] ?? entry?.en ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
  };
  const formatNumber = (value, options = {}) => new Intl.NumberFormat(
    { fr: "fr-FR", en: "en-US", zh: "zh-CN" }[language], options
  ).format(value);
  const sourceKeys = new Map(Object.entries(MESSAGES)
    .filter(([, entry]) => entry.source !== undefined)
    .map(([key, entry]) => [entry.source, key]));
  const messagePatterns = [
    [/^充能中\.\.\. (.) \(([^/]+)\/([^)]*)\) \[Req: ([^\]]+)\]$/, "charging", ["spinner", "current", "target", "threshold"]],
    [/^正在绘制 (\d+) 个点 \(批次 (\d+)\)\.\.\.$/, "drawing", ["count", "batch"]],
    [/^Max energy synced: (.+)$/, "maxSynced", ["value"]],
    [/^Filtered ghost pixels\. Total: (.+)$/, "filtered", ["value"]],
    [/^Failed to place pixels: ([\s\S]*)$/, "placeFailed", ["detail"]],
    [/^Rate limited \(429\)\. Waiting (.+)ms\.\.\.$/, "rateLimited", ["value"]],
    [/^Starting Ghost Bot in \[(BUILD|MAINTAIN)\] mode\.\.\.$/, "starting", ["mode"]],
    [/^Invalid hex color: ([\s\S]*)$/, "invalidHex", ["detail"]],
    [/^GhostPixel Bot v(.+) Loaded\.$/, "loaded", ["version"]],
  ];
  const translateMessage = (message) => {
    if (typeof message !== "string") return message;
    if (sourceKeys.has(message)) return t(sourceKeys.get(message));
    for (const [pattern, key, names] of messagePatterns) {
      const match = message.match(pattern);
      if (!match) continue;
      const params = Object.fromEntries(names.map((name, index) => [name, match[index + 1]]));
      for (const name of ["current", "target", "threshold", "count", "batch", "value"]) {
        if (params[name] !== undefined && Number.isFinite(Number(params[name])))
          params[name] = formatNumber(Number(params[name]));
      }
      if (params.mode) params.mode = t(params.mode === "BUILD" ? "build" : "maintain").replace(/^[^\p{L}]+/u, "");
      return t(key, params);
    }
    // Unknown site/server errors remain available verbatim for diagnosis.
    return message;
  };
  let lastStatus = [" 状态: 已停止", "#ff595e", "🔴"];
  let lastProgress = null;
  let lastFixCount = 0;
  const renderLanguage = () => {
    const panel = document.getElementById("ghostBot-gui-panel");
    if (!panel) return;
    panel.lang = language;
    panel.querySelectorAll("[data-gb-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.gbI18n);
    });
    panel.querySelectorAll("[data-gb-title]").forEach((el) => {
      const text = t(el.dataset.gbTitle);
      el.title = text;
      el.setAttribute("aria-label", text);
    });
    const launcher = document.getElementById("ghostBot-launcher");
    if (launcher) {
      launcher.title = t("launcher");
      launcher.setAttribute("aria-label", t("launcher"));
    }
    panel.querySelector("#bot-language-select").value = language;
    updateGuiStatus(...lastStatus);
    if (lastProgress && usw.ghostBotGui) usw.ghostBotGui.updateProgress(lastProgress);
    else {
      panel.querySelector("#stats-progress-text").innerText = formatNumber(0, { style: "percent" });
      panel.querySelector("#stats-eta").innerText = t("etaIdle");
    }
    if (usw.ghostBotGui) usw.ghostBotGui.updateFixCount(lastFixCount);
    document.querySelectorAll(".gb-notification[data-gb-message]").forEach((el) => {
      el.innerText = translateMessage(el.dataset.gbMessage);
    });
  };
  const setLanguage = (value) => {
    if (!hasLanguage(value)) value = "en";
    language = value;
    try { localStorage.setItem(LANGUAGE_KEY, value); } catch (_) { /* Session-only choice. */ }
    renderLanguage();
  };

  // 运行时状态
  let isRunning = false;
  let fixCounter = 0;
  let sessionStartTime = 0;
  let sessionPixelsPlaced = 0;

  // 配置管理
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
    console.error(t("loadConfig"), e);
  }

  // Wrap localStorage write in try/catch
  const saveConfig = () => {
    try {
      localStorage.setItem("ghostBotConfig_v2", JSON.stringify(botConfig));
    } catch (e) {
      console.warn(
        t("saveConfig"),
        e
      );
    }
  };

  // Decoupled Config Logic
  // 1. Update state & persist
  const updateConfig = (key, value) => {
    botConfig[key] = value;
    saveConfig();
  };

  // 2. Apply config to runtime bot instance
  const applyConfigToBot = () => {
    if (!usw.ghostBot) return;
    usw.ghostBot.placeFreeColors = botConfig.placeFree;
    usw.ghostBot.placeTransparentGhostPixels = botConfig.placeTransparent;
    usw.ghostBot.reload();
  };

  //#region Utils & Helpers
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const log = (lvl, ...args) => {
    console.log(
      `%c[ghostBot] %c[${lvl.label}]`,
      "color: rebeccapurple;",
      `color:${lvl.color};`,
      ...args.map(translateMessage)
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

  const withErrorHandling = (asyncFn) => {
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

  const getTileData = (tileKey, bitmap) => {
    if (!tilePixelCache.has(tileKey)) {
      offscreen.width = bitmap.width;
      offscreen.height = bitmap.height;
      offCtx.drawImage(bitmap, 0, 0);
      const { data } = offCtx.getImageData(0, 0, bitmap.width, bitmap.height);
      tilePixelCache.set(tileKey, data);
    }
    return tilePixelCache.get(tileKey);
  }

  const needsPlacing = (pixel, tileKey, tileData, width, height) => {
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

  const evaluateAction = ({
    mode,
    currentEnergy,
    pixelCount,
    threshold,
    maxEnergy,
  }) => {
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
      console.error(t("audioFailed"), e);
    }
  };

  const showCompletionNotification = (message) => {
    const notification = document.createElement("div");
    notification.className = "gb-notification";
    notification.dataset.gbMessage = message;
    notification.innerText = translateMessage(message);
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.transition = "opacity 0.5s";
      notification.style.opacity = "0";
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  };

  // Centralized Max Energy Logic
  const MaxEnergy = (() => {
    let cached = null;

    const detect = () => {
      if (typeof usw.maxEnergy !== "undefined") return usw.maxEnergy;
      if (typeof maxEnergy !== "undefined") return maxEnergy;
      return null;
    };

    const get = () => {
      if (cached !== null) return cached;
      const detected = detect();
      // 移除默认的 200 限制，直接使用网页检测到的真实上限（如果未检测到则暂定为200）
      cached = detected !== null ? detected : 200;
      return cached;
    };

    const refresh = (forceSave = false) => {
      cached = null; // force re-detect
      const value = get();
      if (forceSave) updateConfig("maxEnergyLimit", value);
      return value;
    };

    return { get, refresh };
  })();
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

    .gb-label { min-width: 0; overflow-wrap: anywhere; }
    .gb-setting-row { gap: 8px; }
    .gb-stat-item { gap: 6px; flex-wrap: wrap; }
    .gb-stat-val { overflow-wrap: anywhere; }
    #gb-status-text { min-width: 0; overflow-wrap: anywhere; }
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
        <span class="gb-min-btn" data-gb-title="minimize" title="${t("minimize")}" aria-label="${t("minimize")}">_</span>
        <span class="gb-close" data-gb-title="hide" title="${t("hide")}" aria-label="${t("hide")}">✕</span>
      </div>
    </div>
    <div class="gb-content">
        <div id="ghost-status-line">
          <span id="gb-status-icon">🔴</span>
          <span id="gb-status-text" data-gb-i18n="initialStatus">${t("initialStatus")}</span>
        </div>
        <div class="gb-controls">
          <div class="gb-ctrl-row">
            <label for="bot-language-select" class="gb-label" data-gb-i18n="language">${t("language")}</label>
            <select id="bot-language-select" class="gb-input">
              <option value="fr" lang="fr">Français</option>
              <option value="en" lang="en">English</option>
              <option value="zh" lang="zh">中文</option>
            </select>
          </div>
          <div class="gb-ctrl-row">
            <label for="bot-mode-select" class="gb-label" data-gb-i18n="mode">${t("mode")}</label>
            <select id="bot-mode-select" class="gb-input">
              <option value="build" data-gb-i18n="build">${t("build")}</option>
              <option value="maintain" data-gb-i18n="maintain">${t("maintain")}</option>
            </select>
          </div>
          <div class="gb-ctrl-row">
            <div class="gb-label-row">
                 <label for="energy-threshold-input" class="gb-label" data-gb-i18n="threshold">${t("threshold")}</label>
                 <span id="btn-refresh-max" class="gb-refresh-btn" data-gb-title="refreshMax" title="${t("refreshMax")}" aria-label="${t("refreshMax")}">🔄</span>
            </div>
            <div class="gb-input-group">
                <input id="energy-threshold-slider" type="range" min="1" max="200" class="gb-slider" data-gb-title="dragThreshold" title="${t("dragThreshold")}" aria-label="${t("dragThreshold")}">
                <input id="energy-threshold-input" type="number" class="gb-input gb-num-small" min="1" max="200" data-gb-title="enterThreshold" title="${t("enterThreshold")}" aria-label="${t("enterThreshold")}">
            </div>
          </div>
        </div>
        <div class="gb-settings">
             <div class="gb-setting-row">
                <label class="gb-label" for="chk-free-color" data-gb-title="freeHelp" title="${t("freeHelp")}" aria-label="${t("freeHelp")}" data-gb-i18n="free">${t("free")}</label>
                <input type="checkbox" id="chk-free-color" class="gb-checkbox">
            </div>
            <div class="gb-setting-row">
                <label class="gb-label" for="chk-transparent" data-gb-title="transparentHelp" title="${t("transparentHelp")}" aria-label="${t("transparentHelp")}" data-gb-i18n="transparent">${t("transparent")}</label>
                <input type="checkbox" id="chk-transparent" class="gb-checkbox">
            </div>
            <div class="gb-setting-row">
                <label class="gb-label" for="chk-audio" data-gb-title="audioHelp" title="${t("audioHelp")}" aria-label="${t("audioHelp")}" data-gb-i18n="audio">${t("audio")}</label>
                <input type="checkbox" id="chk-audio" class="gb-checkbox">
            </div>
        </div>
        <div class="gb-stats">
          <div class="gb-row-between gb-progress-meta">
            <span style="color:#bbb" data-gb-i18n="progress">${t("progress")}</span>
            <span id="stats-progress-text" style="color:#1982c4; font-weight:bold">0%</span>
          </div>
          <div class="gb-progress-track">
            <div id="stats-progress-bar"></div>
          </div>
          <div id="stats-eta" data-gb-i18n="etaIdle">${t("etaIdle")}</div>
          <div class="gb-row-between gb-stat-item">
            <span style="color:#bbb" data-gb-i18n="pixels">${t("pixels")}</span>
            <span id="stats-pixel-count" class="gb-stat-val">- / -</span>
          </div>
          <div id="maintain-stats">
            <div class="gb-row-between gb-stat-item">
              <span style="color:#8ac926" data-gb-i18n="repairs">${t("repairs")}</span>
              <span id="fix-count-display" class="gb-stat-val" style="color:#8ac926; font-weight:bold">0</span>
            </div>
          </div>
        </div>
        <div class="gb-actions">
          <button id="btn-start" class="gb-btn gb-btn-start" data-gb-i18n="start">${t("start")}</button>
          <button id="btn-stop" class="gb-btn gb-btn-stop" disabled data-gb-i18n="stop">${t("stop")}</button>
        </div>
    </div>
  `;

  // UI Initialization
  const initLauncher = () => {
    const style = document.createElement("style");
    style.textContent = GUI_STYLES;
    document.head.appendChild(style);

    // Launcher polling with timeout/max attempts
    let attempts = 0;
    const MAX_ATTEMPTS = 60;
    const checkControls = setInterval(() => {
      const controlsLeft = document.getElementById("controls-left");
      // 确保网页的核心变量已加载，防止脚本过早抓取到 undefined
      const isGameReady = typeof usw.maxEnergy !== "undefined" && typeof usw.Colors !== "undefined";

      if (controlsLeft && isGameReady) {
        clearInterval(checkControls);
        createLauncherButton(controlsLeft);
        createPanel(); // Prepare panel but keep hidden
        applyConfigToBot(); // Apply config once bot/ui is ready
      } else if (++attempts > MAX_ATTEMPTS) {
        if (controlsLeft) {
          clearInterval(checkControls);
          createLauncherButton(controlsLeft);
          createPanel();
          applyConfigToBot();
        } else {
          clearInterval(checkControls);
          log(
            LOG_LEVELS.warn,
            "Could not find #controls-left after 60s. Launcher not injected."
          );
        }
      }
    }, 500);
  };

  const createLauncherButton = (parent) => {
    const btn = document.createElement("div");
    btn.id = "ghostBot-launcher";
    btn.innerHTML = "👻";
    btn.title = t("launcher");
    btn.setAttribute("aria-label", t("launcher"));
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
      // Prevent text selection during drag
      e.preventDefault();
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

    // Use updateConfig & applyConfigToBot
    panel.addEventListener("change", (e) => {
      if (e.target.id === "bot-language-select") setLanguage(e.target.value);
      if (e.target.id === "bot-mode-select") {
        updateConfig("mode", e.target.value);
        if (statsDiv)
          statsDiv.style.display =
            botConfig.mode === "maintain" ? "block" : "none";
      }
      if (e.target.id === "chk-free-color") {
        updateConfig("placeFree", e.target.checked);
        applyConfigToBot();
      }
      if (e.target.id === "chk-transparent") {
        updateConfig("placeTransparent", e.target.checked);
        applyConfigToBot();
      }
      if (e.target.id === "chk-audio")
        updateConfig("audioAlert", e.target.checked);
    });

    // [Unified] Threshold setting logic
    const setThreshold = (rawVal) => {
      const max = MaxEnergy.get();
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

  // ETA calculation helper moved inside GUI logic
  const computeEta = (sessionStartTime, sessionPixelsPlaced, remaining) => {
    if (!isRunning || sessionStartTime <= 0 || remaining <= 0)
      return t("etaIdle");
    const elapsedSec = (Date.now() - sessionStartTime) / 1000;
    if (sessionPixelsPlaced <= 2 || elapsedSec <= 5) return t("etaCalculating");
    const pixelsPerSec = sessionPixelsPlaced / elapsedSec;
    if (pixelsPerSec <= 0) return t("etaPending");
    const remainingSec = remaining / pixelsPerSec;
    if (remainingSec < 60) return `${t("etaLabel")}: ${formatNumber(Math.floor(remainingSec))} ${t("second")}`;
    if (remainingSec < 3600)
      return `${t("etaLabel")}: ${formatNumber(Math.floor(remainingSec / 60))} ${t("minute")} ${formatNumber(Math.floor(remainingSec % 60))} ${t("second")}`;
    if (remainingSec < 86400)
      return `${t("etaLabel")}: ${formatNumber(Math.floor(remainingSec / 3600))} ${t("hour")} ${formatNumber(Math.floor((remainingSec % 3600) / 60))} ${t("minute")}`;
    if (remainingSec < 15552000)
      return `${t("etaLabel")}: ${formatNumber(Math.floor(remainingSec / 86400))} ${t("day")} ${formatNumber(Math.floor((remainingSec % 86400) / 3600))} ${t("hour")}`;
    return t("etaOver");
  };

  const createPanel = () => {
    const panel = document.createElement("div");
    panel.id = "ghostBot-gui-panel";
    panel.innerHTML = GUI_HTML;
    panel.lang = language;
    document.body.appendChild(panel);

    wirePanelDragging(panel);
    wirePanelControls(panel);

    // Only updates UI elements, does NOT control logic `isRunning`
    const updateGuiState = (running) => {
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
      const newMax = MaxEnergy.refresh(forceSave);

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
      setRunning: updateGuiState, // Renamed to reflect visual-only nature
      refreshMax: updateMaxEnergyLimit,
      updateFixCount: (count) => {
        lastFixCount = count;
        if (fixCountDisplay) fixCountDisplay.innerText = formatNumber(count);
      },

      // UpdateProgress now takes an object payload and handles ETA internally
      updateProgress: ({ total, remaining, sessionStart, placed }) => {
        lastProgress = { total, remaining, sessionStart, placed };
        if (!statsPixelCount) return;
        if (total <= 0) return;

        const placedCount = total - remaining;
        const pct =
          total > 0 ? ((placedCount / total) * 100).toFixed(1) : "0.0";
        statsPixelCount.innerText = `${formatNumber(placedCount)} / ${formatNumber(total)}`;
        statsProgressText.innerText = formatNumber(Number(pct) / 100, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
        statsProgressBar.style.width = `${pct}%`;

        const isComplete = pct === "100.0";
        const color = isComplete ? "#ffca3a" : "#1982c4";
        statsProgressText.style.color = color;
        statsProgressBar.style.background = color;

        if (statsEta) {
          statsEta.innerText = computeEta(sessionStart, placed, remaining);
        }
      },
    };

    // Initial sync
    updateMaxEnergyLimit();
    renderLanguage();
  };

  const updateGuiStatus = (status, color = "white", icon = "ℹ️") => {
    lastStatus = [status, color, icon];
    const iconEl = document.getElementById("gb-status-icon");
    const textEl = document.getElementById("gb-status-text");
    if (iconEl) iconEl.innerText = icon;
    if (textEl) {
      textEl.innerText = translateMessage(status);
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

  // Flattened sendPixels with Iterative Retry Logic
  const sendPixels = async (pixels) => {
    const MAX_RETRIES = 3;
    let lastStatus = -1;
    let lastHeaders = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
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

        lastStatus = r.status;
        lastHeaders = r.headers;

        if (r.ok) {
          return { success: true, status: 200, headers: r.headers };
        }

        log(LOG_LEVELS.warn, "Failed to place pixels: " + (await r.text()));

        if (r.status === 401 && (await tryRelog())) {
          // retry immediately in next loop iteration
          continue;
        }

        // Non-401 errors: stop retry loop
        break;
      } catch (e) {
        log(LOG_LEVELS.error, e.message);
        console.error(e);
        await sleep(1000); // Short backoff on network error
      }
    }

    return { success: false, status: lastStatus, headers: lastHeaders };
  }

  const getCurrentEnergy = () => {
    if (typeof usw.currentEnergy !== "undefined") return usw.currentEnergy;
    if (typeof currentEnergy !== "undefined") return currentEnergy;
    return 0;
  };

  // Wait Logic with Throttling & Initial Pixels
  const waitForEnergyAndPixels = async (initialPixels, totalPixelsInTemplate) => {
    let throttleCounter = 0;
    let lastPixels = initialPixels;

    while (!stopWhileLoop && isRunning) {
      const currentEnergy = getCurrentEnergy();
      const safeMaxEnergy = MaxEnergy.get();

      // Throttle expensive pixel calculation (every 5 ticks/seconds)
      if (throttleCounter > 0 && throttleCounter % 5 === 0) {
        lastPixels = getPixelsToPlace();
        // Update progress bar during wait
        if (usw.ghostBotGui) {
          usw.ghostBotGui.updateProgress({
            total: totalPixelsInTemplate,
            remaining: lastPixels.length,
            sessionStart: sessionStartTime,
            placed: sessionPixelsPlaced,
          });
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

  // API Backoff Helper
  const handleApiBackoff = async (status, headers) => {
    if (status === 429) {
      const retryAfter = headers ? headers.get("Retry-After") : null;
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
      log(LOG_LEVELS.warn, `Rate limited (429). Waiting ${waitMs}ms...`);
      await sleep(waitMs);
    } else if (status !== 401) {
      // General error backoff
      await sleep(1000);
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
    if (isRunning) return;

    log(
      LOG_LEVELS.info,
      `Starting Ghost Bot in [${botConfig.mode.toUpperCase()}] mode...`
    );

    // Master switch ON
    isRunning = true;
    if (usw.ghostBotGui) usw.ghostBotGui.setRunning(true);

    stopWhileLoop = false;
    sessionStartTime = Date.now();
    sessionPixelsPlaced = 0;
    if (botConfig.mode === "maintain" && fixCounter === 0 && usw.ghostBotGui)
      usw.ghostBotGui.updateFixCount(0);

    while (!stopWhileLoop && isRunning) {
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

      // Initial progress update using new object payload
      if (usw.ghostBotGui) {
        usw.ghostBotGui.updateProgress({
          total: totalPixelsInTemplate,
          remaining: pixelsToPlace.length,
          sessionStart: sessionStartTime,
          placed: sessionPixelsPlaced,
        });
      }

      // Pass initial pixels to avoid double calculation
      const readyState = await waitForEnergyAndPixels(
        pixelsToPlace,
        totalPixelsInTemplate
      );
      if (!readyState) break; // Stopped

      const { currentEnergy, pixelsToPlace: readyPixels } = readyState;
      pixelsToPlace = readyPixels;

      if (pixelsToPlace.length === 0) {
        if (botConfig.mode === "build") {
          log(LOG_LEVELS.success, `Build Complete!`);
          updateGuiStatus("画作已完成！", "#ffca3a", "✨");
          if (botConfig.audioAlert) playNotificationSound();
          showCompletionNotification("GhostPixel Bot: 建造完成！");

          // Stop sequence
          stopWhileLoop = true;
          isRunning = false;
          if (usw.ghostBotGui) usw.ghostBotGui.setRunning(false);
          break;
        } else {
          updateGuiStatus("监控中... 画面完美", "#8ac926", "🛡️");
          await sleep(5000);
          continue;
        }
      }

      // Execution
      const countToSend = Math.min(currentEnergy, pixelsToPlace.length);
      // 先截取出当前能量允许发送的安全总数
      const pixelsThisRequest = pixelsToPlace.slice(0, countToSend);
      const MAX_BATCH_SIZE = 5000;

      // 对安全总数按 MAX_BATCH_SIZE 进行分批处理
      for (let i = 0; i < pixelsThisRequest.length; i += MAX_BATCH_SIZE) {
        if (!isRunning || stopWhileLoop) break;

        const chunk = pixelsThisRequest.slice(i, i + MAX_BATCH_SIZE);

        if (chunk.length > 0) {
          updateGuiStatus(
            `正在绘制 ${chunk.length} 个点 (批次 ${Math.floor(i / MAX_BATCH_SIZE) + 1})...`,
            "#A8D0DC",
            "🖌️"
          );

          // Handle API response object
          const result = await sendPixels(
            chunk.map((d) => ({
              GridX: d.gridCoord.x,
              GridY: d.gridCoord.y,
              Color: d.color.websiteId(),
            }))
          );

          if (!tokenUser) {
            updateGuiStatus("已登出", "orange", "⚠️");
            // Stop sequence
            stopWhileLoop = true;
            isRunning = false;
            if (usw.ghostBotGui) usw.ghostBotGui.setRunning(false);
            break;
          }

          if (result.success) {
            sessionPixelsPlaced += chunk.length;
            const estimatedRemaining = pixelsToPlace.length - (i + chunk.length);

            if (usw.ghostBotGui) {
              usw.ghostBotGui.updateProgress({
                total: totalPixelsInTemplate,
                remaining: Math.max(0, estimatedRemaining),
                sessionStart: sessionStartTime,
                placed: sessionPixelsPlaced,
              });
            }

            if (botConfig.mode === "maintain") {
              fixCounter += chunk.length;
              if (usw.ghostBotGui) usw.ghostBotGui.updateFixCount(fixCounter);
            }

            // 分批发送之间添加短暂延迟，避免突发流量被判定为滥用
            if (i + MAX_BATCH_SIZE < pixelsThisRequest.length) {
               await sleep(500);
            }
          } else {
            // API Backoff logic
            await handleApiBackoff(result.status, result.headers);
            break;
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

    // Ensure UI resets if loop exits
    isRunning = false;
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
      isRunning = false;
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
