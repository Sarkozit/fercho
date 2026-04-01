const { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startWebSocketServer, stopWebSocketServer, getStatus } = require('./src/server');
const Store = require('electron-store');

// IPC: test print from panel button
ipcMain.on('test-print', () => {
  const { testPrint } = require('./src/printer');
  testPrint(null, addLog);
});

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
    logWindow.show();
    logWindow.focus();
    return;
  }

  logWindow = new BrowserWindow({
    width: 520,
    height: 420,
    title: 'FerchoPrint Agent',
    resizable: true,
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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111827; color: #e5e7eb; font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        
        .header { background: #1f2937; padding: 16px 20px; border-bottom: 1px solid #374151; display: flex; align-items: center; justify-content: space-between; }
        .header h2 { font-size: 15px; font-weight: 700; color: #f9fafb; display: flex; align-items: center; gap: 8px; }
        .status { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        
        .actions { padding: 12px 20px; display: flex; gap: 8px; background: #1f2937; border-bottom: 1px solid #374151; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary { background: #374151; color: #d1d5db; }
        .btn-secondary:hover { background: #4b5563; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-danger:hover { background: #dc2626; }
        .btn-green { background: #059669; color: white; }
        .btn-green:hover { background: #047857; }
        
        #log-section { flex: 1; overflow-y: auto; padding: 12px; display: none; }
        #log-section.visible { display: block; }
        #log-section .entry { font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; color: #9ca3af; padding: 2px 6px; border-left: 2px solid #374151; margin: 1px 0; }
        #log-section .entry:last-child { color: #10b981; border-left-color: #10b981; }
        
        .info { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6b7280; font-size: 13px; gap: 8px; }
        .info.hidden { display: none; }
        .info .big { font-size: 40px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2><span class="status"></span> FerchoPrint Agent</h2>
        <span style="font-size:11px;color:#6b7280;">v1.0.0 | Puerto 9111</span>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" id="btnLog">📋 Ver Log</button>
        <button class="btn btn-green" id="btnTest">🖨️ Imprimir Prueba</button>
        <button class="btn btn-secondary" id="btnMinimize">➖ Minimizar</button>
      </div>
      <div class="info" id="info-panel">
        <span class="big">🖨️</span>
        <span>Agente de impresión activo</span>
        <span style="color:#4b5563;font-size:11px;">Escuchando conexiones del POS en ws://localhost:9111</span>
      </div>
      <div id="log-section"></div>
      <script>
        const { ipcRenderer } = require('electron');
        const logDiv = document.getElementById('log-section');
        const infoPanel = document.getElementById('info-panel');
        let logVisible = false;
        
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
          if (logVisible) logDiv.scrollTop = logDiv.scrollHeight;
        });
        
        document.getElementById('btnLog').addEventListener('click', () => {
          logVisible = !logVisible;
          logDiv.className = logVisible ? 'visible' : '';
          infoPanel.className = logVisible ? 'info hidden' : 'info';
          document.getElementById('btnLog').textContent = logVisible ? '📋 Ocultar Log' : '📋 Ver Log';
          if (logVisible) logDiv.scrollTop = logDiv.scrollHeight;
        });
        
        document.getElementById('btnTest').addEventListener('click', () => {
          ipcRenderer.send('test-print');
        });
        
        document.getElementById('btnMinimize').addEventListener('click', () => {
          require('electron').remote ? require('electron').remote.getCurrentWindow().hide() : window.close();
        });
      </script>
    </body>
    </html>
  `)}`);

  logWindow.setMenuBarVisibility(false);
  
  // Don't quit when window is closed — just hide
  logWindow.on('close', (e) => {
    e.preventDefault();
    logWindow.hide();
  });
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

    // Auto-start on Windows login
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        name: 'FerchoPrint'
      });
    } catch (e) {
      console.error('Auto-start setup failed:', e.message);
    }

    // Try to create tray (may fail on some Windows configs)
    try {
      createTray();
    } catch (e) {
      console.error('Tray creation failed:', e.message);
    }

    startWebSocketServer(9111, addLog, updateTrayMenu);
    addLog('FerchoPrint Agent iniciado');
    addLog('WebSocket escuchando en ws://localhost:9111');
    // Panel stays hidden — user opens it via desktop shortcut (second-instance)
  });

  // Prevent app from closing when all windows are closed
  app.on('window-all-closed', (e) => {
    e.preventDefault?.();
  });
}
