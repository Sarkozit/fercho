/**
 * Factura/Receipt template for the bar/caja printer.
 * Based on the real receipt format from the restaurant photo.
 */

const { EscPos } = require('../escpos');

function formatMoney(amount) {
  return amount.toLocaleString('es-CO');
}

/**
 * Convert a base64 image to monochrome raster data for ESC/POS.
 * Uses a simple threshold algorithm — works for QR codes which are black/white.
 */
function base64ToRaster(base64Str, maxWidth = 384) {
  // Strip data URL prefix if present
  const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, '');
  
  try {
    // We'll use a simplified approach: decode the PNG/JPEG manually
    // For QR codes, we can use the built-in QR printing of ESC/POS instead
    // For now, return null and we'll print qrText as fallback
    return null;
  } catch (e) {
    return null;
  }
}

function buildFactura(data) {
  const esc = new EscPos();
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear().toString().slice(2)} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  esc.init();

  // ── Header (restaurant info from settings) ──
  esc.align('left');
  esc.textSize(1, 1);
  if (data.header) {
    const headerLines = data.header.split('\n');
    for (const line of headerLines) {
      esc.line(line);
    }
  }
  esc.newline();

  // ── Sale Info ──
  esc.line(`Mesa: ${data.tableNumber}`);
  if (data.persons) {
    esc.line(`Personas: ${data.persons}`);
  }
  if (data.saleId) {
    esc.line(`ID: #${data.saleId}`);
  }
  esc.line(`Fecha: ${dateStr}`);
  esc.newline();

  // ── Items ──
  for (const item of data.items) {
    const name = item.name;
    const total = formatMoney(item.price * item.qty);
    esc.row(`${item.qty}   ${name}`, total);
    if (item.comment) {
      esc.line(`     ${item.comment}`);
    }
  }

  // Subtotal
  esc.row('Subtotal', formatMoney(data.subtotal));
  esc.newline();

  // ── Tax Detail ── 
  esc.separator('-');
  esc.align('center');
  esc.line('Detalle de Valores');
  esc.align('left');
  esc.separator('-');
  esc.row('Vta. Gravada', '0.00');
  esc.row('Vta. Excluida', `${formatMoney(data.subtotal)}.00`);
  esc.newline();

  esc.separator('-');
  esc.align('center');
  esc.line('Informacion Tributaria');
  esc.align('left');
  esc.separator('-');
  esc.row('%       Vlr Base', 'Vlr Imp');
  esc.newline();
  esc.row('0.00    ' + formatMoney(data.subtotal), '0.00');
  esc.newline();

  // ── Tip + Total ──
  const tipAmount = data.tipAmount || 0;
  const total = data.total || (data.subtotal + tipAmount);

  if (tipAmount > 0) {
    esc.row(`PROPINA SUGERIDA ${data.tipPercent || 10}`, formatMoney(tipAmount));
  }
  esc.row('Subtotal', formatMoney(data.subtotal + tipAmount));
  esc.newline();

  // Total in bold + larger
  esc.bold(true);
  esc.textSize(1, 2);
  esc.row('Total', formatMoney(total));
  esc.textSize(1, 1);
  esc.bold(false);
  esc.newline();

  // ── Payment Info ──
  if (data.payments && data.payments.length > 0) {
    esc.separator('-');
    for (const p of data.payments) {
      esc.row(p.method, formatMoney(p.amount));
    }
    if (data.change && data.change > 0) {
      esc.row('Cambio', formatMoney(data.change));
    }
    esc.newline();
  }

  // ── Footer (legal text from settings) ──
  if (data.footer) {
    esc.newline();
    esc.align('center');
    esc.textSize(1, 1);
    const footerLines = data.footer.split('\n');
    for (const line of footerLines) {
      esc.line(line);
    }
  }

  // ── QR Section ──
  if (data.qrText) {
    esc.newline();
    esc.align('center');
    esc.line(data.qrText);
  }

  // Print QR code using ESC/POS native QR command if qrImage has data
  if (data.qrImage && data.qrImage.length > 0) {
    esc.newline();
    esc.align('center');
    // Use GS ( k — QR Code command (Model 2)
    // This prints a native QR code on the printer using the qrText as data
    const qrData = data.qrText || 'https://fondacaballoloco.com';
    const qrBytes = Buffer.from(qrData, 'utf8');
    const len = qrBytes.length + 3;
    
    // Function 165: Select model (Model 2)
    esc.buffer.push(0x1D, 0x28, 0x6B, 4, 0, 0x31, 0x41, 0x32, 0x00);
    // Function 167: Set module size (6 dots)
    esc.buffer.push(0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x43, 6);
    // Function 169: Set error correction (L = 48)
    esc.buffer.push(0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x45, 0x31);
    // Function 180: Store data
    esc.buffer.push(0x1D, 0x28, 0x6B, len & 0xFF, (len >> 8) & 0xFF, 0x31, 0x50, 0x30);
    for (let i = 0; i < qrBytes.length; i++) {
      esc.buffer.push(qrBytes[i]);
    }
    // Function 181: Print stored QR
    esc.buffer.push(0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x51, 0x30);
    
    esc.newline();
  }

  esc.feed(4);
  esc.cut();

  return esc.toBuffer();
}

module.exports = { buildFactura };
