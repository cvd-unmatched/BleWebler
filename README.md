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

### Releasing a Docker image

Pushing a `vX.Y.Z` git tag triggers `.github/workflows/release.yml`, which builds the `Dockerfile` (plain nginx serving the static files) and pushes it to `ghcr.io/<owner>/<repo>`, tagged with both the version and `latest`.

To cut a release, run `.\release.ps1 patch` (or `./release.sh patch`, or `minor`/`major`/`rc`) from the repo root. There's no `VERSION` file or `package.json` to keep in sync, the version is derived from the latest `vX.Y.Z` git tag, since this is a static site with no build step or npm dependencies to version alongside. The script creates an annotated tag and pushes it; everything else happens in CI.

Once the workflow finishes:
```bash
docker pull ghcr.io/<owner>/<repo>:latest
docker run -d -p 8080:80 ghcr.io/<owner>/<repo>:latest
```
Put a reverse proxy with TLS in front of it (Caddy, Nginx, etc.), Web Bluetooth requires a secure context (HTTPS or `localhost`), so plain HTTP over a LAN IP won't work.

---

## Linking In From Another App

Since these BLE label printers don't show up in a normal OS print dialog (no driver, Bluetooth-only), the way to print from another program is to have it open BleWebler in a browser tab with the label's content in the URL, then a person clicks "Print!" once. Web Bluetooth requires a user gesture to connect, so this can't be made fully automatic, one click is the floor.

### One-time setup: design and save a template

The field schema has no fixed defaults, it's entirely defined by what you tag inside BleWebler. Do this once:
1. Design the label layout (add text/QR/image objects, position and style them).
2. Tag each object with a **merge field name** (in its object controls). The name you choose is the column/param name your export or link must use later, exactly, case-sensitively.
3. Save it as a Saved Label. The name you give it there is what `label=` below will reference.

A ready-made example lives at [`examples/inventory-label.json`](examples/inventory-label.json): a text object tagged `name`, a text object tagged `location`, and a QR object tagged `qr`, sized for a 40mm×12mm P15 label. Import it via Saved Labels → "Import from file" and it's saved under the name `inventory-label`, matching the examples below directly.

### `label=`: pin to a specific template

Without this, any URL-based content hand-off silently depends on "whatever's currently on screen" in that browser, which breaks the moment someone changes the design for an unrelated reason. `label=<saved label name>` (case-insensitive) loads that exact Saved Label before applying anything else, so the schema stays pinned regardless of what was on screen before. If the name isn't found, BleWebler logs a console warning and falls back to whatever's currently on screen rather than failing silently.

### Printing a single label

Every URL parameter that isn't one of BleWebler's own settings (`printer`, `width`, `height`, `infinite`, `paddingTop/Bottom/Left/Right`, `label`, `csv`) is treated as a merge field value, matched by an object's merge field tag, e.g. `name`, `location`, `qr` for the example template above.

**Example**, using the `inventory-label` template from above:
```
https://your-blewebler-url/?printer=1&width=40&height=12&label=inventory-label&name=Widget%2042&location=Home%20%3E%20Office%20%3E%20Bin%205&qr=https%3A%2F%2Fexample.com%2Fitem%2F42
```

(A legacy `text=`/`qr=` shorthand also exists for when no template is tagged at all: it fills the first plain text object and first QR object on the canvas, or creates them if none exist. It only applies to fields with no matching merge tag, so it won't conflict with a tagged `qr` field like the one above.)

### Printing many labels at once (bulk export)

Don't have to guess the column names: open **Batch Print** and click **"Download CSV Template"** to get a CSV with the header row (and one example row pulled from the current design) matching whatever's tagged with a merge field right now.

**Recommended: download a real CSV file, then upload it.** Have your program generate and download a normal CSV (header row first, one column per merge field, comma-delimited, values matched by header name so column order doesn't matter), then open BleWebler's **Batch Print** modal and use its file upload, it parses and previews automatically the moment a file is selected, no separate button click needed. No URL-length limit, no CORS to configure, nothing sitting in a URL bar or server log, just a plain file. The QR column's value is used verbatim as the QR payload (a bare URL, or any string), it is not built from separate sub-fields.

There's also a `csv` URL parameter (URL-encoded CSV data, header row first) that opens Batch Print pre-loaded and pre-parsed automatically, e.g.:
```
https://your-blewebler-url/?printer=1&width=40&height=12&csv=name%2Clocation%2Cqr%0AWidget%2042%2CHome%20%3E%20Office%2Chttps%3A%2F%2Fexample.com%2F42
```
This is fine for quick tests or small lists, but the data lives directly in the URL, so it inherits browser/server URL-length limits and shows up in browser history and server access logs. For a real export, the file upload above is the better default.

**Where to host it**: this repo isn't currently published anywhere with these newer features (the [live-hosted link](https://josb25.github.io/BleWebler/) above is the upstream project's own version, without this URL-integration or the other changes in this fork). To get a stable URL to link to, either enable GitHub Pages on this fork (`cvd-unmatched/BleWebler`) pointing at a chosen branch, or serve it from your own infrastructure alongside the other app.

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