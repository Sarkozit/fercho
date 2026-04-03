// --- CONFIGURACIÓN ---
var COLUMNA_CUPOS_Y_ESTADO = 8;
var COLOR_ENVIADO = '#04ffff';      // Celeste: Recordatorio enviado, pero aún incompleto.
var COLOR_COMPLETADO = '#00ff00';   // Verde: La reserva está 100% lista.
var COLUMNA_ID = 0;
var COLUMNA_FECHA = 1;
var COLUMNA_NOMBRE = 4;
var COLUMNA_WHATSAPP = 7;

/**
 * Función principal con lógica de estados para gestionar el ciclo de vida de una reserva.
 */
function RecordatorioPolizaConReglas() {
  var ahora = new Date();
  var horaActual = ahora.getHours();

  if (horaActual < 8 || horaActual >= 21) {
    Logger.log('Fuera del horario de envío (8:00 AM - 9:00 PM). El script no se ejecutará.');
    return;
  }

  Logger.log('Dentro del horario de envío. Iniciando la verificación de reservas.');

  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var reservasSheet = sheet.getSheetByName('Reservas');
  var polizaSheet = sheet.getSheetByName('Póliza');

  var hoy = new Date();
  hoy.setHours(0,0,0,0);
  var manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  var datosReservas = reservasSheet.getDataRange().getValues();
  var datosPoliza = polizaSheet.getRange("F:F").getValues();

  // De-duplicación por número en esta ejecución
  var numerosProcesados = new Set();

  for (var i = 1; i < datosReservas.length; i++) {
    var fila = datosReservas[i];

    var fechaReserva = new Date(fila[COLUMNA_FECHA]);
    fechaReserva.setHours(0,0,0,0);

    // Procesa solo si la reserva es para hoy o mañana
    if (fechaReserva.getTime() === hoy.getTime() || fechaReserva.getTime() === manana.getTime()) {

      var celdaEstado = reservasSheet.getRange(i + 1, COLUMNA_CUPOS_Y_ESTADO + 1);
      var colorActual = celdaEstado.getBackground();

      var idReserva = fila[COLUMNA_ID];
      var totalCupos = fila[COLUMNA_CUPOS_Y_ESTADO];

      if (!totalCupos || isNaN(parseInt(totalCupos)) || totalCupos <= 0) {
        Logger.log('OMITIDO: ID ' + idReserva + ' no tiene un número válido de cupos.');
        continue;
      }

      // Si la reserva ya está marcada como COMPLETADA (verde), es el estado final. La ignoramos.
      if (colorActual === COLOR_COMPLETADO) {
        Logger.log('OMITIDO: ID ' + idReserva + ' ya está marcada como COMPLETADA (verde).');
        continue;
      }

      // ----- NUEVA LÓGICA DE ESTADOS -----

      // En cada ejecución, volvemos a contar las pólizas para saber el estado real.
      var polizasEnviadas = datosPoliza.filter(function(row) { return row[0] == idReserva; }).length;

      // PRIMERA GRAN CONDICIÓN: ¿La reserva ya está completa?
      if (polizasEnviadas >= totalCupos) {
        // Aseguramos VERDE.
        celdaEstado.setBackground(COLOR_COMPLETADO);
        Logger.log('COMPLETADO: ID ' + idReserva + ' tiene todas las pólizas (' + polizasEnviadas + '/' + totalCupos + '). Celda marcada/actualizada a VERDE.');

      } else {
        // SEGUNDA GRAN CONDICIÓN: AÚN INCOMPLETA.

        if (colorActual !== COLOR_ENVIADO) {
          // Enviar recordatorio (ManyChat)
          var numeroWhatsApp = formatearNumeroTelefonoSiete(fila[COLUMNA_WHATSAPP]);
          var numeroLimpio = String(numeroWhatsApp || '').replace(/[^0-9]/g, '');

          // De-dup: evitar múltiples envíos al mismo número en la misma corrida
          if (numerosProcesados.has(numeroLimpio)) {
            Logger.log('DUPLICADO_RUN: Ya se envió en esta ejecución a ' + numeroLimpio + '. Se omite fila con ID ' + idReserva);
            continue;
          }

          var nombre = fila[COLUMNA_NOMBRE];
          var exito = enviarMensajeActualizado(numeroLimpio, nombre, idReserva, polizasEnviadas); // firma intacta

          if (exito === true) {
            numerosProcesados.add(numeroLimpio);
            celdaEstado.setBackground(COLOR_ENVIADO); // CELESTE
            Logger.log('ÉXITO: Recordatorio enviado para ID ' + idReserva + ' (' + numeroLimpio + '). Celda marcada CELESTE.');
          } else {
            Logger.log('ERROR/OMITIDO: No se pudo enviar recordatorio para ID ' + idReserva + ' (' + numeroLimpio + ').');
          }
        } else {
          Logger.log('EN ESPERA: ID ' + idReserva + ' ya tiene un recordatorio enviado. Esperando datos faltantes.');
        }
      }
    }
  }
}

/**
 * Envía el mensaje de WhatsApp a través de ManyChat.
 * Firma intacta: (numero, nombre, id, conteo)
 * - Crea o encuentra el subscriber por whatsapp_phone.
 * - Setea variables para la plantilla: {{first_name}}, POLIZAS_ENVIADAS, ID_CABALGATA.
 * - Dispara el flow por flow_ns.
 */
function enviarMensajeActualizado(numero, nombre, id, conteo) {
  try {
    // Validaciones de config
    if (typeof MC_CONFIG === 'undefined' || !MC_CONFIG.API_BASE || !MC_CONFIG.API_TOKEN || !MC_CONFIG.ENDPOINTS) {
      Logger.log('MC_CONFIG no cargado o incompleto.');
      return false;
    }

    // Flow NS desde config externa (evita duplicados globales)
    var flowNs = (MC_CONFIG.FLOWS && MC_CONFIG.FLOWS.RECORDATORIO) ? MC_CONFIG.FLOWS.RECORDATORIO : 'content20250816200001_897557';
    if (!flowNs) {
      Logger.log('Falta flowNs para RECORDATORIO.');
      return false;
    }

    var headers = mcGetHeaders();

    // 1) Crear/obtener contacto por whatsapp_phone
    var primerNombre = (nombre && String(nombre).trim() !== '') ? String(nombre).split(' ')[0] : undefined;
    var createBody = { whatsapp_phone: numero };
    if (primerNombre) createBody.first_name = primerNombre;

    var resp = UrlFetchApp.fetch(MC_CONFIG.API_BASE + MC_CONFIG.ENDPOINTS.FIND_OR_CREATE, {
      method: 'post',
      headers: headers,
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify(createBody)
    });

    var code = resp.getResponseCode();
    var text = resp.getContentText() || '';
    Logger.log('[HTTP:createSubscriber] ' + code + ' body=' + text);

    var subscriberId = null;

    if (code >= 200 && code < 300) {
      var json = text ? JSON.parse(text) : {};
      subscriberId = (json && json.data && (json.data.id || json.data.subscriber_id)) || json.subscriber_id || null;

      // Aseguramos índice por CUF de teléfono si está configurado
      try {
        if (subscriberId && MC_CONFIG.CUF_PHONE_DIGITS_NAME) {
          mcSetFieldByNameSafe_(subscriberId, MC_CONFIG.CUF_PHONE_DIGITS_NAME, numero);
        }
      } catch (eIdx) {}

    } else if (code === 400 && /wa_id/i.test(text)) {
      // Ya existía: buscar por CUF índice si está configurado
      if (!MC_CONFIG.CUF_PHONE_DIGITS_ID) {
        Logger.log('CUF_PHONE_DIGITS_ID no definido. No puedo findByCustomField.');
        return false;
      }
      var urlFind = MC_CONFIG.API_BASE + MC_CONFIG.ENDPOINTS.FIND_BY_CUSTOM_FIELD +
        '?field_id=' + encodeURIComponent(MC_CONFIG.CUF_PHONE_DIGITS_ID) +
        '&field_value=' + encodeURIComponent(numero);

      var findResp = UrlFetchApp.fetch(urlFind, { method: 'get', headers: headers, muteHttpExceptions: true });
      var findCode = findResp.getResponseCode();
      var findText = findResp.getContentText() || '';
      Logger.log('[HTTP:findByCustomField] ' + findCode + ' body=' + findText);

      if (findCode >= 200 && findCode < 300) {
        var f = findText ? JSON.parse(findText) : {};
        var data = f && f.data;
        subscriberId = Array.isArray(data) ? (data[0] && (data[0].id || data[0].subscriber_id)) : (data && (data.id || data.subscriber_id));
      }
    } else {
      Logger.log('No se pudo crear/obtener el subscriber. HTTP ' + code + ': ' + text);
      return false;
    }

    if (!subscriberId) {
      Logger.log('No se obtuvo subscriber_id.');
      return false;
    }

    // 2) Forzar first_name de sistema si lo tenemos
    try {
      if (primerNombre && MC_CONFIG.ENDPOINTS.UPDATE_SUBSCRIBER) {
        mcUpdateSubscriberFirstName_(subscriberId, primerNombre);
      }
    } catch (eN) {}

    // 3) Setear CUFs usados por la plantilla con **tipo numérico**
    try {
      var ids = MC_CONFIG.CUF_IDS || {};
      var polizasNum = Number(conteo || 0);        // entero/float, no string
      var idCabalgataNum = Number(id || 0);        // entero/float, no string

      Logger.log('Set POLIZAS_ENVIADAS = ' + polizasNum + ' (' + typeof polizasNum + ')');
      mcSetFieldSafe_(subscriberId, ids.POLIZAS_ENVIADAS, 'POLIZAS_ENVIADAS', polizasNum);

      Logger.log('Set ID_CABALGATA = ' + idCabalgataNum + ' (' + typeof idCabalgataNum + ')');
      mcSetFieldSafe_(subscriberId, ids.ID_CABALGATA, 'ID_CABALGATA', idCabalgataNum);
    } catch (eSet) {
      Logger.log('Set CUFs EX: ' + eSet);
    }

    // 4) Pequeño delay para evitar condiciones de carrera antes de disparar el flow
    Utilities.sleep(400);

    // 5) Disparar el Flow (la plantilla tomará first_name + CUFs)
    var flowBody = { subscriber_id: subscriberId, flow_ns: flowNs };
    var respFlow = UrlFetchApp.fetch(MC_CONFIG.API_BASE + MC_CONFIG.ENDPOINTS.START_FLOW, {
      method: 'post',
      headers: headers,
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify(flowBody)
    });

    var codeFlow = respFlow.getResponseCode();
    var bodyFlow = respFlow.getContentText() || '';
    Logger.log('sendFlow -> ' + codeFlow + ': ' + bodyFlow);

    if (codeFlow >= 200 && codeFlow < 300) {
      var parsed = bodyFlow ? JSON.parse(bodyFlow) : {};
      if (!parsed.status || parsed.status === 'success') {
        return true;
      } else {
        Logger.log('sendFlow respondió sin success. status=' + parsed.status);
        return false;
      }
    }

    if (codeFlow === 400 && /Meta disabled the use of marketing templates/i.test(bodyFlow)) {
      Logger.log('Bloqueo Meta (posible plantilla Marketing en US). Considera Utility para +1.');
    }

    return false;

  } catch (error) {
    Logger.log('Excepción enviarMensajeActualizado: ' + error);
    return false;
  }
}

/**
 * Limpia y estandariza un número de teléfono.
 * (Se mantiene; usada antes de ManyChat igualmente)
 */
function formatearNumeroTelefonoSiete(numero) {
  var numeroFormateado = numero.toString().replace(/\s+/g, '').replace(/[\(\)\-]/g, '');
  if (numeroFormateado.length === 10) {
    numeroFormateado = '57' + numeroFormateado;
  }
  return numeroFormateado;
}

// ===== Helpers ManyChat =====
function mcGetHeaders() {
  return {
    'Authorization': 'Bearer ' + MC_CONFIG.API_TOKEN,
    'Content-Type': 'application/json'
  };
}

// Set de CUF por ID (preferido) o por nombre (fallback)
function mcSetFieldSafe_(subscriber_id, field_id, field_name, field_value) {
  if (!subscriber_id) return;
  var headers = mcGetHeaders();
  try {
    // Por ID
    if (field_id && MC_CONFIG.ENDPOINTS.SET_FIELD) {
      var res1 = UrlFetchApp.fetch(MC_CONFIG.API_BASE + MC_CONFIG.ENDPOINTS.SET_FIELD, {
        method: 'post',
        headers: headers,
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          subscriber_id: subscriber_id,
          field_id: field_id,
          field_value: field_value   // ← numérico si el CUF es numérico
        })
      });
      Logger.log('setCustomField(ID=' + field_id + ') -> ' + res1.getResponseCode() + ': ' + res1.getContentText());
      if (res1.getResponseCode() >= 200 && res1.getResponseCode() < 300) return;
    }
    // Por nombre exacto
    if (field_name && MC_CONFIG.ENDPOINTS.SET_FIELD_BY_NAME) {
      var res2 = UrlFetchApp.fetch(MC_CONFIG.API_BASE + MC_CONFIG.ENDPOINTS.SET_FIELD_BY_NAME, {
        method: 'post',
        headers: headers,
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({
          subscriber_id: subscriber_id,
          field_name: field_name,
          field_value: field_value   // ← numérico si el CUF es numérico
        })
      });
      Logger.log('setCustomFieldByName(' + field_name + ') -> ' + res2.getResponseCode() + ': ' + res2.getContentText());
    }
  } catch (e) {
    Logger.log('mcSetFieldSafe_ EX: ' + e);
  }
}

// Set por nombre (índice teléfono) — best-effort
function mcSetFieldByNameSafe_(subscriber_id, field_name, field_value) {
  if (!subscriber_id || !field_name) return;
  try {
    var res = UrlFetchApp.fetch(MC_CONFIG.API_BASE + MC_CONFIG.ENDPOINTS.SET_FIELD_BY_NAME, {
      method: 'post',
      headers: mcGetHeaders(),
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        subscriber_id: subscriber_id,
        field_name: field_name,
        field_value: field_value
      })
    });
    Logger.log('setCustomFieldByName(' + field_name + ') -> ' + res.getResponseCode() + ': ' + res.getContentText());
  } catch (e) {
    // Silencioso
  }
}

// Actualiza el first_name de sistema (si el endpoint está disponible en MC_CONFIG)
function mcUpdateSubscriberFirstName_(subscriber_id, first_name) {
  if (!subscriber_id || !first_name) return;
  try {
    var res = UrlFetchApp.fetch(MC_CONFIG.API_BASE + MC_CONFIG.ENDPOINTS.UPDATE_SUBSCRIBER, {
      method: 'post',
      headers: mcGetHeaders(),
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        subscriber_id: subscriber_id,
        first_name: first_name
      })
    });
    Logger.log('updateSubscriber(first_name) -> ' + res.getResponseCode() + ': ' + res.getContentText());
  } catch (e) {
    Logger.log('mcUpdateSubscriberFirstName_ EX: ' + e);
  }
}