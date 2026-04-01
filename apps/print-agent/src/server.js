const WebSocket = require('ws');
const { printComanda, printFactura, testPrint } = require('./printer');

let wss = null;
let connectedClients = 0;
let printerStatus = [];
let logFn = console.log;
let updateMenuFn = () => {};

function startWebSocketServer(port, log, updateMenu) {
  logFn = log || console.log;
  updateMenuFn = updateMenu || (() => {});

  wss = new WebSocket.Server({ port });

  wss.on('connection', (ws) => {
    connectedClients++;
    logFn(`Cliente POS conectado (${connectedClients} activos)`);
    updateMenuFn();

    // Send current status immediately
    ws.send(JSON.stringify({
      type: 'status',
      agent: 'FerchoPrint',
      version: '1.0.0',
      printers: printerStatus
    }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        logFn(`📨 Recibido: ${msg.type} → ${msg.printer || 'default'}`);

        let result;

        switch (msg.type) {
          case 'comanda':
            result = await printComanda(msg.printer, msg.data, logFn);
            break;

          case 'factura':
            result = await printFactura(msg.printer, msg.data, logFn);
            break;

          case 'test':
            result = await testPrint(msg.printer, logFn);
            break;

          case 'status':
            result = { status: 'ok', printers: printerStatus };
            break;

          case 'rescan':
            rescanPrinters();
            result = { status: 'ok', message: 'Reescaneando...' };
            break;

          default:
            result = { status: 'error', message: `Tipo desconocido: ${msg.type}` };
        }

        ws.send(JSON.stringify(result));
      } catch (err) {
        logFn(`❌ Error procesando mensaje: ${err.message}`);
        ws.send(JSON.stringify({ 
          status: 'error', 
          message: err.message 
        }));
      }
    });

    ws.on('close', () => {
      connectedClients--;
      logFn(`Cliente POS desconectado (${connectedClients} activos)`);
      updateMenuFn();
    });

    ws.on('error', (err) => {
      logFn(`⚠️ Error WebSocket: ${err.message}`);
    });
  });

  wss.on('error', (err) => {
    logFn(`❌ Error servidor WebSocket: ${err.message}`);
  });

  // Initial printer scan
  rescanPrinters();
}

function rescanPrinters() {
  try {
    const { getConnectedPrinters } = require('./printer');
    printerStatus = getConnectedPrinters(logFn);
    updateMenuFn();
  } catch (err) {
    logFn(`⚠️ Error escaneando impresoras: ${err.message}`);
    printerStatus = [];
  }
}

function stopWebSocketServer() {
  if (wss) {
    wss.close();
    logFn('WebSocket server detenido');
  }
}

function getStatus() {
  return {
    clients: connectedClients,
    printers: printerStatus
  };
}

module.exports = {
  startWebSocketServer,
  stopWebSocketServer,
  getStatus,
  rescanPrinters
};
