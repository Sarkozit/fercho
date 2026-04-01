/**
 * Factura/Receipt template for the bar/caja printer.
 * Based on the real receipt format from the restaurant photo.
 * 
 * Layout:
 * - Header (restaurant info)
 * - Sale info (mesa, personas, id, fecha)
 * - Items with prices
 * - Subtotal
 * - Tax detail
 * - Tip + Total
 * - Footer (legal text)
 */

const { EscPos } = require('../escpos');

function formatMoney(amount) {
  return amount.toLocaleString('es-CO');
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

  // ── QR Text ──
  if (data.qrText) {
    esc.newline();
    esc.align('center');
    esc.line(data.qrText);
  }

  esc.feed(4);
  esc.cut();

  return esc.toBuffer();
}

module.exports = { buildFactura };
