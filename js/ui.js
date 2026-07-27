function toggleAdvanced() {
  const section = document.getElementById("advancedSection");
  const toggleButton = document.querySelector("button[onclick='toggleAdvanced()']");

  const visible = section.style.display !== "none";
  section.style.display = visible ? "none" : "block";
  toggleButton.textContent = visible ? "Show Advanced" : "Hide Advanced";
}


function setVerticalAlign(alignment) {
  if (window.fabricEditor) {
    window.fabricEditor.setVerticalAlign(alignment);
  }
}

// Function to update the font family in fabric editor
function updateFontFamily(fontFamily) {
  if (window.fabricEditor) {
    window.fabricEditor.setFontFamily(fontFamily);
  }
}

// Function to update the font size in fabric editor
function updateFontSize(fontSize) {
  if (window.fabricEditor) {
    window.fabricEditor.setFontSize(fontSize);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".label-type-btn");
  const fontFamilyInput = document.getElementById("fontFamilyInput");
  const fontList = document.getElementById("fontList");
  const loadSystemFontsBtn = document.getElementById("loadSystemFontsBtn");
  const fontSizeInput = document.getElementById("fontSize");
  const noBluetoothModal = document.getElementById("noBluetoothModal");
  const bluetoothWarningBanner = document.getElementById("bluetoothWarningBanner");
  const BLUETOOTH_WARNING_DISMISSED_KEY = "blewebler.bluetoothWarningDismissed";

  // Check for Web Bluetooth support. If unsupported, always show the small persistent
  // banner (it's an ongoing condition, not a one-time event) but only auto-pop the full
  // modal the first time. Once dismissed, the banner stays as a click-to-reopen entry point.
  if (!navigator.bluetooth) {
    if (bluetoothWarningBanner) {
      bluetoothWarningBanner.style.display = "flex";
    }
    if (noBluetoothModal && localStorage.getItem(BLUETOOTH_WARNING_DISMISSED_KEY) !== "true") {
      noBluetoothModal.classList.add("show");
    }
  }

  if (bluetoothWarningBanner && noBluetoothModal) {
    bluetoothWarningBanner.addEventListener("click", () => {
      noBluetoothModal.classList.add("show");
    });
  }

  const dismissBluetoothModalBtn = document.getElementById("dismissBluetoothModalBtn");
  if (dismissBluetoothModalBtn && noBluetoothModal) {
    dismissBluetoothModalBtn.addEventListener("click", () => {
      noBluetoothModal.classList.remove("show");
      localStorage.setItem(BLUETOOTH_WARNING_DISMISSED_KEY, "true");
    });
  }

  // Basic web-safe fonts
  const basicFonts = ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Impact", "Tahoma", "Trebuchet MS"];

  // Event listeners for toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(button => {
    button.addEventListener('click', () => {
      const property = button.dataset.property;
      if (window.fabricEditor) {
        const isActive = window.fabricEditor.toggleStyle(property);
        button.classList.toggle('active', isActive);
      }
    });
  });

  function populateFontDropdown(fonts) {
    fontList.innerHTML = ""; // Clear existing options
    fonts.forEach(font => {
      const option = document.createElement("option");
      option.value = font;
      fontList.appendChild(option);
    });
    // Set initial value
    if (window.fabricEditor && window.fabricEditor.getActiveObject()) {
      fontFamilyInput.value = window.fabricEditor.getActiveObject().fontFamily;
    } else {
      fontFamilyInput.value = "Arial"; // Default
    }
  }

  // Populate with basic fonts on load
  populateFontDropdown(basicFonts);

  // Event listener for font family change
  fontFamilyInput.addEventListener("input", (event) => {
    updateFontFamily(event.target.value);
  });

  // Event listener for font size change
  if (fontSizeInput) {
    fontSizeInput.addEventListener("change", (event) => {
      updateFontSize(parseInt(event.target.value, 10));
    });
  }

  // Event listener for loading system fonts
  if (loadSystemFontsBtn) {
    // Hide button if API not supported
    if (!('queryLocalFonts' in window)) {
      loadSystemFontsBtn.style.display = 'none';
    }

    loadSystemFontsBtn.addEventListener("click", async () => {
      if ('queryLocalFonts' in window) {
        try {
          const systemFonts = await window.queryLocalFonts();
          const fontNames = systemFonts.map(font => font.family).filter((value, index, self) => self.indexOf(value) === index); // Get unique font names
          populateFontDropdown([...basicFonts, ...fontNames].filter((value, index, self) => self.indexOf(value) === index).sort()); // Merge, make unique, sort, and repopulate
          loadSystemFontsBtn.style.display = 'none'; // Hide button after successful load
        } catch (err) {
          console.error("Error querying local fonts:", err);
          alert("Failed to load system fonts. Please check console for details.");
        }
      } else {
        alert("Your browser does not support the Local Font Access API.");
        loadSystemFontsBtn.style.display = 'none';
      }
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;

      // Set active class
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Hide all option divs
      const textDiv = document.getElementById("textOptions");
      const infoDiv = document.getElementById("infoOptions");

      if (!textDiv || !infoDiv) {
        console.error("Option divs not found!");
        return;
      }

      textDiv.style.display = "none";
      infoDiv.style.display = "none";

      // Show selected option
      if (type === "text") textDiv.style.display = "block";
      else if (type === "info") {
        infoDiv.style.display = "block";
        handleInfoTab();
      }
    });
  });

  async function handleInfoTab() {
    const infoDisplay = document.getElementById("printerInfoDisplay");
    infoDisplay.textContent = "Connecting to printer...";

    try {
      // Ensure connectPrinter is available globally or imported
      if (typeof connectPrinter === 'function') {
        const printer = await connectPrinter();
        if (printer) {
          infoDisplay.textContent = "Retrieving information...";
          const info = await printer.getPrinterInfo();
          infoDisplay.innerHTML = info;
        } else {
          infoDisplay.textContent = "Could not connect to printer.";
        }
      } else {
        infoDisplay.textContent = "Error: connectPrinter function not found.";
      }
    } catch (err) {
      infoDisplay.textContent = "Error: " + err.message;
    }
  }

  const refreshInfoBtn = document.getElementById("refreshInfoBtn");
  if (refreshInfoBtn) {
    refreshInfoBtn.addEventListener("click", handleInfoTab);
  }

  // Set initial state
  const activeBtn = document.querySelector(".label-type-btn.active");
  if (activeBtn) activeBtn.click(); // Triggers display of text options

  // Add event listener for the print button
  const printButton = document.getElementById("printButton");
  if (printButton) {
    printButton.addEventListener("click", printLabel);
  }

  // Add event listener for the alignment test print button
  const alignmentTestBtn = document.getElementById("alignmentTestBtn");
  if (alignmentTestBtn) {
    alignmentTestBtn.addEventListener("click", printAlignmentTest);
  }

  // Add event listener for the printer re-sync button
  const reSyncBtn = document.getElementById("reSyncBtn");
  if (reSyncBtn) {
    reSyncBtn.addEventListener("click", reSyncPrinter);
  }

  // --- Batch Print (CSV mail-merge) Modal Logic ---
  const batchPrintBtn = document.getElementById("batchPrintBtn");
  const batchPrintModal = document.getElementById("batchPrintModal");
  const closeBatchPrintModal = document.getElementById("closeBatchPrintModal");
  const batchCsvFile = document.getElementById("batchCsvFile");
  const batchCsvText = document.getElementById("batchCsvText");
  const batchParseBtn = document.getElementById("batchParseBtn");
  const batchPreview = document.getElementById("batchPreview");
  const batchPreviewSummary = document.getElementById("batchPreviewSummary");
  const batchFieldWarnings = document.getElementById("batchFieldWarnings");
  const batchPrintConfirmBtn = document.getElementById("batchPrintConfirmBtn");

  let parsedBatchRows = null;

  if (batchPrintBtn && batchPrintModal) {
    batchPrintBtn.addEventListener("click", () => {
      batchPreview.style.display = "none";
      batchPrintConfirmBtn.style.display = "none";
      parsedBatchRows = null;
      batchPrintModal.classList.add("show");
    });
  }

  if (closeBatchPrintModal && batchPrintModal) {
    closeBatchPrintModal.addEventListener("click", () => {
      batchPrintModal.classList.remove("show");
    });
    batchPrintModal.addEventListener("click", (e) => {
      if (e.target === batchPrintModal) {
        batchPrintModal.classList.remove("show");
      }
    });
  }

  if (batchCsvFile && batchCsvText) {
    batchCsvFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        batchCsvText.value = event.target.result;
        // Parse immediately so uploading a file goes straight to the preview,
        // matching a real file as the primary bulk workflow: no length limits,
        // no CORS, nothing sitting in a URL or server log.
        parseBatchCsvAndPreview();
      };
      reader.readAsText(file);
    });
  }

  // Parses whatever's currently in the CSV textarea and renders the match preview.
  // Pulled out of the click handler so the URL-based hand-off (?csv=...) can trigger
  // the exact same preview automatically, without duplicating this logic.
  function parseBatchCsvAndPreview() {
    const csvText = batchCsvText.value.trim();
    if (!csvText) {
      alert("Paste CSV data or upload a CSV file first.");
      return;
    }

    const { headers, rows } = parseCSV(csvText);
    if (rows.length === 0) {
      alert("Couldn't find any data rows. Make sure the first line is a header row.");
      return;
    }

    const mergeFields = window.fabricEditor ? window.fabricEditor.getMergeFieldObjects() : [];
    const mergeFieldNames = [...new Set(mergeFields.map(f => f.mergeField))];
    const matched = mergeFieldNames.filter(name => headers.includes(name));
    const unmatchedFields = mergeFieldNames.filter(name => !headers.includes(name));
    const unusedColumns = headers.filter(h => !mergeFieldNames.includes(h));
    const imageFieldNames = [...new Set(mergeFields.filter(f => f.isImage).map(f => f.mergeField))];

    parsedBatchRows = rows;

    batchPreviewSummary.textContent = `Found ${rows.length} row(s) with columns: ${headers.join(", ")}.`;

    let warnings = "";
    if (mergeFieldNames.length === 0) {
      warnings += "<p>No canvas objects are tagged with a merge field name yet -- select a text, image, or QR object and set one in its controls.</p>";
    }
    if (matched.length > 0) {
      warnings += `<p>Matched fields: ${matched.join(", ")}</p>`;
    }
    if (unmatchedFields.length > 0) {
      warnings += `<p>Canvas merge fields with no matching CSV column (will be left unchanged): ${unmatchedFields.join(", ")}</p>`;
    }
    if (unusedColumns.length > 0) {
      warnings += `<p>CSV columns not used by any canvas object: ${unusedColumns.join(", ")}</p>`;
    }
    imageFieldNames.filter(name => headers.includes(name)).forEach(name => {
      const sample = rows[0] ? rows[0][name] : "";
      if (sample && !sample.startsWith("data:")) {
        warnings += `<p>Field "${name}" tags an image object and its values look like URLs, not data: URIs -- the image host must allow cross-origin requests (CORS) or printing that row will fail. A data: URI avoids this entirely.</p>`;
      }
    });
    batchFieldWarnings.innerHTML = warnings;

    batchPreview.style.display = "block";
    batchPrintConfirmBtn.style.display = matched.length > 0 ? "block" : "none";
    batchPrintConfirmBtn.textContent = `Print ${rows.length} Label${rows.length === 1 ? "" : "s"}`;
  }

  if (batchParseBtn) {
    batchParseBtn.addEventListener("click", parseBatchCsvAndPreview);
  }

  // Bulk data hand-off for external integrations: ?csv=<url-encoded CSV> opens the
  // Batch Print modal with the data already parsed and previewed, so linking in from
  // another program goes straight to "review and print all" instead of a manual
  // copy-paste/upload step. Mirrors the single-item ?text=/?qr= hand-off, for bulk.
  const urlCsvParams = new URLSearchParams(window.location.search);
  const urlCsv = urlCsvParams.get('csv');
  if (urlCsv && batchCsvText && batchPrintModal) {
    batchCsvText.value = urlCsv;
    batchPreview.style.display = "none";
    batchPrintConfirmBtn.style.display = "none";
    batchPrintModal.classList.add("show");
    parseBatchCsvAndPreview();
  }

  if (batchPrintConfirmBtn) {
    batchPrintConfirmBtn.addEventListener("click", async () => {
      if (!parsedBatchRows || parsedBatchRows.length === 0) return;
      batchPrintModal.classList.remove("show");
      await printBatch(parsedBatchRows);
    });
  }

  // --- Saved Labels (localStorage + file export/import) ---
  const SAVED_LABELS_KEY = "blewebler.savedLabels";

  function getSavedLabels() {
    try {
      const raw = localStorage.getItem(SAVED_LABELS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("Failed to read saved labels:", err);
      return [];
    }
  }

  function setSavedLabels(list) {
    try {
      localStorage.setItem(SAVED_LABELS_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      console.error("Failed to save labels:", err);
      alert("Couldn't save. Your browser's local storage is full or unavailable. Try exporting this label to a file instead, and consider deleting some saved labels.");
      return false;
    }
  }

  function downloadLabelFile(entry) {
    const { id, ...exportable } = entry;
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (entry.name || "label").replace(/[^a-z0-9_\- ]/gi, "").trim() || "label";
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const savedLabelsBtn = document.getElementById("savedLabelsBtn");
  const savedLabelsModal = document.getElementById("savedLabelsModal");
  const closeSavedLabelsModal = document.getElementById("closeSavedLabelsModal");
  const saveLabelNameInput = document.getElementById("saveLabelNameInput");
  const saveLabelBtn = document.getElementById("saveLabelBtn");
  const importLabelFile = document.getElementById("importLabelFile");
  const savedLabelsList = document.getElementById("savedLabelsList");
  const savedLabelsEmpty = document.getElementById("savedLabelsEmpty");

  function renderSavedLabelsList() {
    if (!savedLabelsList) return;
    const labels = getSavedLabels();
    savedLabelsList.innerHTML = "";

    if (savedLabelsEmpty) savedLabelsEmpty.style.display = labels.length === 0 ? "block" : "none";

    labels.slice().reverse().forEach(entry => {
      const item = document.createElement("div");
      item.className = "shortcut-item";

      const info = document.createElement("div");
      info.className = "shortcut-description";
      const savedDate = entry.savedAt ? new Date(entry.savedAt).toLocaleString() : "";
      info.innerHTML = `<strong>${entry.name || "Untitled label"}</strong><br><span style="color: var(--text-muted); font-size: 0.8rem;">${entry.canvasWidth || "?"}×${entry.canvasHeight || "?"}px${savedDate ? " · " + savedDate : ""}</span>`;

      const actions = document.createElement("div");
      actions.className = "shortcut-keys";

      const loadBtn = document.createElement("button");
      loadBtn.className = "btn btn-secondary btn-sm";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", () => {
        if (!window.fabricEditor) return;
        window.fabricEditor.importLabelData(entry, (ok) => {
          if (ok) {
            savedLabelsModal.classList.remove("show");
          } else {
            alert("Couldn't load this label. It may be corrupted.");
          }
        });
      });

      const exportBtn = document.createElement("button");
      exportBtn.className = "btn btn-secondary btn-sm";
      exportBtn.textContent = "Export";
      exportBtn.addEventListener("click", () => downloadLabelFile(entry));

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-danger btn-sm";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        if (!confirm(`Delete "${entry.name || "Untitled label"}"? This can't be undone.`)) return;
        const updated = getSavedLabels().filter(l => l.id !== entry.id);
        setSavedLabels(updated);
        renderSavedLabelsList();
      });

      actions.appendChild(loadBtn);
      actions.appendChild(exportBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(info);
      item.appendChild(actions);
      savedLabelsList.appendChild(item);
    });
  }

  if (savedLabelsBtn && savedLabelsModal) {
    savedLabelsBtn.addEventListener("click", () => {
      renderSavedLabelsList();
      savedLabelsModal.classList.add("show");
    });
  }

  if (closeSavedLabelsModal && savedLabelsModal) {
    closeSavedLabelsModal.addEventListener("click", () => {
      savedLabelsModal.classList.remove("show");
    });
    savedLabelsModal.addEventListener("click", (e) => {
      if (e.target === savedLabelsModal) {
        savedLabelsModal.classList.remove("show");
      }
    });
  }

  if (saveLabelBtn) {
    saveLabelBtn.addEventListener("click", () => {
      if (!window.fabricEditor) return;
      const name = (saveLabelNameInput.value || "").trim() || `Label ${new Date().toLocaleDateString()}`;
      const data = window.fabricEditor.exportLabelData();
      const entry = Object.assign({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, savedAt: new Date().toISOString() }, data);
      const labels = getSavedLabels();
      labels.push(entry);
      if (setSavedLabels(labels)) {
        saveLabelNameInput.value = "";
        renderSavedLabelsList();
      }
    });
  }

  if (importLabelFile) {
    importLabelFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        let data;
        try {
          data = JSON.parse(event.target.result);
        } catch (err) {
          alert("That file isn't valid JSON.");
          return;
        }
        if (!data || !data.fabricJSON) {
          alert("That file doesn't look like a BleWebler label export.");
          return;
        }

        const entry = Object.assign(
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          data,
          { name: data.name || file.name.replace(/\.json$/i, ""), savedAt: data.savedAt || new Date().toISOString() }
        );
        const labels = getSavedLabels();
        labels.push(entry);
        setSavedLabels(labels);
        renderSavedLabelsList();

        window.fabricEditor.importLabelData(entry, (ok) => {
          if (ok) savedLabelsModal.classList.remove("show");
        });
      };
      reader.readAsText(file);
      importLabelFile.value = "";
    });
  }

  // Live Preview Logic (Standard Behavior)
  let previewCanvasElement = null;

  function initLivePreview() {
    // 1. Initial Render
    updatePreview();

    // 2. Add Listeners for Live Update
    const fabricCanvas = window.getFabricCanvas();
    if (fabricCanvas) {
      fabricCanvas.on('object:modified', updatePreview);
      fabricCanvas.on('object:added', updatePreview);
      fabricCanvas.on('object:removed', updatePreview);
      fabricCanvas.on('selection:updated', updatePreview);
      fabricCanvas.on('selection:created', updatePreview);
      fabricCanvas.on('selection:cleared', updatePreview);
      fabricCanvas.on('canvas:resized', updatePreview);

      // Debounce text changes
      let timeout;
      fabricCanvas.on('text:changed', () => {
        clearTimeout(timeout);
        timeout = setTimeout(updatePreview, 100);
      });
    }
  }

  // Initialize preview when scripts are ready
  // A simple timeout or event hook might be needed if fabric canvas isn't ready immediately.
  // Assuming fabric_editor.js runs before or initLivePreview can safely bind active listeners.
  // Since we use window.getFabricCanvas(), we can try running it.
  // Better yet, wait a moment or check if fabricCanvas is available.
  if (window.getFabricCanvas()) {
    initLivePreview();
  } else {
    // Wait for DOMContentLoaded or similar if needed, or just try to hook
    window.addEventListener('load', initLivePreview);
  }

  function updatePreview() {
    const fabricCanvas = window.getFabricCanvas();
    if (!fabricCanvas) return;

    // Auto-hide preview if an object is selected
    if (fabricCanvas.getActiveObject()) {
      if (previewCanvasElement) {
        previewCanvasElement.style.display = 'none';
      }
      return;
    }

    // 1. Generate Bitmap
    const printerSelect = document.getElementById("printerSelect");
    const supportedPrinters = window.supportedPrinters;

    // Handle case where vars might not be ready yet
    if (!printerSelect || !supportedPrinters) return;

    // Safety check for printer selection
    const printerIndex = printerSelect.value;
    if (!supportedPrinters[printerIndex]) return;

    const printerPx = supportedPrinters[printerIndex].px;

    let heightToUse = printerPx;
    if (window.fabricEditor) {
      heightToUse = printerPx;
    }

    const infinitePaperCheckbox = document.getElementById("infinitePaperCheckbox");
    const isInfinitePaper = infinitePaperCheckbox ? infinitePaperCheckbox.checked : false;

    // Use constructBitmap ensuring 1 copy
    const bitmap = constructBitmap(heightToUse, 1, isInfinitePaper, true);

    if (!bitmap || bitmap.length === 0) return;

    const bitmapHeight = bitmap.length;
    const bitmapWidth = bitmap[0].length;

    // 2. Create/Update Preview Canvas
    if (!previewCanvasElement) {
      previewCanvasElement = document.createElement("canvas");
      // Style for overlay
      previewCanvasElement.style.position = "absolute";
      previewCanvasElement.style.top = "0";
      previewCanvasElement.style.left = "0";

      // Crucial: Pointer events NONE allows clicks to pass through to the upper-canvas (selection handles)
      previewCanvasElement.style.pointerEvents = "none";

      previewCanvasElement.style.backgroundColor = "white";
      previewCanvasElement.style.imageRendering = "pixelated";
      previewCanvasElement.className = "preview-canvas";

      // We need to insert this BEFORE the upper-canvas but AFTER the lower-canvas
      const fabricCanvas = window.getFabricCanvas();
      if (fabricCanvas) {
        const upperCanvas = fabricCanvas.upperCanvasEl;
        const container = upperCanvas.parentNode;
        // Insert before upper canvas
        container.insertBefore(previewCanvasElement, upperCanvas);
      }
    }

    // 3. Draw Binary Data to Preview Canvas
    previewCanvasElement.width = bitmapWidth;
    previewCanvasElement.height = bitmapHeight;
    const ctx = previewCanvasElement.getContext("2d");

    const previewData = ctx.createImageData(bitmapWidth, bitmapHeight);
    const pData = previewData.data;

    for (let y = 0; y < bitmapHeight; y++) {
      const rowString = bitmap[y];
      for (let x = 0; x < bitmapWidth; x++) {
        const char = rowString[x];
        const pixelColor = (char === '1') ? 0 : 255;

        const index = (y * bitmapWidth + x) * 4;
        pData[index] = pixelColor;     // R
        pData[index + 1] = pixelColor; // G
        pData[index + 2] = pixelColor; // B
        pData[index + 3] = 255;        // Alpha
      }
    }

    ctx.putImageData(previewData, 0, 0);
    previewCanvasElement.style.display = "block";
  }

  // --- Printer Selection Modal Logic ---
  const startupModal = document.getElementById("startupModal");
  const printerSelect = document.getElementById("printerSelect");
  const startBtn = document.getElementById("startBtn");
  const paperWidthInput = document.getElementById("paperWidth");
  const paperWidthContainer = document.getElementById("paperWidthContainer");
  const paperHeightInput = document.getElementById("paperHeight");
  const settingsBtn = document.getElementById("settingsBtn");
  const infinitePaperCheckbox = document.getElementById("infinitePaperCheckbox");

  const resizeHandle = document.getElementById("resizeHandle");
  const canvasWrapper = document.getElementById("canvasWrapper");
  const homeTitle = document.getElementById("homeTitle");

  // Resize Handle Logic
  let isDragging = false;
  let startX;
  let startWidth;
  let currentPrinterDpm = 8; // Default dpm, will be updated when printer is selected
  const dimensionControls = document.getElementById("dimensionControls");
  const widthInput = document.getElementById("widthInput");
  const heightInput = document.getElementById("heightInput");

  // Function to get current printer dpm
  const getCurrentPrinterDpm = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPrinter = urlParams.get('printer');
    if (urlPrinter !== null && typeof supportedPrinters !== 'undefined') {
      const pIndex = parseInt(urlPrinter);
      if (!isNaN(pIndex) && supportedPrinters[pIndex]) {
        return supportedPrinters[pIndex].dpm;
      }
    }
    return currentPrinterDpm; // Fallback to stored value
  };

  // Function to update dimension inputs from canvas
  const updateDimensionInputs = () => {
    const canvas = window.getFabricCanvas();
    if (canvas && widthInput && heightInput) {
      currentPrinterDpm = getCurrentPrinterDpm();
      const widthMm = canvas.getWidth() / currentPrinterDpm;
      const heightMm = canvas.getHeight() / currentPrinterDpm;
      widthInput.value = widthMm.toFixed(1);
      heightInput.value = heightMm.toFixed(1);
    }
  };

  // Function to update canvas from dimension inputs
  const updateCanvasFromInputs = () => {
    const canvas = window.getFabricCanvas();
    if (canvas && widthInput && heightInput) {
      currentPrinterDpm = getCurrentPrinterDpm();
      const widthMm = parseFloat(widthInput.value);
      const heightMm = parseFloat(heightInput.value);

      if (!isNaN(widthMm) && widthMm > 0 && !isNaN(heightMm) && heightMm > 0) {
        const widthPx = Math.round(widthMm * currentPrinterDpm);
        const heightPx = Math.round(heightMm * currentPrinterDpm);
        if (window.fabricEditor) {
          window.fabricEditor.updateCanvasSize(widthPx, heightPx);
        }
      }
    }
  };

  if (resizeHandle) {
    const startDrag = (clientX) => {
      isDragging = true;
      startX = clientX;
      resizeHandle.classList.add('active');
      // Update dpm from current printer
      currentPrinterDpm = getCurrentPrinterDpm();
      if (window.fabricEditor && window.fabricEditor.getActiveObject) {
        // Get current canvas width
        const canvas = window.getFabricCanvas();
        if (canvas) {
          startWidth = canvas.getWidth();
        }
      }
    };

    const onDrag = (clientX) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      const newWidth = startWidth + dx;

      if (newWidth > 50) { // Minimum width
        if (window.fabricEditor) {
          // We only want to update width, keep height same.
          const canvas = window.getFabricCanvas();
          if (canvas) {
            window.fabricEditor.updateCanvasSize(newWidth, canvas.getHeight());
            // Update width input
            updateDimensionInputs();
          }
        }
      }
    };

    const endDrag = () => {
      isDragging = false;
      resizeHandle.classList.remove('active');
    };

    // Mouse events
    resizeHandle.addEventListener('mousedown', (e) => {
      startDrag(e.clientX);
      e.preventDefault(); // Prevent text selection
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        onDrag(e.clientX);
      }
    });

    window.addEventListener('mouseup', endDrag);

    // Touch events
    resizeHandle.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        startDrag(e.touches[0].clientX);
        e.preventDefault(); // Prevent scrolling
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length > 0) {
        onDrag(e.touches[0].clientX);
      }
    });

    window.addEventListener('touchend', endDrag);
  }

  // Flag to prevent update loops
  let isUpdatingFromInputs = false;

  // Dimension input handlers
  if (widthInput) {
    widthInput.addEventListener('change', () => {
      isUpdatingFromInputs = true;
      updateCanvasFromInputs();
      isUpdatingFromInputs = false;
    });
    widthInput.addEventListener('blur', () => {
      isUpdatingFromInputs = true;
      updateCanvasFromInputs();
      isUpdatingFromInputs = false;
    });
  }

  if (heightInput) {
    heightInput.addEventListener('change', () => {
      isUpdatingFromInputs = true;
      updateCanvasFromInputs();
      isUpdatingFromInputs = false;
    });
    heightInput.addEventListener('blur', () => {
      isUpdatingFromInputs = true;
      updateCanvasFromInputs();
      isUpdatingFromInputs = false;
    });
  }

  // Update dimension inputs when canvas size changes (but not when updating from inputs)
  if (window.fabricEditor) {
    const originalUpdateCanvasSize = window.fabricEditor.updateCanvasSize;
    if (originalUpdateCanvasSize) {
      window.fabricEditor.updateCanvasSize = function (width, height) {
        originalUpdateCanvasSize.call(this, width, height);
        if (!isUpdatingFromInputs) {
          updateDimensionInputs();
        }
      };
    }
  }

  if (startupModal && printerSelect && startBtn) {
    // 1. Populate Printer List
    if (typeof supportedPrinters !== 'undefined') {
      supportedPrinters.forEach((printer, index) => {
        const option = document.createElement("option");
        option.value = index; // Use index to easily retrieve printer object later
        option.textContent = printer.name;
        printerSelect.appendChild(option);
      });
    }

    // Function to apply settings
    const applyPrinterSettings = (printerIndex, widthMm, heightMm, isInfinite, paddingTopMm = 0, paddingBottomMm = 0, paddingLeftMm = 0, paddingRightMm = 0) => {
      if (typeof supportedPrinters !== 'undefined' && supportedPrinters[printerIndex]) {
        const printer = supportedPrinters[printerIndex];
        const dpm = printer.dpm;
        // Store dpm for resize handle
        currentPrinterDpm = dpm;

        // Calculate pixels
        let widthPx;
        if (isInfinite) {
          widthPx = Math.round((widthMm || 100) * dpm);
          if (resizeHandle) resizeHandle.classList.remove('hidden');
          if (dimensionControls) dimensionControls.classList.remove('hidden');
        } else {
          widthPx = Math.round(widthMm * dpm);
          if (resizeHandle) resizeHandle.classList.add('hidden');
          if (dimensionControls) dimensionControls.classList.add('hidden');
        }

        // Cap height at printer's max printable height
        let heightPx = Math.round(heightMm * dpm);
        if (heightPx > printer.px) {
          heightPx = printer.px;
        }

        // Update Canvas
        if (window.fabricEditor && window.fabricEditor.updateCanvasSize) {
          window.fabricEditor.updateCanvasSize(widthPx, heightPx);
          // Update dimension inputs after canvas is updated
          setTimeout(updateDimensionInputs, 0);
        }

        // Apply padding (convert mm to pixels)
        if (window.fabricEditor && window.fabricEditor.setPadding) {
          const paddingTopPx = Math.round(paddingTopMm * dpm);
          const paddingBottomPx = Math.round(paddingBottomMm * dpm);
          const paddingLeftPx = Math.round(paddingLeftMm * dpm);
          const paddingRightPx = Math.round(paddingRightMm * dpm);
          window.fabricEditor.setPadding(paddingTopPx, paddingBottomPx, paddingLeftPx, paddingRightPx);
        }

        // Hide Modal
        startupModal.classList.remove("show");
      }
    };

    // Get padding inputs
    const paddingTopInput = document.getElementById('paddingTop');
    const paddingBottomInput = document.getElementById('paddingBottom');
    const paddingLeftInput = document.getElementById('paddingLeft');
    const paddingRightInput = document.getElementById('paddingRight');

    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlPrinter = urlParams.get('printer');
    const urlWidth = urlParams.get('width');
    const urlHeight = urlParams.get('height');
    const urlInfinite = urlParams.get('infinite') === 'true';
    const urlPaddingTop = urlParams.get('paddingTop');
    const urlPaddingBottom = urlParams.get('paddingBottom');
    const urlPaddingLeft = urlParams.get('paddingLeft');
    const urlPaddingRight = urlParams.get('paddingRight');
    // Label content hand-off for external integrations (e.g. another app linking in
    // a ready-to-print label): ?text=...&qr=... fills the first matching text/QR
    // object already on the canvas, or creates one if none exists yet.
    const urlText = urlParams.get('text');
    const urlQr = urlParams.get('qr');

    // Infinite Paper Checkbox Logic
    if (infinitePaperCheckbox && paperWidthInput && paperWidthContainer) {
      infinitePaperCheckbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          paperWidthInput.removeAttribute("max");
          paperWidthContainer.style.display = 'none'; // Hide width input
          if (resizeHandle) resizeHandle.classList.remove('hidden');
          if (dimensionControls) dimensionControls.classList.remove('hidden');
          // Update dimension inputs when enabling infinite paper
          updateDimensionInputs();
        } else {
          paperWidthInput.setAttribute("max", "100"); // Restore default max
          if (parseFloat(paperWidthInput.value) > 100) {
            paperWidthInput.value = 100; // Cap value if it exceeds max
          }
          paperWidthContainer.style.display = 'block'; // Show width input
          if (resizeHandle) resizeHandle.classList.add('hidden');
          if (dimensionControls) dimensionControls.classList.add('hidden');
        }
      });
    }

    if (urlPrinter !== null && urlWidth !== null && urlHeight !== null) {
      // Apply settings from URL
      const pIndex = parseInt(urlPrinter);
      const w = parseFloat(urlWidth);
      const h = parseFloat(urlHeight);

      if (!isNaN(pIndex) && !isNaN(w) && !isNaN(h)) {
        // Update inputs to match URL (so if they open settings later, it's correct)
        printerSelect.value = pIndex;
        paperWidthInput.value = w;
        paperHeightInput.value = h;
        if (infinitePaperCheckbox) {
          infinitePaperCheckbox.checked = urlInfinite;
          // Trigger change event to update UI state (hide/show width input)
          infinitePaperCheckbox.dispatchEvent(new Event('change'));
        }

        // Update padding inputs from URL
        const pTop = urlPaddingTop !== null ? parseFloat(urlPaddingTop) : 0;
        const pBottom = urlPaddingBottom !== null ? parseFloat(urlPaddingBottom) : 0;
        const pLeft = urlPaddingLeft !== null ? parseFloat(urlPaddingLeft) : 0;
        const pRight = urlPaddingRight !== null ? parseFloat(urlPaddingRight) : 0;

        if (paddingTopInput) paddingTopInput.value = pTop;
        if (paddingBottomInput) paddingBottomInput.value = pBottom;
        if (paddingLeftInput) paddingLeftInput.value = pLeft;
        if (paddingRightInput) paddingRightInput.value = pRight;

        applyPrinterSettings(pIndex, w, h, urlInfinite, pTop, pBottom, pLeft, pRight);

        if ((urlText !== null || urlQr !== null) && window.fabricEditor && window.fabricEditor.applyURLLabelContent) {
          window.fabricEditor.applyURLLabelContent({ text: urlText, qr: urlQr });
        }
      } else {
        // Invalid params, show modal
        startupModal.classList.add("show");
      }
    } else {
      // No URL params, show modal
      startupModal.classList.add("show");
    }

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        startupModal.classList.add("show");
      });
    }

    // Close settings modal
    const closeSettingsModal = document.getElementById("closeSettingsModal");
    if (closeSettingsModal && startupModal) {
      closeSettingsModal.addEventListener("click", () => {
        startupModal.classList.remove("show");
      });

      // Close modal when clicking outside
      startupModal.addEventListener("click", (e) => {
        if (e.target === startupModal) {
          startupModal.classList.remove("show");
        }
      });
    }

    // Home title click handler - go back to home (clear URL params)
    if (homeTitle) {
      homeTitle.addEventListener("click", () => {
        window.location.href = window.location.pathname;
      });
    }

    // Function to update padding from inputs
    const updatePaddingFromInputs = () => {
      if (!window.fabricEditor || !window.fabricEditor.setPadding) return;

      const dpm = getCurrentPrinterDpm();
      const paddingTopMm = paddingTopInput ? parseFloat(paddingTopInput.value) || 0 : 0;
      const paddingBottomMm = paddingBottomInput ? parseFloat(paddingBottomInput.value) || 0 : 0;
      const paddingLeftMm = paddingLeftInput ? parseFloat(paddingLeftInput.value) || 0 : 0;
      const paddingRightMm = paddingRightInput ? parseFloat(paddingRightInput.value) || 0 : 0;

      // Convert mm to pixels
      const paddingTopPx = Math.round(paddingTopMm * dpm);
      const paddingBottomPx = Math.round(paddingBottomMm * dpm);
      const paddingLeftPx = Math.round(paddingLeftMm * dpm);
      const paddingRightPx = Math.round(paddingRightMm * dpm);

      window.fabricEditor.setPadding(paddingTopPx, paddingBottomPx, paddingLeftPx, paddingRightPx);

      // Update URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('paddingTop', paddingTopMm);
      newUrl.searchParams.set('paddingBottom', paddingBottomMm);
      newUrl.searchParams.set('paddingLeft', paddingLeftMm);
      newUrl.searchParams.set('paddingRight', paddingRightMm);
      window.history.replaceState({}, '', newUrl);
    };

    // Add event listeners to padding inputs for real-time updates
    if (paddingTopInput) {
      paddingTopInput.addEventListener('change', updatePaddingFromInputs);
      paddingTopInput.addEventListener('blur', updatePaddingFromInputs);
    }
    if (paddingBottomInput) {
      paddingBottomInput.addEventListener('change', updatePaddingFromInputs);
      paddingBottomInput.addEventListener('blur', updatePaddingFromInputs);
    }
    if (paddingLeftInput) {
      paddingLeftInput.addEventListener('change', updatePaddingFromInputs);
      paddingLeftInput.addEventListener('blur', updatePaddingFromInputs);
    }
    if (paddingRightInput) {
      paddingRightInput.addEventListener('change', updatePaddingFromInputs);
      paddingRightInput.addEventListener('blur', updatePaddingFromInputs);
    }

    // 3. Handle Start Button Click
    startBtn.addEventListener("click", () => {
      const selectedPrinterIndex = printerSelect.value;
      const widthMm = parseFloat(paperWidthInput.value);
      const heightMm = parseFloat(paperHeightInput.value);
      const isInfinite = infinitePaperCheckbox ? infinitePaperCheckbox.checked : false;
      const paddingTopMm = paddingTopInput ? parseFloat(paddingTopInput.value) || 0 : 0;
      const paddingBottomMm = paddingBottomInput ? parseFloat(paddingBottomInput.value) || 0 : 0;
      const paddingLeftMm = paddingLeftInput ? parseFloat(paddingLeftInput.value) || 0 : 0;
      const paddingRightMm = paddingRightInput ? parseFloat(paddingRightInput.value) || 0 : 0;

      applyPrinterSettings(selectedPrinterIndex, widthMm, heightMm, isInfinite,
        paddingTopMm, paddingBottomMm, paddingLeftMm, paddingRightMm);

      // Update URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('printer', selectedPrinterIndex);
      newUrl.searchParams.set('width', widthMm);
      newUrl.searchParams.set('height', heightMm);
      newUrl.searchParams.set('infinite', isInfinite);
      newUrl.searchParams.set('paddingTop', paddingTopMm);
      newUrl.searchParams.set('paddingBottom', paddingBottomMm);
      newUrl.searchParams.set('paddingLeft', paddingLeftMm);
      newUrl.searchParams.set('paddingRight', paddingRightMm);
      window.history.replaceState({}, '', newUrl);
    });
  }
});

function setTextAlign(alignment) {
  if (window.fabricEditor) {
    window.fabricEditor.setTextAlign(alignment);
  }
}

function setVerticalAlign(alignment) {
  if (window.fabricEditor) {
    window.fabricEditor.setVerticalAlign(alignment);
  }
}
