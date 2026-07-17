# BleWebler

**BleWebler** is a browser-based solution for thermal label printing. It leverages the **Web Bluetooth API** to connect directly to supported Bluetooth Low Energy (BLE) printers, eliminating the need for drivers, proprietary apps, or vendor lock-in.

# [**Try it here!**](https://josb25.github.io/BleWebler/)

---

## Key Features

### Privacy-First & Open Source
BleWebler runs entirely within your browser. **No data is ever sent to a server.** Your designs and labels stay on your device, ensuring complete privacy and security.

### Zero Installation
- **No Drivers**: Connects directly to hardware via Web Bluetooth.
- **No Apps**: Works on any modern operating system (Windows, macOS, Linux, Android, ChromeOS) with a compatible browser.
- **Instant Start**: Just open the URL and start printing.

### Image Processing
Thermal printers require specific image preparation. BleWebler includes industry standard dithering algorithms to ensure your images look crisp and clear on 1-bit printers:
- **Floyd-Steinberg**
- **Atkinson**
- **Bayer**
- **Binary Threshold**

### Flexible Media Support
- **Infinite Paper**: Support for continuous label rolls with variable lengths.
- **Fixed Sizes**: Presets for standard label sizes.
- **Auto-Scaling**: Canvas automatically adjusts to the printer's resolution (DPI).

### Alignment & Batch Printing
- **Print Alignment Test**: Prints a label showing the current padding bounds as guide lines, so you can dial in margins against your physical label stock.
- **Batch Print (CSV mail-merge)**: Tag text, image, or QR objects with a merge field name, then print one label per row of an imported CSV, substituting each tagged field's content per row. Image fields work best with `data:` URIs, external URLs need CORS enabled on the host.
- **Saved Labels**: Save label designs in the browser (`localStorage`, nothing ever leaves your device) to come back to later, and export/import any saved label as a `.json` file to back it up or move it to another device.
- **Bleed toggle**: Objects are normally kept within the padding bounds; flip "Allow bleed" to let an object be dragged or resized past the label edge for a full-bleed, edge-to-edge print (anything outside the label is simply clipped when printed).

---

## Supported Hardware

BleWebler currently supports the following Marklife printers:
- Marklife P12
- Marklife P15
- Pristar P15
- L13 (SilverCrest and others)

*More models can and will be added via the modular printer driver architecture.*

---

## Requirements

- **Browser**: A Chromium-based browser (Chrome, Edge, ...) with Web Bluetooth Support.
- **Hardware**: A computer or mobile device with Bluetooth 4.0+ support.

---

## How to Run

BleWebler is a static site (plain HTML/CSS/JS, no build step, no `npm install` required). To run it locally, serve the project folder with any static file server and open it in a Chromium-based browser. Opening `index.html` directly via `file://` will *not* work because Web Bluetooth requires a proper HTTP(S) origin.

**Python** (no other dependencies needed):
```bash
python -m http.server 8420
```
Then open `http://localhost:8420`.

**Node.js**, if you have it installed:
```bash
npx serve .
```

Either way, once it's running:
1. Open the URL in Chrome or Edge (desktop or Android).
2. Pick your printer model and paper size in the setup dialog.
3. Pair your BLE label printer when prompted.

To try the live-hosted version instead, see [**Try it here!**](https://josb25.github.io/BleWebler/) above: no local setup needed.

---

## Known Issues / In Progress

### Printer gap-sync on the first label after a tear (unverified fix, needs hardware testing)
On gap-fed ("segmented") label stock, the printer has no way to know where a label starts until it's fed past a gap at least once. So the very first print after a tear can land mid-label, while every print after that lands correctly (because the previous print already advanced the paper past a gap).

What's been done so far:
- `js/marklife_p12.js` now exposes `feedToNextLabel(device)`, wired to a **"Re-sync / Feed to Next Label"** button in the Advanced section of the UI. It resends the exact same gap-feed byte sequence (`0x1d,0x0c,0x10` / `0xff,0xf1,0x45` / `0x10,0xff,0x40` / `0x10,0xff,0x40`) that the driver already sends *after* every print on segmented paper: no new/guessed protocol bytes.
- Verbose `log()` calls were added around every BLE connect/print/feed step (visible in the Advanced &rarr; log panel) to make it possible to correlate what was sent against what happened physically.
- **What's not done**: nobody has confirmed on real hardware whether pressing "Re-sync" before the first print actually fixes the misalignment, or whether it needs to fire automatically on connect instead (or something else entirely, e.g. a different, currently-unknown "locate gap" command).

**If you're picking this up**: connect to a real printer, tear off a label, press "Re-sync," print, and compare against just printing without pressing it first. Paste the log panel output into the issue/PR so the byte-level timeline is visible. Once confirmed working, `feedToNextLabel()` could be called automatically the first time `printLabel()` runs after a fresh connect.

---

## License

Licensed under the **GPLv3 License**. You are free to use, modify, and distribute this software in accordance with the license terms.


## Credits / Third Party Libraries

This project makes use of open source libraries:

### Fabric.js
* **Website:** [http://fabricjs.com/](http://fabricjs.com/)
* **Version:** 5.3.0
* **Copyright:** © 2008-2015 Juriy Zaytsev & Kangax
* **License:** [MIT License](https://github.com/fabricjs/fabric.js/blob/master/LICENSE)