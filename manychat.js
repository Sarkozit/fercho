// --- CONFIGURACIÓN PARA ESTE SCRIPT ESPECÍFICO ---
const CONFIG_SCRIPT_DESCUENTO = {
  SHEET_NAME: 'Reservas',
  COLOR_ENVIADO: '#03ff00',      // Verde para envío exitoso
  COLOR_DESCUENTO_BAJO: '#ff9900', // Naranja para descuento insuficiente
  COLUMNAS: {
    FECHA: 2,
    CONFIRMACION_VISUAL: 6, // Columna F
    TELEFONO: 8,
    ADELANTO: 12,            // Columna L
    VALOR_CABALLOS: 14,      // Columna N
    ALIMENTACION: 23,        // Columna W
    LICOR: 24,               // Columna X
    KITS: 25,                // Columna Y
    TRANSPORTE: 26,          // Columna Z
    SALDO_PENDIENTE: 30      // Columna AD
  }
};

/**
 * Función principal que se ejecutará con el activador (trigger).
 */
function enviarNotificacionesDeDescuento() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SCRIPT_DESCUENTO.SHEET_NAME);
  if (!hoja) {
    Logger.log(`Error: No se encontró la hoja "${CONFIG_SCRIPT_DESCUENTO.SHEET_NAME}".`);
    return;
  }

  const rangoDeDatos = hoja.getDataRange();
  const valores = rangoDeDatos.getValues();
  const coloresFondo = rangoDeDatos.getBackgrounds();

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0); 

  for (let i = 1; i < valores.length; i++) {
    const fila = valores[i];
    
    const colorActual = coloresFondo[i][CONFIG_SCRIPT_DESCUENTO.COLUMNAS.CONFIRMACION_VISUAL - 1];
    const fechaReservaRaw = fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.FECHA - 1]; 

    if (!(fechaReservaRaw instanceof Date)) { continue; }
    
    const fechaReserva = new Date(fechaReservaRaw);
    fechaReserva.setHours(0, 0, 0, 0);

    // Verificamos que la celda no esté ya procesada (ni verde ni naranja)
    if (fechaReserva.getTime() === hoy.getTime() && colorActual !== CONFIG_SCRIPT_DESCUENTO.COLOR_ENVIADO && colorActual !== CONFIG_SCRIPT_DESCUENTO.COLOR_DESCUENTO_BAJO) {
      
      const telefonoCliente = estandarizarTelefonoCOL(fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.TELEFONO - 1]);
      
      const saldoPendiente = parseFloat(String(fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.SALDO_PENDIENTE - 1] || '0').replace(/\D/g, ''));
      const adelanto = parseFloat(String(fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.ADELANTO - 1] || '0').replace(/\D/g, ''));
      const valorCaballos = parseFloat(String(fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.VALOR_CABALLOS - 1] || '0').replace(/\D/g, ''));
      const alimentacion = parseFloat(String(fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.ALIMENTACION - 1] || '0').replace(/\D/g, ''));
      const licor = parseFloat(String(fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.LICOR - 1] || '0').replace(/\D/g, ''));
      const kits = parseFloat(String(fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.KITS - 1] || '0').replace(/\D/g, ''));
      const transporte = parseFloat(String(fila[CONFIG_SCRIPT_DESCUENTO.COLUMNAS.TRANSPORTE - 1] || '0').replace(/\D/g, ''));

      // --- CÁLCULO FINAL Y CORRECTO (Este bloque no se tocó) ---
      const totalItemsDescontables = valorCaballos + alimentacion + licor + kits + transporte;
      const baseParaDescuento = totalItemsDescontables - adelanto;
      const montoDescuento = baseParaDescuento > 0 ? baseParaDescuento * 0.10 : 0;
      
      // --- LÓGICA DE LÍMITE DE DESCUENTO INSERTADA CORRECTAMENTE ---
      if (montoDescuento < 50000) {
        // Si el descuento es muy bajo, no se envía mensaje y se pinta de naranja.
        Logger.log(`Fila ${i + 1}: Descuento de ${formatearMonedaCOL(montoDescuento)} es menor a $50.000. No se envía mensaje.`);
        hoja.getRange(i + 1, CONFIG_SCRIPT_DESCUENTO.COLUMNAS.CONFIRMACION_VISUAL).setBackground(CONFIG_SCRIPT_DESCUENTO.COLOR_DESCUENTO_BAJO);
      } else {
        // Si el descuento es suficiente, se procede a enviar el mensaje.
        const nuevoSaldo = saldoPendiente - montoDescuento;
        const datosParaManychat = {
          saldo_pendiente: formatearMonedaCOL(saldoPendiente),
          descuento: formatearMonedaCOL(montoDescuento),
          nuevo_saldo: formatearMonedaCOL(nuevoSaldo)
        };

        try {
          const exito = procesarEnvioManychat(telefonoCliente, datosParaManychat);
          if (exito) {
            hoja.getRange(i + 1, CONFIG_SCRIPT_DESCUENTO.COLUMNAS.CONFIRMACION_VISUAL).setBackground(CONFIG_SCRIPT_DESCUENTO.COLOR_ENVIADO);
            Logger.log(`Proceso completado con éxito para el teléfono ${telefonoCliente}. Celda F${i + 1} marcada.`);
          }
        } catch (error) {
          Logger.log(`Error al procesar envío para la fila ${i + 1}: ${error.message}`);
        }
      }
    }
  }
}

// --- El resto de las funciones auxiliares no cambian ---

function procesarEnvioManychat(telefono, datos) {
  const subscriberId = mcFindSubscriberByPhone(telefono);
  if (!subscriberId) { return false; }
  const cufsExitosos = 
    mcSetCustomField(subscriberId, MC_CONFIG.CUF_IDS.SALDOPENDIENTE, datos.saldo_pendiente) &&
    mcSetCustomField(subscriberId, MC_CONFIG.CUF_IDS.DESCUENTOS, datos.descuento) &&
    mcSetCustomField(subscriberId, MC_CONFIG.CUF_IDS.NUEVOSALDO, datos.nuevo_saldo);
  if (!cufsExitosos) { return false; }
  const flowExitoso = mcSendFlow(subscriberId, MC_CONFIG.FLOWS.DESCUENTO_OFERTA);
  return flowExitoso;
}

function mcFindSubscriberByPhone(phoneDigits) {
  const endpoint = MC_CONFIG.ENDPOINTS.FIND_BY_CUSTOM_FIELD;
  const url = `${MC_CONFIG.API_BASE}${endpoint}?field_id=${MC_CONFIG.CUF_PHONE_DIGITS_ID}&field_value=${phoneDigits}`;
  const options = { 'method': 'get', 'headers': mcGetHeaders(), 'muteHttpExceptions': true };
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  if (response.getResponseCode() === 200 && data.status === 'success' && data.data.length > 0) { return data.data[0].id; }
  return null;
}

function mcSetCustomField(subscriberId, fieldId, value) {
  const endpoint = MC_CONFIG.ENDPOINTS.SET_FIELD;
  const url = `${MC_CONFIG.API_BASE}${endpoint}`;
  const payload = { 'subscriber_id': subscriberId, 'field_id': fieldId, 'field_value': value };
  const options = { 'method': 'post', 'headers': mcGetHeaders(), 'payload': JSON.stringify(payload), 'muteHttpExceptions': true };
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  return response.getResponseCode() === 200 && data.status === 'success';
}

function mcSendFlow(subscriberId, flowNs) {
  const endpoint = MC_CONFIG.ENDPOINTS.START_FLOW;
  const url = `${MC_CONFIG.API_BASE}${endpoint}`;
  const payload = { 'subscriber_id': subscriberId, 'flow_ns': flowNs };
  const options = { 'method': 'post', 'headers': mcGetHeaders(), 'payload': JSON.stringify(payload), 'muteHttpExceptions': true };
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  return response.getResponseCode() === 200 && data.status === 'success';
}

function estandarizarTelefonoCOL(numero) {
  if (!numero) return '';
  var numeroFormateado = numero.toString().replace(/[\s\(\)-]/g, '');
  if (numeroFormateado.length === 10) { numeroFormateado = '57' + numeroFormateado; }
  return numeroFormateado.replace(/\D/g, '');
}

function formatearMonedaCOL(numero) {
  if (isNaN(numero) || numero === null) {
    return '$0';
  }
  const numeroEntero = Math.round(numero);
  const textoConPuntos = numeroEntero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return '$' + textoConPuntos;
}