/**
 * Comanda template for kitchen/bar printers.
 * Based on the real ticket format from the restaurant.
 * 
 * Header: small text with sale info
 * Body: large bold text with product names (easy to read in kitchen)
 */

const { EscPos } = require('../escpos');

function buildComanda(data) {
  const esc = new EscPos();
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear().toString().slice(2)} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  esc.init();

  // ── Header (small text) ──
  esc.textSize(1, 1);
  esc.align('left');
  if (data.saleId) {
    esc.line(`Venta: # ${data.saleId}`);
  }
  esc.line(dateStr);
  esc.line(`Mesa ${data.tableNumber}${data.roomName ? ' - ' + data.roomName : ''}`);
  if (data.waiter) {
    esc.line(data.waiter);
  }
  esc.line(data.destination || 'Cocina'); // "Cocina", "Bar", "Tienda"
  esc.newline();

  // ── Items ──
  esc.bold(true);

  for (const item of data.items) {
    // Special: INTRO_ASADO = paragraph intro (normal size, no qty)
    if (item.name === 'INTRO_ASADO') {
      esc.textSize(1, 1);
      if (item.comment) {
        // Split by newlines and word-wrap each paragraph
        const paragraphs = item.comment.split('\n');
        for (const para of paragraphs) {
          if (para.trim() === '') { esc.newline(); continue; }
          const words = para.split(' ');
          let currentLine = '';
          for (const word of words) {
            if (currentLine.length + word.length + 1 > 42) {
              esc.line(currentLine);
              currentLine = word;
            } else {
              currentLine = currentLine ? `${currentLine} ${word}` : word;
            }
          }
          if (currentLine) esc.line(currentLine);
        }
      }
      esc.newline();
      continue;
    }

    // Long text (paragraphs) → use normal size for readability
    if (item.name.length > 20) {
      esc.textSize(1, 1);
      const words = item.name.split(' ');
      let currentLine = '';
      for (const word of words) {
        if (currentLine.length + word.length + 1 > 42) {
          esc.line(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
      }
      if (currentLine) esc.line(currentLine);
    } else {
      // Short items → large bold (kitchen-readable)
      esc.textSize(2, 2);
      esc.line(`${item.qty} ${item.name}`);
    }
    if (item.comment) {
      esc.textSize(1, 1);
      esc.newline();
      const cWords = item.comment.split(' ');
      let cLine = '';
      for (const w of cWords) {
        if (cLine.length + w.length + 1 > 42) {
          esc.line(cLine);
          cLine = w;
        } else {
          cLine = cLine ? `${cLine} ${w}` : w;
        }
      }
      if (cLine) esc.line(cLine);
      esc.newline();
    }
  }

  // ── Footer ──
  esc.textSize(1, 1);
  esc.bold(false);
  esc.feed(4);
  esc.cut();

  return esc.toBuffer();
}

module.exports = { buildComanda };
