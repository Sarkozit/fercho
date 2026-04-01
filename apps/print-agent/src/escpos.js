/**
 * ESC/POS command builder for Epson TM-T20II thermal printers.
 * 
 * Generates raw byte buffers that the printer understands directly.
 * Reference: Epson ESC/POS Application Programming Guide
 * 
 * Uses Code Page 858 (Multilingual Latin I + Euro) for Spanish accents.
 */

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// Code Page 858 mapping for characters > 127
// Maps Unicode code points to CP858 byte values
const CP858_MAP = {
  0x00C7: 0x80, // Ç
  0x00FC: 0x81, // ü
  0x00E9: 0x82, // é
  0x00E2: 0x83, // â
  0x00E4: 0x84, // ä
  0x00E0: 0x85, // à
  0x00E5: 0x86, // å
  0x00E7: 0x87, // ç
  0x00EA: 0x88, // ê
  0x00EB: 0x89, // ë
  0x00E8: 0x8A, // è
  0x00EF: 0x8B, // ï
  0x00EE: 0x8C, // î
  0x00EC: 0x8D, // ì
  0x00C4: 0x8E, // Ä
  0x00C5: 0x8F, // Å
  0x00C9: 0x90, // É
  0x00E6: 0x91, // æ
  0x00C6: 0x92, // Æ
  0x00F4: 0x93, // ô
  0x00F6: 0x94, // ö
  0x00F2: 0x95, // ò
  0x00FB: 0x96, // û
  0x00F9: 0x97, // ù
  0x00FF: 0x98, // ÿ
  0x00D6: 0x99, // Ö
  0x00DC: 0x9A, // Ü
  0x00F8: 0x9B, // ø
  0x00A3: 0x9C, // £
  0x00D8: 0x9D, // Ø
  0x00D7: 0x9E, // ×
  0x00E1: 0xA0, // á
  0x00ED: 0xA1, // í
  0x00F3: 0xA2, // ó
  0x00FA: 0xA3, // ú
  0x00F1: 0xA4, // ñ
  0x00D1: 0xA5, // Ñ
  0x00AA: 0xA6, // ª
  0x00BA: 0xA7, // º
  0x00BF: 0xA8, // ¿
  0x00AE: 0xA9, // ®
  0x00AC: 0xAA, // ¬
  0x00BD: 0xAB, // ½
  0x00BC: 0xAC, // ¼
  0x00A1: 0xAD, // ¡
  0x00AB: 0xAE, // «
  0x00BB: 0xAF, // »
  0x00C1: 0xB5, // Á  (mapped to available slot)
  0x00C0: 0xB7, // À
  0x00A9: 0xB8, // ©
  0x00CD: 0xD6, // Í
  0x00D3: 0xE0, // Ó
  0x00DA: 0xE9, // Ú
  0x20AC: 0xD5, // €
};

class EscPos {
  constructor() {
    this.buffer = [];
  }

  // ── Initialization ──
  init() {
    this.buffer.push(ESC, 0x40); // ESC @ - Initialize printer
    // Select Code Page 858 (Multilingual Latin I + Euro)
    this.buffer.push(ESC, 0x74, 19); // ESC t 19
    return this;
  }

  // ── Text Formatting ──
  bold(on = true) {
    this.buffer.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  underline(on = true) {
    this.buffer.push(ESC, 0x2D, on ? 1 : 0);
    return this;
  }

  // size: 0=normal, 1=double height, 16=double width, 17=double both
  textSize(width = 1, height = 1) {
    const w = Math.min(Math.max(width, 1), 8) - 1;
    const h = Math.min(Math.max(height, 1), 8) - 1;
    this.buffer.push(GS, 0x21, (w << 4) | h);
    return this;
  }

  // align: 0=left, 1=center, 2=right
  align(pos) {
    const val = pos === 'center' ? 1 : pos === 'right' ? 2 : 0;
    this.buffer.push(ESC, 0x61, val);
    return this;
  }

  // ── Content ──
  text(str) {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 128) {
        // ASCII — pass through
        this.buffer.push(code);
      } else if (CP858_MAP[code] !== undefined) {
        // Known CP858 character
        this.buffer.push(CP858_MAP[code]);
      } else {
        // Unknown character — replace with ?
        this.buffer.push(0x3F);
      }
    }
    return this;
  }

  newline(count = 1) {
    for (let i = 0; i < count; i++) {
      this.buffer.push(LF);
    }
    return this;
  }

  // Print a full line of text
  line(str) {
    return this.text(str).newline();
  }

  // Print text padded to fill the line width (42 chars for 80mm)
  row(left, right, width = 42) {
    const gap = width - left.length - right.length;
    const padding = gap > 0 ? ' '.repeat(gap) : ' ';
    return this.line(left + padding + right);
  }

  // Print a separator line
  separator(char = '-', width = 42) {
    return this.line(char.repeat(width));
  }

  // ── Image (raster) ──
  // Accepts a raw monochrome bitmap: array of bytes, width in pixels
  rasterImage(imageBytes, widthPx, heightPx) {
    // GS v 0 — print raster bit image
    // Format: GS v 0 m xL xH yL yH d1...dk
    // m = 0 (normal), xL xH = bytes per line, yL yH = number of lines
    const bytesPerLine = Math.ceil(widthPx / 8);
    this.buffer.push(GS, 0x76, 0x30, 0); // GS v 0, mode 0
    this.buffer.push(bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF); // xL xH
    this.buffer.push(heightPx & 0xFF, (heightPx >> 8) & 0xFF); // yL yH
    for (let i = 0; i < imageBytes.length; i++) {
      this.buffer.push(imageBytes[i]);
    }
    return this;
  }

  // ── Paper Control ──
  feed(lines = 3) {
    this.buffer.push(ESC, 0x64, lines);
    return this;
  }

  cut(partial = false) {
    this.buffer.push(GS, 0x56, partial ? 1 : 0);
    return this;
  }

  // ── Cash Drawer ──
  openDrawer() {
    this.buffer.push(ESC, 0x70, 0, 25, 250); // Pin 2
    return this;
  }

  // ── Output ──
  toBuffer() {
    return Buffer.from(this.buffer);
  }

  // Reset for reuse
  reset() {
    this.buffer = [];
    return this;
  }
}

module.exports = { EscPos };
