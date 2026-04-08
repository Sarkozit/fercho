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
    // Note: comments are NOT printed on invoices (only on kitchen comandas)
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

  // ── Tip, Discount + Total ──
  const tipAmount = data.tipAmount || 0;
  const discount = data.discount || 0;
  
  // Notice: The exact calculation depends on if the total given includes them.
  // The backend/frontend sends `data.total` which already has tip added and discount subtracted.
  const total = data.total || (data.subtotal + tipAmount - discount);

  if (tipAmount > 0) {
    esc.row(`PROPINA SUGERIDA ${data.tipPercent || 10}`, formatMoney(tipAmount));
    esc.row('Subtotal', formatMoney(data.subtotal + tipAmount));
  }

  if (discount > 0) {
    esc.row('Descuento', `-${formatMoney(discount)}`);
  }
  
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

  // Print the actual QR image uploaded by the user (raster bitmap)
  if (data.qrImage && data.qrImage.length > 50) {
    try {
      const { nativeImage } = require('electron');
      let img = nativeImage.createFromDataURL(data.qrImage);
      
      if (!img.isEmpty()) {
        // Resize to 300px wide (large, easy to scan on 80mm paper = 384px max)
        const originalSize = img.getSize();
        const targetWidth = 380; // Maximum width for 80mm paper
        const scale = targetWidth / originalSize.width;
        const newHeight = Math.round(originalSize.height * scale);
        img = img.resize({ width: targetWidth, height: newHeight });
        
        const size = img.getSize();
        const bitmap = img.toBitmap(); // RGBA buffer
        const widthPx = size.width;
        const heightPx = size.height;
        const bytesPerLine = Math.ceil(widthPx / 8);
        const rasterData = [];
        
        for (let y = 0; y < heightPx; y++) {
          for (let byteX = 0; byteX < bytesPerLine; byteX++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
              const x = byteX * 8 + bit;
              if (x < widthPx) {
                const offset = (y * widthPx + x) * 4;
                const r = bitmap[offset];
                const g = bitmap[offset + 1];
                const b = bitmap[offset + 2];
                const brightness = (r + g + b) / 3;
                // Dark pixel → set bit (print black)
                if (brightness < 128) {
                  byte |= (1 << (7 - bit));
                }
              }
            }
            rasterData.push(byte);
          }
        }
        
        esc.newline();
        esc.align('center');
        esc.rasterImage(rasterData, widthPx, heightPx);
        esc.newline();
      }
    } catch (e) {
      // If image decoding fails, silently skip
      console.error('QR image print error:', e.message);
    }
  }

  esc.feed(4);
  esc.cut();

  return esc.toBuffer();
}

module.exports = { buildFactura };
