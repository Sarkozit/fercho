const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('path');
const { startWebSocketServer, stopWebSocketServer, getStatus } = require('./src/server');
const Store = require('electron-store');

const store = new Store();
let tray = null;
let logWindow = null;
const logs = [];

function addLog(msg) {
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logs.push(entry);
  if (logs.length > 200) logs.shift();
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send('log', entry);
  }
  console.log(entry);
}

function createTray() {
  // Create a simple 16x16 icon programmatically
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA0klEQVQ4T2NkoBAwUqifYdAb8P8/w38GBgZGkEsYGRn/MxCwAeYCJLX//zMwQtT+Z2BghLqAgZGR8R8jI8N/BgYYG1kNsi3IpqDbANKP7Cp0PegGgF0AU4usHtkFGAag24CsBmoAumvRXQzzNswlMBciuw3dBhQ/wAKJEAYFEjKIYW5hZECOCJgBjIwMjGBnMjAygqOSFDcwMjIy/AdFKizKYIERx28AyD2o8QAJIHiUgsMIFkCMjIz/QUmZkKvBocDwH5xVYMmUkKuxGkA4aVMOIQBs0FxEZaFo+IAAAAASUVORK5CYII='
  );

  tray = new Tray(icon);

  updateTrayMenu();

  tray.setToolTip('FerchoPrint - Agente de Impresión');
  tray.on('double-click', showLogWindow);
}

function updateTrayMenu() {
  const status = getStatus();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `🟢 WebSocket: Puerto 9111`,
      enabled: false
    },
    { type: 'separator' },
    ...status.printers.map(p => ({
      label: `${p.connected ? '✅' : '❌'} ${p.name}`,
      enabled: false
    })),
    { type: 'separator' },
    {
      label: 'Ver log',
      click: showLogWindow
    },
    {
      label: 'Reescanear impresoras',
      click: () => {
        const { rescanPrinters } = require('./src/server');
        rescanPrinters();
        addLog('Reescaneando impresoras...');
        setTimeout(updateTrayMenu, 2000);
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        stopWebSocketServer();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function showLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }

  logWindow = new BrowserWindow({
    width: 600,
    height: 400,
    title: 'FerchoPrint - Log',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  logWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { background: #1a1a2e; color: #0f0; font-family: 'Consolas', monospace; font-size: 12px; padding: 10px; margin: 0; }
        #log { white-space: pre-wrap; word-wrap: break-word; }
        .entry { margin: 2px 0; padding: 2px 4px; border-left: 2px solid #333; }
        h3 { color: #ff5a5f; margin: 0 0 10px; }
      </style>
    </head>
    <body>
      <h3>🖨️ FerchoPrint Agent Log</h3>
      <div id="log"></div>
      <script>
        const { ipcRenderer } = require('electron');
        const logDiv = document.getElementById('log');
        
        // Show existing logs
        const existing = ${JSON.stringify(logs)};
        existing.forEach(l => {
          const d = document.createElement('div');
          d.className = 'entry';
          d.textContent = l;
          logDiv.appendChild(d);
        });
        
        ipcRenderer.on('log', (_, msg) => {
          const d = document.createElement('div');
          d.className = 'entry';
          d.textContent = msg;
          logDiv.appendChild(d);
          window.scrollTo(0, document.body.scrollHeight);
        });
      </script>
    </body>
    </html>
  `)}`);

  logWindow.setMenuBarVisibility(false);
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showLogWindow();
  });

  app.whenReady().then(() => {
    // Hide dock icon on macOS (not relevant on Windows but good practice)
    if (app.dock) app.dock.hide();

    createTray();
    startWebSocketServer(9111, addLog, updateTrayMenu);
    addLog('FerchoPrint Agent iniciado');
    addLog('WebSocket escuchando en ws://localhost:9111');
  });

  // Prevent app from closing when all windows are closed
  app.on('window-all-closed', (e) => {
    e.preventDefault?.();
  });
}
