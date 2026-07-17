// Build filters from namePrefix
const bluetoothFilters = supportedPrinters.map(p => ({
  namePrefix: p.namePrefix
}));

// Collect all optional services from all supported printers
const optionalServices = [
  ...new Set(
    supportedPrinters
      .flatMap(p => p.optionalServices || [])
  )
];

let device = null;
let printerInstance = null;

async function connectPrinter() {
  if (device && device.gatt.connected && printerInstance) {
    return printerInstance;
  }

  try {
    device = await navigator.bluetooth.requestDevice({
      filters: bluetoothFilters,
      optionalServices: optionalServices
    });

    const printer = supportedPrinters.find(p => p.pattern.test(device.name));

    if (printer) {
      log(`Detected printer: ${device.name} -> matched ${printer.name}`);
      printerInstance = new printer.printerClass();
      await printerInstance.connect(device);
      return printerInstance;
    } else {
      log(`Unsupported printer model: ${device.name}`);
      return null;
    }
  } catch (err) {
    log("Bluetooth error: " + err);
    throw err;
  }
}

async function printLabel() {
  try {
    await connectPrinter();

    if (printerInstance) {
      const printer = supportedPrinters.find(p => p.pattern.test(device.name));
      const infinitePaperCheckbox = document.getElementById("infinitePaperCheckbox");
      const isSegmented = infinitePaperCheckbox ? !infinitePaperCheckbox.checked : true; // Default to segmented if checkbox missing
      const isInfinitePaper = infinitePaperCheckbox ? infinitePaperCheckbox.checked : false;

      // Get copy count and spacing
      const copyCountInput = document.getElementById("copyCount");
      const copyCount = copyCountInput ? parseInt(copyCountInput.value) || 1 : 1;


      // Loop to print each copy individually
      for (let i = 0; i < copyCount; i++) {
        log(`Printing copy ${i + 1} of ${copyCount}...`);

        // Construct bitmap for a SINGLE copy
        // We pass 1 as copyCount to constructBitmap so it generates just one label
        // We preserve isInfinitePaper and spacingMm logic, though spacingMm mostly applies to the "gap" in the canvas method. 
        // For separate print jobs, the printer's feed commands (in the class) handle the separation.
        const bitmap = constructBitmap(printer.px, 1, isInfinitePaper);

        if (bitmap) {
          await printerInstance.print(device, bitmap, isSegmented);
        }

        // Add a small delay between copies to ensure printer processes the buffer
        if (i < copyCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      log("All copies printed successfully.");
    }

  } catch (err) {
    console.error("Print failed:", err);
    log("Print failed: " + err);
  }
}

async function printAlignmentTest() {
  try {
    await connectPrinter();

    if (printerInstance) {
      const printer = supportedPrinters.find(p => p.pattern.test(device.name));
      const infinitePaperCheckbox = document.getElementById("infinitePaperCheckbox");
      const isSegmented = infinitePaperCheckbox ? !infinitePaperCheckbox.checked : true;
      const isInfinitePaper = infinitePaperCheckbox ? infinitePaperCheckbox.checked : false;

      log("Printing alignment test (canvas border, padding bounds, center crosshair)...");

      if (window.fabricEditor && window.fabricEditor.showAlignmentGuides) {
        window.fabricEditor.showAlignmentGuides();
      }

      try {
        const bitmap = constructBitmap(printer.px, 1, isInfinitePaper, true);
        if (bitmap) {
          await printerInstance.print(device, bitmap, isSegmented);
        }
      } finally {
        // Always remove the guides again, even if printing failed, so the
        // user's actual design is left untouched on the canvas.
        if (window.fabricEditor && window.fabricEditor.hideAlignmentGuides) {
          window.fabricEditor.hideAlignmentGuides();
        }
      }

      log("Alignment test printed. Compare the printed lines to your physical label edges and adjust the padding values.");
    }
  } catch (err) {
    console.error("Alignment test print failed:", err);
    log("Alignment test print failed: " + err);
    if (window.fabricEditor && window.fabricEditor.hideAlignmentGuides) {
      window.fabricEditor.hideAlignmentGuides();
    }
  }
}

// Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes ("") and commas/newlines
// inside quotes. The header row (first row) supplies the field names used for merge matching.
function parseCSV(text) {
  const rawRows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += char;
        i++;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (char === '\r') {
      i++;
    } else if (char === '\n') {
      row.push(field);
      rawRows.push(row);
      row = [];
      field = '';
      i++;
    } else {
      field += char;
      i++;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rawRows.push(row);
  }

  // Drop blank trailing lines
  const rows = rawRows.filter(r => !(r.length === 1 && r[0].trim() === ''));
  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ''; });
    return obj;
  });

  return { headers, rows: dataRows };
}

// Prints one label per row, substituting the value of each merge-tagged canvas object
// (set via the "Merge field name" input in the object controls) with the matching CSV column.
// Restores every tagged object to its original value afterward, so the visible canvas design
// is left exactly as the user had it -- including on error/cancel.
async function printBatch(rows) {
  if (!window.fabricEditor || !window.fabricEditor.getMergeFieldObjects) return;

  const fields = window.fabricEditor.getMergeFieldObjects();
  if (fields.length === 0) {
    log("Batch print: no canvas objects have a merge field set. Tag a text or QR object first.");
    return;
  }
  if (!rows || rows.length === 0) {
    log("Batch print: no rows to print.");
    return;
  }

  const fabricCanvas = window.getFabricCanvas();
  const snapshots = fields.map(f => ({
    object: f.object,
    isQRCode: f.isQRCode,
    isImage: f.isImage,
    originalValue: f.isQRCode ? f.object.qrContent : (f.isImage ? f.object.originalImageDataURL : f.object.text)
  }));

  try {
    await connectPrinter();
    if (!printerInstance) return;

    const printer = supportedPrinters.find(p => p.pattern.test(device.name));
    const infinitePaperCheckbox = document.getElementById("infinitePaperCheckbox");
    const isSegmented = infinitePaperCheckbox ? !infinitePaperCheckbox.checked : true;
    const isInfinitePaper = infinitePaperCheckbox ? infinitePaperCheckbox.checked : false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      log(`Batch print: row ${i + 1} of ${rows.length}...`);

      await Promise.all(fields.map(f => {
        const value = row[f.mergeField];
        if (value === undefined) return Promise.resolve();
        if (f.isQRCode) {
          return new Promise(resolve => window.fabricEditor.setQRObjectContent(f.object, value, () => resolve()));
        }
        if (f.isImage) {
          return new Promise(resolve => window.fabricEditor.setImageObjectContent(f.object, value, (ok, err) => {
            if (!ok) {
              log(`Batch print: row ${i + 1}, failed to load image for field "${f.mergeField}" (${err ? err.message || err : 'unknown error'}). Check the URL is reachable and CORS-enabled; a data: URI is more reliable.`);
            }
            resolve();
          }));
        }
        f.object.set({ text: String(value) });
        return Promise.resolve();
      }));

      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();

      const bitmap = constructBitmap(printer.px, 1, isInfinitePaper, true);
      if (bitmap) {
        await printerInstance.print(device, bitmap, isSegmented);
      }

      if (i < rows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    log(`Batch print: finished printing ${rows.length} labels.`);
  } catch (err) {
    console.error("Batch print failed:", err);
    log("Batch print failed: " + err);
  } finally {
    // Always restore original values, even on error, so the visible design is untouched.
    for (const snap of snapshots) {
      if (snap.isQRCode) {
        await new Promise(resolve => window.fabricEditor.setQRObjectContent(snap.object, snap.originalValue, () => resolve()));
      } else if (snap.isImage) {
        if (snap.originalValue) {
          await new Promise(resolve => window.fabricEditor.setImageObjectContent(snap.object, snap.originalValue, () => resolve()));
        }
      } else {
        snap.object.set({ text: snap.originalValue });
      }
    }
    fabricCanvas.renderAll();
    log("Batch print: restored original canvas content.");
  }
}

async function reSyncPrinter() {
  try {
    await connectPrinter();

    if (printerInstance && printerInstance.feedToNextLabel) {
      await printerInstance.feedToNextLabel(device);
    } else if (printerInstance) {
      log("Re-sync is not supported by this printer's driver.");
    }
  } catch (err) {
    console.error("Re-sync failed:", err);
    log("Re-sync failed: " + err);
  }
}

async function disconnectPrinter() {
  if (printerInstance) {
    await printerInstance.disconnect();
    printerInstance = null;
    device = null;
  } else {
    log("No printer instance found to disconnect.");
  }
}

function splitIntoChunks(data, chunkSize = 96) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

function log(message) {
  const output = document.getElementById("logOutput");
  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-EN', { hour12: false });
  output.textContent += `[${timestamp}] ${message}\n`;
  output.scrollTop = output.scrollHeight;
  console.log(message)
}



function rasterizeCanvas(canvasHeight, isInfinitePaper, ignoreSelection = false) {
  const fabricCanvas = getFabricCanvas();
  if (!fabricCanvas) {
    log("Fabric.js canvas not initialized.");
    return null;
  }

  // Save current selection and deselect only if not ignoring selection
  const activeObject = fabricCanvas.getActiveObject();

  if (!ignoreSelection) {
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
    fabricCanvas.renderAll(); // Ensure render happens synchronously
  }

  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  const canvasWidth = fabricCanvas.width; // Use Fabric canvas width
  tempCanvas.width = canvasWidth;
  tempCanvas.height = canvasHeight;

  // Render the fabric canvas content onto the temporary canvas
  fabricCanvas.backgroundColor = '#ffffff'; // Ensure white background

  // Force a render of the lower canvas to ensure it's up to date
  fabricCanvas.renderAll();
  tempCtx.drawImage(fabricCanvas.getElement(), 0, 0, canvasWidth, canvasHeight);

  // Restore selection if we modified it
  if (!ignoreSelection && activeObject) {
    fabricCanvas.setActiveObject(activeObject);
    fabricCanvas.requestRenderAll();
  }

  const imgData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight);
  return imgData;
}

function constructBitmap(canvasHeight, copyCount, isInfinitePaper, ignoreSelection = false) {
  const imgDataObj = rasterizeCanvas(canvasHeight, isInfinitePaper, ignoreSelection);
  if (!imgDataObj) return null;

  const imgData = imgDataObj.data;
  const canvasWidth = imgDataObj.width;
  const height = imgDataObj.height;

  const bitmap = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < canvasWidth; x++) {
      const i = (y * canvasWidth + x) * 4;
      const avg = (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
      row += avg < 128 ? "1" : "0";
    }
    bitmap.push(row);
  }
  return bitmap;
}
