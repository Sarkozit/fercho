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

  // ── Items (large bold text - easy to read) ──
  esc.bold(true);
  esc.textSize(2, 2); // Double width + double height

  for (const item of data.items) {
    esc.line(`${item.qty} ${item.name}`);
    if (item.comment) {
      esc.textSize(1, 2); // Smaller width for comments
      esc.line(`  -> ${item.comment}`);
      esc.textSize(2, 2); // Back to large
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
