# Rapport des textes traduits — 16 novembre 2026

Base originale : `Dax233/GeoPixelsBot@efda7d87cadbb27954f58041d8bccbdf9fce20a2` (0.4.3). **63 entrées**, avec français, anglais et chinois. Le recensement syntaxique des **226 littéraux et gabarits source**, y compris valeurs techniques, styles et HTML, est conservé dans `../GeoPlacer-Audit/evidence/dax233-string-inventory.json`. Ces 226 objets ne sont pas 226 libellés : beaucoup sont des identifiants, couleurs CSS, endpoints ou fragments de code.

Les fonctions métier gardent leurs chaînes originales, identifiants des messages aux frontières d’affichage. Les gabarits dynamiques sont reconnus par des motifs centralisés et testés. Les commentaires ne sont pas des textes d’interface. Les noms natifs des langues et identifiants techniques sont conservés. Les réponses serveur et piles d’erreur brutes restent des données de diagnostic.

Le nom « GhostPixel Bot » est conservé ; la description Tampermonkey possède une variante française. « Pixels corrects » correspond au compteur réel, qui inclut les pixels déjà corrects avant la session. Aucune confirmation absente du code n’a été inventée.

## Catalogue complet

| Clé | Source amont / nature | Français | Anglais de repli | Chinois conservé |
|---|---|---|---|---|
| minimize | 最小化/还原 | Réduire / Rétablir | Minimize / Restore | 最小化/还原 |
| hide | 隐藏面板 (后台继续运行) | Masquer le panneau (activité maintenue) | Hide panel (continues in background) | 隐藏面板 (后台继续运行) |
| stopped | 已停止 | Arrêté | Stopped | 已停止 |
| initialStatus |  状态: 已停止 | État : arrêté | Status: Stopped | 状态：已停止 |
| mode | 运行模式: | Mode : | Mode: | 运行模式： |
| build | 🔨 建造 | 🔨 Mode construction | 🔨 Build Mode | 🔨 建造 |
| maintain | 🛡️ 维护 | 🛡️ Mode maintenance | 🛡️ Maintain Mode | 🛡️ 维护 |
| threshold | 充能阈值: | Seuil d’énergie : | Energy Threshold: | 充能阈值： |
| refreshMax | 刷新最大能量上限 | Actualiser l’énergie maximale | Refresh Max Energy | 刷新最大能量上限 |
| dragThreshold | 拖动调整 | Faire glisser pour ajuster | Drag to adjust | 拖动调整 |
| enterThreshold | 精准输入 | Saisir une valeur précise | Enter an exact value | 精准输入 |
| freeHelp | 是否绘制白色/黑色等常见背景色 | Inclure les couleurs gratuites, comme le blanc et le noir | Include free colors, such as white and black | 是否绘制白色/黑色等常见背景色 |
| free | 绘制免费/背景色 | Utiliser les couleurs gratuites | Place Free Colors | 绘制免费/背景色 |
| transparentHelp | 是否尝试绘制透明像素 | Essayer de placer les pixels transparents | Try placing transparent pixels | 是否尝试绘制透明像素 |
| transparent | 绘制透明层 | Placer les pixels transparents | Place Transparent Pixels | 绘制透明层 |
| audioHelp | 任务完成时播放提示音 | Émettre un son à la fin de la construction | Play a sound when the build is complete | 任务完成时播放提示音 |
| audio | 完成提示音 | Alertes sonores | Audio Alerts | 完成提示音 |
| progress | 进度 | Progression | Progress | 进度 |
| etaLabel | Message dynamique ou nouvel élément | Temps restant estimé | Estimated time left | 预计剩余时间 |
| etaIdle | ETA: --:-- | Temps restant estimé : --:-- | Estimated time left: --:-- | 预计剩余时间：--:-- |
| etaCalculating | ETA: 计算中... | Temps restant estimé : calcul en cours… | Estimated time left: calculating… | 预计剩余时间：计算中… |
| etaPending | ETA: ... | Temps restant estimé : … | Estimated time left: … | 预计剩余时间：… |
| etaOver | ETA: > 180d | Temps restant estimé : > 180 j | Estimated time left: > 180 d | 预计剩余时间：> 180 天 |
| pixels | 🖌️ 像素完成度 | 🖌️ Pixels corrects | 🖌️ Correct pixels | 🖌️ 像素完成度 |
| repairs | 🛡️ 已修复总数 | 🛡️ Pixels réparés | 🛡️ Pixels repaired | 🛡️ 已修复总数 |
| start | 启动 | Démarrer | Start | 启动 |
| stop | 停止 | Arrêter | Stop | 停止 |
| launcher | 打开 GhostPixel Bot | Paramètres de GhostPixel Bot | GhostPixel Bot Settings | GhostPixel Bot 设置 |
| language | Message dynamique ou nouvel élément | Langue | Language | 语言 |
| missingGhost | Ghost 图未加载 | Image fantôme non chargée | Ghost image not loaded | Ghost 图未加载 |
| waitingData | 等待数据... | En attente des données… | Waiting for data… | 等待数据… |
| complete | 画作已完成！ | Construction terminée ! | Build Complete! | 画作已完成！ |
| completeToast | GhostPixel Bot: 建造完成！ | GhostPixel Bot : construction terminée ! | GhostPixel Bot: Build Complete! | GhostPixel Bot：建造完成！ |
| monitoring | 监控中... 画面完美 | Surveillance… tous les pixels sont corrects | Monitoring… all pixels correct | 监控中… 画面完美 |
| loggedOut | 已登出 | Déconnecté | Logged out | 已登出 |
| loadConfig | Failed to load config | Impossible de charger les paramètres | Failed to load settings | 无法加载设置 |
| saveConfig | Failed to save config; continuing without persisting changes | Impossible d’enregistrer les paramètres ; les changements restent valables pour cette session | Could not save settings; changes apply to this session only | 无法保存设置；更改仅在本次会话生效 |
| audioFailed | Audio play failed | Impossible de jouer l’alerte sonore | Could not play the alert sound | 无法播放提示音 |
| noControls | Could not find #controls-left after 60s. Launcher not injected. | Délai dépassé : élément #controls-left introuvable. Bouton non ajouté. | Could not find #controls-left before the timeout. Launcher not added. | 等待超时，未找到 #controls-left，未添加启动按钮。 |
| noGoogle | Could not find the Google Sign-In element ("g_id_onload"). | Élément de connexion Google (« g_id_onload ») introuvable. | Could not find the Google Sign-In element ("g_id_onload"). | 找不到 Google 登录元素（"g_id_onload"）。 |
| autoLogin | Attempting AutoLogin... | Tentative de connexion automatique… | Attempting automatic sign-in… | 正在尝试自动登录… |
| relogin | AutoLogin failed, attempting relog with google | Échec de la connexion automatique ; tentative via Google | Automatic sign-in failed; trying Google sign-in | 自动登录失败，正在尝试 Google 登录 |
| googleFailed | Google authentication failed | Échec de la connexion Google | Google sign-in failed | Google 登录失败 |
| reload | Setting/Reloading ghost pixel data... | Chargement des pixels de l’image fantôme… | Loading ghost image pixels… | 正在加载图像像素… |
| noColors | Page's `Colors` variable not available. | La variable « Colors » de la page est indisponible. | The page’s `Colors` variable is unavailable. | 页面的 `Colors` 变量不可用。 |
| noTiles | Page's `tileImageCache` Map is not available. | La table « tileImageCache » de la page est indisponible. | The page’s `tileImageCache` Map is unavailable. | 页面的 `tileImageCache` Map 不可用。 |
| noGhostLog | Ghost image not loaded. | Image fantôme non chargée. | Ghost image not loaded. | 未加载图像。 |
| emptyData | Ghost data empty, retrying... | Données de l’image fantôme vides ; nouvelle tentative… | Ghost image data empty; retrying… | 图像数据为空，正在重试… |
| completeLog | Build Complete! | Construction terminée ! | Build Complete! | 建造完成！ |
| stopCommand | Stopping bot command received. | Commande d’arrêt reçue. | Stop command received. | 已收到停止命令。 |
| charging | Message dynamique ou nouvel élément | Recharge en cours… {spinner} ({current}/{target}) [Seuil : {threshold}] | Charging… {spinner} ({current}/{target}) [Threshold: {threshold}] | 充能中… {spinner} ({current}/{target}) [阈值：{threshold}] |
| drawing | Message dynamique ou nouvel élément | Placement de {count} pixels (lot {batch})… | Placing {count} pixels (batch {batch})… | 正在绘制 {count} 个点（批次 {batch}）… |
| maxSynced | Message dynamique ou nouvel élément | Énergie maximale actualisée : {value} | Max energy synced: {value} | 最大能量已同步：{value} |
| filtered | Message dynamique ou nouvel élément | Pixels retenus dans l’image fantôme : {value} | Filtered ghost pixels. Total: {value} | 筛选后的像素总数：{value} |
| placeFailed | Message dynamique ou nouvel élément | Échec du placement des pixels : {detail} | Failed to place pixels: {detail} | 像素放置失败：{detail} |
| rateLimited | Message dynamique ou nouvel élément | Limite de requêtes atteinte (429). Attente de {value} ms… | Rate limited (429). Waiting {value} ms… | 触发频率限制（429），等待 {value} 毫秒… |
| starting | Message dynamique ou nouvel élément | Démarrage de Ghost Bot : {mode}… | Starting Ghost Bot in {mode} mode… | 正在启动 Ghost Bot：{mode}… |
| invalidHex | Message dynamique ou nouvel élément | Couleur hexadécimale incorrecte : {detail} | Invalid hex color: {detail} | 无效的十六进制颜色：{detail} |
| loaded | Message dynamique ou nouvel élément | GhostPixel Bot v{version} chargé. | GhostPixel Bot v{version} loaded. | GhostPixel Bot v{version} 已加载。 |
| second | Message dynamique ou nouvel élément | s | s | 秒 |
| minute | Message dynamique ou nouvel élément | min | min | 分 |
| hour | Message dynamique ou nouvel élément | h | h | 小时 |
| day | Message dynamique ou nouvel élément | j | d | 天 |

## Résultats

- 13/13 tests automatiques ; syntaxe Node et ES2022 validée.
- 26 déclarations protégées identiques à l’amont et licence inchangée.
- Page factice Edge : trois langues et français à 390 px ; aucun débordement détecté, aucune erreur de page, aucun appel réseau.
- Captures et résultats : `screenshots/`. Installation, retour arrière et limites : `LOCALISATION-FR.md`.
- Aucun test sur le serveur GeoPixels ni dans Tampermonkey réel.
