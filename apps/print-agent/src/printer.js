/**
 * Printer Manager for Epson TM-T20II connected via USB.
 * 
 * Uses the 'escpos' and 'escpos-usb' packages to detect and 
 * send raw ESC/POS data to USB thermal printers.
 * 
 * Configuration is loaded from electron-store with printer-to-USB mappings.
 */

const Store = require('electron-store');
const { buildComanda } = require('./templates/comanda');
const { buildFactura } = require('./templates/factura');

const store = new Store();

// Printer configuration stored locally
// Format: { "Cocina": { usbVendorId: ..., usbProductId: ..., name: "Cocina" }, ... }

let connectedPrinters = [];

/**
 * Try to detect connected USB printers.
 * Epson TM-T20II USB IDs: Vendor 0x04B8, Product 0x0E15
 */
function getConnectedPrinters(log) {
  connectedPrinters = [];

  try {
    const usb = require('usb');
    const devices = usb.getDeviceList();

    // Epson vendor ID
    const EPSON_VENDOR = 0x04B8;
    // TM-T20II product IDs (may vary by revision)
    const EPSON_PRODUCTS = [0x0E15, 0x0E03, 0x0E28, 0x0202];

    const epsonDevices = devices.filter(d => 
      d.deviceDescriptor.idVendor === EPSON_VENDOR &&
      EPSON_PRODUCTS.includes(d.deviceDescriptor.idProduct)
    );

    if (epsonDevices.length === 0) {
      log('⚠️ No se encontraron impresoras Epson USB conectadas');

      // Fallback: check if any USB printer-class devices exist
      const printerClass = devices.filter(d => {
        try {
          return d.configDescriptor?.interfaces?.some(iface =>
            iface.some(alt => alt.bInterfaceClass === 7) // Printer class
          );
        } catch { return false; }
      });

      if (printerClass.length > 0) {
        log(`📎 Se encontraron ${printerClass.length} dispositivo(s) USB tipo impresora`);
        printerClass.forEach((dev, i) => {
          connectedPrinters.push({
            name: `USB Printer ${i + 1}`,
            vendorId: dev.deviceDescriptor.idVendor,
            productId: dev.deviceDescriptor.idProduct,
            connected: true,
            device: dev
          });
        });
      }
    } else {
      log(`✅ ${epsonDevices.length} impresora(s) Epson detectada(s)`);
      epsonDevices.forEach((dev, i) => {
        connectedPrinters.push({
          name: `Epson TM-T20II #${i + 1}`,
          vendorId: dev.deviceDescriptor.idVendor,
          productId: dev.deviceDescriptor.idProduct,
          connected: true,
          device: dev
        });
      });
    }
  } catch (err) {
    log(`⚠️ Error detectando USB (normal en desarrollo): ${err.message}`);
    // In dev mode without USB access, create mock printers
    connectedPrinters = [
      { name: 'Cocina (simulada)', connected: false },
      { name: 'Bar (simulada)', connected: false }
    ];
  }

  return connectedPrinters.map(p => ({ 
    name: p.name, 
    connected: p.connected 
  }));
}

/**
 * Send raw ESC/POS data to a USB printer.
 */
async function sendToUSBPrinter(printerDevice, data, log) {
  return new Promise((resolve, reject) => {
    try {
      const device = printerDevice.device;
      
      if (!device) {
        // Simulated/mock mode - just log
        log(`📝 [SIMULADO] Datos enviados (${data.length} bytes)`);
        resolve();
        return;
      }

      device.open();

      // Find a bulk OUT endpoint
      const iface = device.interfaces[0];
      if (iface.isKernelDriverActive()) {
        iface.detachKernelDriver();
      }
      iface.claim();

      const outEndpoint = iface.endpoints.find(ep => ep.direction === 'out');

      if (!outEndpoint) {
        reject(new Error('No se encontró endpoint de salida en la impresora'));
        return;
      }

      outEndpoint.transfer(data, (err) => {
        try {
          iface.release(() => {
            device.close();
          });
        } catch (e) { /* ignore */ }

        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Find the right USB printer for a given destination name.
 * Uses the printer mappings stored in electron-store.
 */
function findPrinterForDestination(destination, log) {
  // Load mappings from store
  // Format: { "Cocina": 0, "Bar": 1 } (index into connectedPrinters)
  const mappings = store.get('printerMappings', {});
  
  const printerIndex = mappings[destination];
  
  if (printerIndex !== undefined && connectedPrinters[printerIndex]) {
    return connectedPrinters[printerIndex];
  }

  // Auto-assign: first printer for "Cocina", second for everything else
  if (connectedPrinters.length >= 2) {
    if (destination === 'Cocina') {
      return connectedPrinters[0];
    }
    return connectedPrinters[1]; // Bar, Tienda, Factura
  }

  if (connectedPrinters.length === 1) {
    return connectedPrinters[0]; // Only one printer, use it for everything
  }

  log(`⚠️ No hay impresora asignada para: ${destination}`);
  return null;
}

// ── Public API ──

async function printComanda(destination, data, log) {
  log(`🖨️ Imprimiendo comanda → ${destination}`);
  
  const buffer = buildComanda({ ...data, destination });
  const printer = findPrinterForDestination(destination, log);

  if (!printer) {
    return { status: 'error', message: `No hay impresora para ${destination}` };
  }

  try {
    await sendToUSBPrinter(printer, buffer, log);
    log(`✅ Comanda impresa en ${printer.name}`);
    return { status: 'ok', message: `Impreso en ${printer.name}` };
  } catch (err) {
    log(`❌ Error imprimiendo: ${err.message}`);
    return { status: 'error', message: err.message };
  }
}

async function printFactura(destination, data, log) {
  log(`🧾 Imprimiendo factura → ${destination || 'Bar'}`);

  const buffer = buildFactura(data);
  const printer = findPrinterForDestination(destination || 'Bar', log);

  if (!printer) {
    return { status: 'error', message: 'No hay impresora para facturas' };
  }

  try {
    await sendToUSBPrinter(printer, buffer, log);
    log(`✅ Factura impresa en ${printer.name}`);
    return { status: 'ok', message: `Factura impresa en ${printer.name}` };
  } catch (err) {
    log(`❌ Error imprimiendo factura: ${err.message}`);
    return { status: 'error', message: err.message };
  }
}

async function testPrint(destination, log) {
  log(`🧪 Impresión de prueba → ${destination || 'Todas'}`);

  const { EscPos } = require('./escpos');
  const esc = new EscPos();
  esc.init()
    .align('center')
    .bold(true)
    .textSize(2, 2)
    .line('FERCHO POS')
    .textSize(1, 1)
    .bold(false)
    .newline()
    .line('Impresion de prueba OK')
    .line(new Date().toLocaleString('es-CO'))
    .newline()
    .separator('=')
    .line(`Destino: ${destination || 'General'}`)
    .feed(3)
    .cut();

  const printer = findPrinterForDestination(destination || 'Bar', log);
  if (!printer) {
    return { status: 'error', message: 'No hay impresora conectada' };
  }

  try {
    await sendToUSBPrinter(printer, esc.toBuffer(), log);
    log('✅ Prueba de impresión completada');
    return { status: 'ok', message: 'Prueba exitosa' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

module.exports = {
  getConnectedPrinters,
  printComanda,
  printFactura,
  testPrint
};
