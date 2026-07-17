class MarklifeP12Printer extends PrinterBase {
  constructor() {
    super();
    this.serviceUUID = "0000ff00-0000-1000-8000-00805f9b34fb";
    this.charUUID = "0000ff02-0000-1000-8000-00805f9b34fb";
  }

  // Feed sequence used to advance segmented (gap-fed) label stock to the next label boundary.
  // Sent after every print on segmented paper. Also exposed standalone as feedToNextLabel()
  // so it can be triggered manually to re-sync the printer's gap position (e.g. after a tear),
  // since the printer has no way to know where a label starts until it's fed past a gap once.
  _segmentedFeedPackets() {
    return [
      Uint8Array.from([0x1d, 0x0c, 0x10]),
      Uint8Array.from([0xff, 0xf1, 0x45]),
      Uint8Array.from([0x10, 0xff, 0x40]),
      Uint8Array.from([0x10, 0xff, 0x40]),
    ];
  }

  async print(device, bitmap, segmentedPaper = false) {
    const canvasWidth = bitmap[0].length;
    const payload = this.bitmapToPacket(bitmap, canvasWidth);

    try {
      log(`Print: connecting to ${device.name}...`);
      const characteristic = await this.connect(device);
      log("Print: connected. Preparing packets " + (segmentedPaper ? "(segmented/gap-fed paper)" : "(infinite/continuous paper)") + "...");

      var packets = [
        Uint8Array.from([0x10, 0xff, 0x40]), // initialization packet
        Uint8Array.from([
          ...new Array(15).fill(0x00),
          0x10, 0xff, 0xf1, 0x02, 0x1d,
          0x76,
          0x30, 0x00,
          0x0c, 0x00,
          canvasWidth & 0xff, (canvasWidth >> 8) & 0xff
        ]),
        payload,
      ];

      if (segmentedPaper) {
        packets.push(...this._segmentedFeedPackets());
      } else {
        packets.push(
          Uint8Array.from([0x1b, 0x4a, 0x5B]), // purge
          Uint8Array.from([0x10, 0xff, 0xf1, 0x45]) // end
        )
      }

      log(`Print: sending init + bitmap (${bitmap.length}x${canvasWidth}px) + ${segmentedPaper ? "segmented feed" : "purge"} packets...`);
      await this.sendPackets(characteristic, packets);

      log("Print successful!");
    } catch (err) {
      log("Print error: " + err);
      console.error("Print error:", err);
    }
  }

  // Manually re-send the segmented feed sequence without printing anything first.
  // Intended as a "re-sync" action: press after a tear or after reconnecting, on gap-fed
  // (segmented) label stock, so the printer locates the next label boundary before you print.
  // NOTE: this reuses the exact byte sequence already proven in print()'s segmented-paper
  // path -- it does not send any new/unverified protocol bytes. Whether this alone is
  // sufficient to fix first-label misalignment on real hardware is unconfirmed; the logging
  // here is meant to help diagnose that on an actual printer.
  async feedToNextLabel(device) {
    try {
      log(`Re-sync: connecting to ${device.name}...`);
      const characteristic = await this.connect(device);
      log("Re-sync: connected. Sending feed-to-next-label sequence (4 packets)...");
      await this.sendPackets(characteristic, this._segmentedFeedPackets());
      log("Re-sync: feed sequence sent. Check the physical label position before printing.");
    } catch (err) {
      log("Re-sync failed: " + err);
      console.error("Re-sync failed:", err);
    }
  }

  bitmapToPacket(bitmap, width) {
    const height = bitmap.length;
    const bytes = [];

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y += 8) {
        const invertedY = height - 8 - y;
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const row = bitmap[invertedY + bit];
          if (row && row[x] === "1") {
            byte |= (1 << bit);
          }
        }
        bytes.push(byte);
      }
    }

    return new Uint8Array(bytes);
  }

  async getPrinterInfo() {
    if (!this.device || !this.device.gatt.connected) {
      return "Printer not connected";
    }

    const INFO_SERVICE = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
    const WRITE_CHAR = "49535343-8841-43f4-a8d4-ecbe34729bb3";
    const NOTIFY_CHAR = "49535343-1e4d-4bd9-ba61-23c647249616";

    let responses = [];

    try {
      const service = await this.device.gatt.getPrimaryService(INFO_SERVICE);
      const writeChar = await service.getCharacteristic(WRITE_CHAR);
      const notifyChar = await service.getCharacteristic(NOTIFY_CHAR);

      await notifyChar.startNotifications();

      const handleNotification = (event) => {
        const value = event.target.value;
        // Store raw value for later processing
        responses.push(new Uint8Array(value.buffer));
      };

      notifyChar.addEventListener('characteristicvaluechanged', handleNotification);

      const packets = [
        [0x10, 0xff, 0x50, 0xf1], // Battery in %
        [0x10, 0xff, 0x20, 0xef], // HW Version
        [0x10, 0xff, 0x20, 0xf0], // Name (P12)
        [0x10, 0xff, 0x20, 0xf1], // FW Version
        [0x10, 0xff, 0x20, 0xf2], // Serial Number
      ];

      for (const packet of packets) {
        await writeChar.writeValue(new Uint8Array(packet));
        await new Promise(r => setTimeout(r, 20)); // Wait 20ms between packets
      }

      await notifyChar.stopNotifications();
      notifyChar.removeEventListener('characteristicvaluechanged', handleNotification);

      // 1. Setup Parsers
      const decoder = new TextDecoder('utf-8');

      // Helper: Decodes text and removes null bytes/whitespace
      const parseText = (buf) => buf ? decoder.decode(buf).trim() : 'N/A';

      // Helper: specific BCD logic for Battery
      const parseBattery = (buf) => {
        if (!buf || buf.length < 2) return 'Unknown';
        const val = buf[1];
        return `${val} %`;
      };

      // 2. Define the Schema (The "What")
      const fields = [
        { label: "Battery", idx: 0, parser: parseBattery },
        { label: "Hardware Version", idx: 1, parser: parseText },
        { label: "Name", idx: 2, parser: parseText },
        { label: "Firmware", idx: 3, parser: parseText },
        { label: "Serial Number", idx: 4, parser: parseText },
      ];

      // 3. Generate Output (The "How")
      // Calculate padding based on the longest label in the list
      const padLen = Math.max(...fields.map(f => f.label.length));

      const lines = fields
        .filter(f => responses[f.idx]) // Only process if response exists (optional)
        .map(f => {
          const value = f.parser(responses[f.idx]);
          return `${f.label.padEnd(padLen)} : ${value}`;
        });

      return "General Printer Info: " + "\n" + await super.getPrinterInfo() + "\n\n" + "Info pulled directly from your printer: " + "\n" + lines.join('\n');

    } catch (error) {
      console.error("Error getting printer info:", error);
      log("Error getting printer info: " + error);
      return "Error: " + error.message;
    }
  }
}