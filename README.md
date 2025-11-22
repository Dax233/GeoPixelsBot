# GhostPixel Bot (Dax233's Fork) 👻

A powerful, GUI-enhanced bot for automatic ghost placement on [geopixels.net](https://geopixels.net).

> **Note:** This is a heavily modified fork of the [original bot by nymtuta](https://github.com/nymtuta/GeoPixelsBot). This version focuses on ease of use, automation, and maintenance capabilities.

## ✨ Key Features

Unlike the original script, this fork provides a full graphical interface and advanced logic:

- **🖥️ Graphical User Interface (GUI):** No more typing commands in the console! Control everything from a sleek, draggable panel directly on the screen.
- **🔨 Build Mode:** Automatically places pixels to complete your ghost image. Stops and sends a notification when the artwork is finished.
- **🛡️ Maintain Mode:** After building, switch to this mode. It monitors your artwork indefinitely and instantly repairs any pixels that get griefed or covered.
- **⚙️ Advanced Controls:** Toggle "Place Free Colors", "Transparent Pixels", and "Audio Alerts" directly from the UI.
- **⚡ Smart Energy Management:** Configurable energy threshold. The bot waits efficiently and acts immediately when energy is ready. Includes API rate-limit protection.
- **🌙 Background Running:** Optimized to run in background tabs without throttling, perfect for AFK farming.
- **📊 Real-time Stats:** Visual progress bars, pixel counts, ETA (Estimated Time of Arrival), and repair statistics.

## ✅ Project Status

### Completed Features
- [x] **GUI Panel:** Complete control panel with status indicators and draggable window.
- [x] **Dual Modes:** Implemented `Build` and `Maintain` logic.
- [x] **Advanced Settings:** Toggle Free Colors, Transparent Pixels, and Audio Alerts via GUI.
- [x] **Energy Optimization:** Smart waiting logic with throttling and API backoff mechanisms.
- [x] **Non-blocking Notifications:** Replaced annoying alerts with smooth toast notifications.
- [x] **Background Execution:** Works even when the tab is not active.

### 🗺️ Roadmap (Planned)
We are actively working on the following features. Feel free to contribute!

- [ ] **Advanced GUI Settings:**
    - Manage "Ignored Colors" list visually.
- [ ] **Multi-Account Support:** Quickly switch between different user tokens/accounts for managing multiple bots.
- [ ] **Viewport Independence:** (Original Author's Plan) Fix the limitation where the camera must be centered on the ghost image.

## 📥 Installation

1. **Install a UserScript Manager:**
   - [Violentmonkey](https://violentmonkey.github.io/) (Recommended)
   - [Tampermonkey](https://www.tampermonkey.net/)

2. **Install the Script:**
   - [**Click Here to Install**](https://github.com/Dax233/GeoPixelsBot/raw/refs/heads/main/ghostBot.user.js)

## 🎮 Usage

Once installed, refresh the GeoPixels game page. You will see the **GhostPixel Bot Panel** on the right side of the screen.

### The Control Panel

1.  **Load your Ghost:** Make sure your Ghost image is loaded in the game as usual.
2.  **Select Mode:**
    * `🔨 Build Mode`: Default. Fills in the missing pixels.
    * `🛡️ Maintain Mode`: Use this for finished art. It will watch for changes and fix them.
3.  **Energy Threshold:** Set how much energy to accumulate before placing a batch (Default: 10).
4.  **Start/Stop:** Click the buttons to control the bot.

> **Tip:** You can leave the tab in the background. The bot handles visibility states and will continue working.

### Advanced / Legacy Console Commands

While the GUI covers most needs, the internal API is still accessible via the browser console (`F12`) if you need granular control:

- `ghostBot.ignoreColors(['#hex1', '#hex2'])` : Add colors to the ignore list.
- `ghostBot.config` : View current configuration object.

## ⚙️ Configuration

Most settings are now adjustable directly in the GUI:

- **Place Transparent Pixels:** (GUI Checkbox)
- **Place Free Colors:** (GUI Checkbox)
- **Audio Alert:** (GUI Checkbox) Play a sound when build is complete.

## 🤝 Contributing

Feel free to open issues or submit pull requests if you find bugs or have ideas for new features.

## 📜 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---
*Original work by nymtuta. Enhanced with ❤️ by Dax233.*