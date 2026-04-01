/**
 * Print Agent Service
 * 
 * Maintains a WebSocket connection to the local FerchoPrint Agent 
 * running on ws://localhost:9111.
 * 
 * Usage:
 *   import { printAgent } from './services/printAgent';
 *   printAgent.printComanda('Cocina', { tableNumber: 5, items: [...] });
 *   printAgent.printFactura({ tableNumber: 5, items: [...], total: 50000 });
 */

type PrintStatus = 'connected' | 'disconnected' | 'connecting';
type StatusCallback = (status: PrintStatus) => void;

interface PrinterInfo {
  name: string;
  connected: boolean;
}

class PrintAgentService {
  private ws: WebSocket | null = null;
  private status: PrintStatus = 'disconnected';
  private listeners: StatusCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private printers: PrinterInfo[] = [];

  constructor() {
    this.connect();
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.status === 'connecting') {
      return;
    }

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket('ws://localhost:9111');

      this.ws.onopen = () => {
        console.log('[PrintAgent] ✅ Conectado al agente de impresión');
        this.setStatus('connected');
        this.clearReconnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'status') {
            this.printers = msg.printers || [];
            console.log('[PrintAgent] Impresoras:', this.printers);
            return;
          }

          // Response to a pending request
          if (msg.status) {
            // For now, just log
            if (msg.status === 'ok') {
              console.log(`[PrintAgent] ✅ ${msg.message}`);
            } else {
              console.warn(`[PrintAgent] ❌ ${msg.message}`);
            }
          }
        } catch (e) {
          console.warn('[PrintAgent] Mensaje inválido:', event.data);
        }
      };

      this.ws.onclose = () => {
        console.log('[PrintAgent] Desconectado');
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Error is normal if the agent isn't running
        this.setStatus('disconnected');
      };
    } catch (e) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private setStatus(s: PrintStatus) {
    if (this.status !== s) {
      this.status = s;
      this.listeners.forEach(cb => cb(s));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000); // Retry every 5 seconds
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private send(msg: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    console.warn('[PrintAgent] No conectado — impresión omitida');
    return false;
  }

  // ── Public API ──

  getStatus(): PrintStatus {
    return this.status;
  }

  getPrinters(): PrinterInfo[] {
    return this.printers;
  }

  onStatusChange(cb: StatusCallback) {
    this.listeners.push(cb);
    // Immediately call with current status
    cb(this.status);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  /**
   * Send a comanda to a specific printer destination (e.g. "Cocina", "Bar")
   */
  printComanda(destination: string, data: {
    saleId?: string;
    tableNumber: number | string;
    roomName?: string;
    waiter?: string;
    items: Array<{ qty: number; name: string; comment?: string }>;
  }) {
    return this.send({
      type: 'comanda',
      printer: destination,
      data
    });
  }

  /**
   * Send a receipt/invoice to the bar printer
   */
  printFactura(data: {
    header?: string;
    tableNumber: number | string;
    persons?: number;
    saleId?: string;
    items: Array<{ qty: number; name: string; price: number; comment?: string }>;
    subtotal: number;
    tipPercent?: number;
    tipAmount?: number;
    total: number;
    payments?: Array<{ method: string; amount: number }>;
    change?: number;
    footer?: string;
    qrText?: string;
    qrImage?: string;
  }) {
    return this.send({
      type: 'factura',
      printer: 'Bar',
      data
    });
  }

  /**
   * Request a test print
   */
  testPrint(destination?: string) {
    return this.send({
      type: 'test',
      printer: destination || 'Bar'
    });
  }

  disconnect() {
    this.clearReconnect();
    this.ws?.close();
  }
}

// Singleton instance
export const printAgent = new PrintAgentService();
