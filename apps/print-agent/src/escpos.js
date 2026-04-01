/**
 * ESC/POS command builder for Epson TM-T20II thermal printers.
 * 
 * Generates raw byte buffers that the printer understands directly.
 * Reference: Epson ESC/POS Application Programming Guide
 */

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

class EscPos {
  constructor() {
    this.buffer = [];
  }

  // ── Initialization ──
  init() {
    this.buffer.push(ESC, 0x40); // ESC @ - Initialize printer
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
    // Encode to Latin-1 for Spanish characters
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      this.buffer.push(code > 255 ? 0x3F : code); // Replace unknown chars with ?
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
