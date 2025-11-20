# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] (todo)
- use own calls to the backend to not rely on global variables that may change
- multi account support
- multiple pixel ordering strategies
- auto buy locked colors
- auto buy upgrades
- farm mode
- viewport independence (fix camera centering requirement)
- audio alerts
- visual debugging overlay

## [0.4.1] - 2025-11-21
### Added
- **Minimize Functionality:** Added a minimize button (`_`) to the GUI, allowing the panel to collapse into a compact header to avoid blocking the canvas.
- **Boundary Protection:** The GUI panel is now strictly constrained within the browser viewport, preventing it from being dragged off-screen or lost during window resizing.

### Changed
- **Polling Logic:** Simplified the energy waiting logic to a robust, fixed-interval check, removing unnecessary complexity.
- **Code Cleanup:** Inlined UI helper functions to reduce abstraction and streamline the script structure as per code review suggestions.

### Fixed
- **Energy Safety:** Fixed potential issues where undefined energy values could cause the bot to stall (implemented safe integer fallback).
- **UI Flickering:** Removed over-aggressive progress caching to ensure the progress bar always reflects real-time state.

## [0.4.0] - 2025-11-21
### Added
- **Graphical User Interface (GUI):** A draggable, comprehensive control panel to manage the bot without console commands.
- **Dual Operation Modes:**
    - `Build Mode`: Standard mode to fill in the ghost image.
    - `Maintain Mode`: Infinite loop mode to watch for griefing and repair artwork instantly.
- **Visual Statistics:** Real-time progress bars, pixel counts, and repair counters displayed in the panel.
- **Background Execution:** Optimized loop logic to ensure the bot continues running reliably in background tabs without throttling.
- **Non-blocking Notifications:** Replaced intrusive browser alerts with smooth toast notifications for completion events.

### Changed
- **Smart Energy Management:** Completely rewrote the waiting logic. The bot now calculates exact wait times and acts immediately when energy is sufficient (0s delay), greatly improving efficiency.
- **Code Architecture:** Refactored the entire GUI construction to use static templates and event delegation, improving performance and maintainability.
- **Security:** Removed unsafe string interpolation in DOM generation to prevent potential XSS vulnerabilities.
- **Robustness:** Added guards to prevent duplicate GUI initialization and handle bot stop states more gracefully.

## [0.3.2] - 2025-10-23
### Added
- error handling
### Changed
- `ignoredColors` is now a `Set`
### Fixed
- fix the bot not starting when `ignoredColors` was undefined

## [0.3.1] - 2025-10-23
### Added
- Ability to not place specified colors thourgh `ghostBot.ignoreColors()`
### Changed
- if there are less pixels left to place than the mex energy, don't wait until energy is filled but until there's just enough for next batch

## [0.3.0] - 2025-10-23
### Changed
- the settings are now accessible
- the functions and settings are now in an object named `ghostBot`
### Added
- Ability to not place free colors (`ghostBot.placeFreeColors`)
- `ghostBot.reload()` : reloads ghost data

## [0.2.1] - 2025-10-22
### Changed
- stop the bot if logged out and relog fails
- don't wait for next full recharge to stop the bot when all pixels are placed

## [0.2.0] - 2025-10-22
### Changed
- don't "fetch" the whole ghostimage each time we place pixels
### Added
- Automatic relogging

## [0.1.0] - 2025-10-06
### Added
- paint color by color (least frequent first)
- log function
### Changed
- make `stopGhostBot()` actually stop the bot lol
- refactor Color Utils to use a class

## [0.0.1] - 2025-10-04
- make this a userscript

## [0.0.0] - 2025-10-03
- initial release
