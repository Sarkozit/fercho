/**
 * Printer Manager for Epson TM-T20II on Windows.
 * 
 * Uses Windows built-in printing via:
 * 1. Write ESC/POS data to a temp file
 * 2. Send to printer using: copy /b tempfile.bin "\\.\USB001" 
 *    or via the Windows shared printer name
 * 
 * NO native dependencies needed - works with pure Node.js!
 * 
 * Configuration is stored in electron-store with printer name mappings.
 */

const { execFile, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Store = require('electron-store');
const { buildComanda } = require('./templates/comanda');
const { buildFactura } = require('./templates/factura');

const store = new Store();

let detectedPrinters = [];

/**
 * Get installed Windows printers using PowerShell.
 */
function getConnectedPrinters(log) {
  detectedPrinters = [];

  if (process.platform !== 'win32') {
    log('⚠️ Detección de impresoras solo funciona en Windows');
    detectedPrinters = [
      { name: 'Cocina (simulada)', connected: false, windowsName: '' },
      { name: 'Bar (simulada)', connected: false, windowsName: '' }
    ];
    return detectedPrinters.map(p => ({ name: p.name, connected: p.connected }));
  }

  try {
    // Use PowerShell to list printers (synchronous via execSync for initial scan)
    const { execSync } = require('child_process');
    const output = execSync(
      'powershell -Command "Get-Printer | Select-Object Name, PrinterStatus, PortName | ConvertTo-Json"',
      { encoding: 'utf8', timeout: 10000 }
    );

    let printers = [];
    try {
      const parsed = JSON.parse(output);
      printers = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      log('⚠️ No se pudo parsear lista de impresoras');
      return [];
    }

    // Filter for likely thermal/Epson printers + all printers for user mapping
    for (const p of printers) {
      if (!p.Name) continue;

      const isEpson = p.Name.toLowerCase().includes('epson') ||
        p.Name.toLowerCase().includes('tm-') ||
        p.Name.toLowerCase().includes('thermal') ||
        p.Name.toLowerCase().includes('pos');

      detectedPrinters.push({
        name: p.Name,
        connected: true,
        windowsName: p.Name,
        portName: p.PortName || '',
        isEpson
      });
    }

    // Sort: Epson printers first
    detectedPrinters.sort((a, b) => (b.isEpson ? 1 : 0) - (a.isEpson ? 1 : 0));

    if (detectedPrinters.length > 0) {
      log(`✅ ${detectedPrinters.length} impresora(s) detectada(s) en Windows`);
      detectedPrinters.forEach(p => {
        log(`   ${p.isEpson ? '🖨️' : '📄'} ${p.name} (puerto: ${p.portName})`);
      });
    } else {
      log('⚠️ No se detectaron impresoras instaladas');
    }

  } catch (err) {
    log(`⚠️ Error listando impresoras: ${err.message}`);
    detectedPrinters = [];
  }

  return detectedPrinters.map(p => ({ name: p.name, connected: p.connected }));
}

/**
 * Send raw ESC/POS data to a Windows printer.
 * Uses: copy /b tempfile "\\.\printerPort"
 * Or PowerShell raw printing for shared printers.
 */
async function sendToPrinter(printerWindowsName, data, log) {
  if (!printerWindowsName) {
    throw new Error('No se especificó nombre de impresora Windows');
  }

  // Write data to temp file
  const tmpFile = path.join(os.tmpdir(), `fercho_print_${Date.now()}.bin`);
  fs.writeFileSync(tmpFile, data);

  // Write PowerShell script to temp file (avoids here-string issues with inline commands)
  const psFile = path.join(os.tmpdir(), `fercho_print_${Date.now()}.ps1`);
  const psScript = `
$printerName = "${printerWindowsName.replace(/"/g, '`"')}"
$filePath = "${tmpFile.replace(/\\/g, '\\\\')}"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.IO;

public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
  }
  
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  
  [DllImport("winspool.drv", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOW pDocInfo);
  
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
  
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  
  public static bool SendRaw(string printerName, byte[] data) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
    
    var docInfo = new DOCINFOW { pDocName = "FerchoPOS", pOutputFile = null, pDatatype = "RAW" };
    
    if (!StartDocPrinter(hPrinter, 1, ref docInfo)) { ClosePrinter(hPrinter); return false; }
    if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }
    
    int written;
    bool ok = WritePrinter(hPrinter, data, data.Length, out written);
    
    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
    
    return ok;
  }
}
"@

$bytes = [System.IO.File]::ReadAllBytes($filePath)
$result = [RawPrinter]::SendRaw($printerName, $bytes)

if ($result) {
  Write-Output "OK"
} else {
  Write-Error "Failed to send raw data to printer"
  exit 1
}
`;

  fs.writeFileSync(psFile, psScript, 'utf8');

  return new Promise((resolve, reject) => {
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
      { timeout: 15000 },
      (err, stdout, stderr) => {
        // Cleanup temp files
        try { fs.unlinkSync(tmpFile); } catch { }
        try { fs.unlinkSync(psFile); } catch { }

        if (err) {
          log(`❌ Error enviando a impresora: ${stderr || err.message}`);
          reject(new Error(stderr || err.message));
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Find the Windows printer name for a given POS destination.
 * Uses mappings stored in electron-store.
 * 
 * Mappings format: { "Cocina": "EPSON TM-T20II Receipt", "Bar": "EPSON TM-T20II Receipt5" }
 */
function getWindowsPrinterName(destination, log) {
  const mappings = store.get('printerMappings', {});

  if (mappings[destination]) {
    return mappings[destination];
  }

  // Auto-detect: if only Epson printers exist, map them
  const epsonPrinters = detectedPrinters.filter(p => p.isEpson);

  if (epsonPrinters.length === 1) {
    // Only one Epson: use it for everything
    log(`📎 Auto-asignando ${epsonPrinters[0].name} para "${destination}"`);
    return epsonPrinters[0].windowsName;
  }

  if (epsonPrinters.length >= 2) {
    // Two Epsons: first for Cocina, second for Bar/Tienda/Factura
    if (destination === 'Cocina') {
      return epsonPrinters[0].windowsName;
    }
    return epsonPrinters[1].windowsName;
  }

  // Fallback: use first available printer
  if (detectedPrinters.length > 0) {
    log(`⚠️ No hay Epson, usando ${detectedPrinters[0].name} para "${destination}"`);
    return detectedPrinters[0].windowsName;
  }

  return null;
}

// ── Public API ──

async function printComanda(destination, data, log) {
  log(`🖨️ Imprimiendo comanda → ${destination}`);

  const windowsPrinterName = getWindowsPrinterName(destination, log);

  if (!windowsPrinterName) {
    const msg = `No hay impresora configurada para "${destination}"`;
    log(`⚠️ ${msg}`);
    return { status: 'error', message: msg };
  }

  try {
    const buffer = buildComanda({ ...data, destination });
    await sendToPrinter(windowsPrinterName, buffer, log);
    log(`✅ Comanda impresa en ${windowsPrinterName}`);
    return { status: 'ok', message: `Impreso en ${windowsPrinterName}` };
  } catch (err) {
    log(`❌ Error: ${err.message}`);
    return { status: 'error', message: err.message };
  }
}

async function printFactura(destination, data, log) {
  log(`🧾 Imprimiendo factura`);

  const windowsPrinterName = getWindowsPrinterName(destination || 'Bar', log);

  if (!windowsPrinterName) {
    return { status: 'error', message: 'No hay impresora para facturas' };
  }

  try {
    const buffer = buildFactura(data);
    await sendToPrinter(windowsPrinterName, buffer, log);
    log(`✅ Factura impresa en ${windowsPrinterName}`);
    return { status: 'ok', message: `Factura impresa en ${windowsPrinterName}` };
  } catch (err) {
    log(`❌ Error: ${err.message}`);
    return { status: 'error', message: err.message };
  }
}

async function testPrint(destination, log) {
  log(`🧪 Prueba de impresión → ${destination || 'Todas'}`);

  const windowsPrinterName = getWindowsPrinterName(destination || 'Bar', log);

  if (!windowsPrinterName) {
    return { status: 'error', message: 'No hay impresora conectada' };
  }

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
    .line(`Impresora: ${windowsPrinterName}`)
    .feed(3)
    .cut();

  try {
    await sendToPrinter(windowsPrinterName, esc.toBuffer(), log);
    log('✅ Prueba completada');
    return { status: 'ok', message: 'Prueba exitosa' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

async function openDrawer(destination, log) {
  log('💰 Enviando señal para abrir caja');

  const windowsPrinterName = getWindowsPrinterName(destination || 'Bar', log);
  
  if (!windowsPrinterName) {
    return { status: 'error', message: 'No hay impresora para abrir caja' };
  }

  const { EscPos } = require('./escpos');
  const esc = new EscPos();
  esc.init().openDrawer();

  try {
    await sendToPrinter(windowsPrinterName, esc.toBuffer(), log);
    log('✅ Caja abierta');
    return { status: 'ok', message: 'Caja abierta' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

module.exports = {
  getConnectedPrinters,
  printComanda,
  printFactura,
  testPrint,
  openDrawer
};
