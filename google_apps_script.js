/**
 * ===================================================
 * FERCHO POS — Google Apps Script Web App
 * ===================================================
 * 
 * Este script convierte tu Google Sheet en una API JSON
 * que el POS consume para mostrar las reservas.
 * 
 * OPTIMIZACIÓN: Solo devuelve reservas de HOY en adelante
 * y las pólizas asociadas a esas reservas.
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 
 * 1. Abre tu Google Sheet de reservas
 * 2. Ve a Extensiones > Apps Script
 * 3. Borra todo el código que haya y pega este archivo completo
 * 4. Haz clic en el botón "Implementar" (Deploy) > "Nueva implementación"
 * 5. Tipo: "Aplicación web" (Web App)
 * 6. Ejecutar como: "Yo" (Me)
 * 7. Quién tiene acceso: "Cualquiera" (Anyone)
 * 8. Haz clic en "Implementar"
 * 9. Copia la URL que te da y pégala en el archivo .env del backend:
 *    GOOGLE_SHEETS_WEB_APP_URL="https://script.google.com/macros/s/xxxxx/exec"
 * 
 * IMPORTANTE: Cada vez que modifiques este script, debes crear
 * una nueva implementación para que los cambios surtan efecto.
 * ===================================================
 */

function doGet(e) {
  try {
    // Intentar obtener el spreadsheet:
    // 1. Si el script está dentro del Sheet (bound), usar getActiveSpreadsheet()
    // 2. Si se pasa un parámetro ?sheetId=xxx, usar openById()
    var ss;
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {
      // Script no está bound a un spreadsheet
      ss = null;
    }
    
    if (!ss && e && e.parameter && e.parameter.sheetId) {
      ss = SpreadsheetApp.openById(e.parameter.sheetId);
    }
    
    if (!ss) {
      return ContentService
        .createTextOutput(JSON.stringify({ 
          error: 'No se pudo acceder al Spreadsheet. Si el script no está dentro del Sheet, agrega ?sheetId=TU_ID_DEL_SHEET a la URL.',
          hint: 'El ID del Sheet está en la URL de Google Sheets: https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // ── Fecha de hoy a medianoche (para filtrar) ──
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // ── Leer hoja "Reservas" — SOLO hoy en adelante ──
    var reservasSheet = ss.getSheetByName('Reservas');
    var reservas = [];
    var idsReservasHoy = {};  // Para filtrar pólizas después
    
    if (reservasSheet) {
      var reservasData = reservasSheet.getDataRange().getValues();
      
      // Saltar la primera fila (headers)
      for (var i = 1; i < reservasData.length; i++) {
        var row = reservasData[i];
        
        // Saltar filas vacías (sin ID)
        if (!row[0] || row[0] === '') continue;
        
        // ── FILTRO: Solo reservas de hoy en adelante ──
        var fechaReserva = row[1];
        if (fechaReserva instanceof Date) {
          var fechaSinHora = new Date(fechaReserva);
          fechaSinHora.setHours(0, 0, 0, 0);
          if (fechaSinHora < hoy) continue;  // Reserva pasada, saltar
        } else if (fechaReserva) {
          // Si es string, intentar parsear
          var parsed = new Date(fechaReserva);
          if (!isNaN(parsed.getTime())) {
            parsed.setHours(0, 0, 0, 0);
            if (parsed < hoy) continue;
          }
        } else {
          // Sin fecha, saltar
          continue;
        }
        
        var resId = String(row[0]);
        idsReservasHoy[resId] = true;  // Guardar ID para filtrar pólizas
        
        var reserva = {
          id:               resId,                               // A: Id de reserva
          fecha:            formatDate(row[1]),                 // B: Fecha de la reserva
          horaSalida:       formatTime(row[3]),                 // D: Hora de salida
          nombre:           String(row[4] || ''),              // E: Nombre del cliente
          horasCabalgata:   parseNumber(row[6]),                // G: Número de horas
          telefono:         String(row[7] || ''),              // H: Teléfono
          caballos:         parseNumber(row[8]),                // I: Número de caballos
          asignacion:       String(row[9] || ''),              // J: Asignación de proveedores
          asados:           parseNumber(row[17]),               // R: Cantidad de asados
          mediasLicor:      parseNumber(row[18]),               // S: Medias de licor
          ponchoSombrero:   String(row[19] || ''),             // T: Poncho y Sombrero
          transporte:       String(row[20] || ''),             // U: Transporte
          total:            parseNumber(row[27]),               // AB: Total de la cuenta
          adelanto:         parseNumber(row[28]),               // AC: Adelanto
          saldoPendiente:   parseNumber(row[29])                // AD: Saldo pendiente
        };
        
        reservas.push(reserva);
      }
    }
    
    // ── Leer hoja "Póliza" — SOLO las de reservas filtradas ──
    var polizaSheet = ss.getSheetByName('Póliza');
    var polizas = [];
    
    if (polizaSheet) {
      var polizaData = polizaSheet.getDataRange().getValues();
      
      // Saltar la primera fila (headers)
      for (var j = 1; j < polizaData.length; j++) {
        var pRow = polizaData[j];
        
        // Saltar filas vacías
        if (!pRow[5] || pRow[5] === '') continue;
        
        var idCabalgata = String(pRow[5]);
        
        // ── FILTRO: Solo pólizas de reservas de hoy en adelante ──
        if (!idsReservasHoy[idCabalgata]) continue;
        
        var poliza = {
          timestamp:        formatTimestamp(pRow[0]),           // A: Timestamp
          identificacion:   String(pRow[1] || ''),             // B: Identificación
          nombre:           String(pRow[2] || ''),             // C: Nombre
          apellido:         String(pRow[3] || ''),             // D: Apellido
          idCabalgata:      idCabalgata,                        // F: ID de la cabalgata
          fechaCabalgata:   formatDate(pRow[8]),                // I: Fecha de la cabalgata
          horaCabalgata:    formatTime(pRow[9]),                // J: Hora de la cabalgata
          estado:           String(pRow[15] || '')              // P: Estado (Activada/Desactivada)
        };
        
        polizas.push(poliza);
      }
    }
    
    var result = {
      reservas: reservas,
      polizas: polizas,
      totalReservasFiltradas: reservas.length,
      totalPolizasFiltradas: polizas.length,
      filtradoDesde: formatDate(hoy),
      fetchedAt: new Date().toISOString()
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Utilidades de formateo ──

/**
 * Convierte un valor de fecha de Sheets a string YYYY-MM-DD
 */
function formatDate(value) {
  if (!value) return '';
  
  // Si es un objeto Date de JavaScript
  if (value instanceof Date) {
    var y = value.getFullYear();
    var m = String(value.getMonth() + 1).padStart(2, '0');
    var d = String(value.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  
  // Si es un string, intentar parsearlo
  return String(value);
}

/**
 * Convierte un valor de hora de Sheets a string HH:MM
 * Google Sheets almacena las horas como Date con fecha 1899-12-30
 */
function formatTime(value) {
  if (!value) return '';
  
  if (value instanceof Date) {
    var h = String(value.getHours()).padStart(2, '0');
    var m = String(value.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }
  
  // Si ya es string (ej: "11:00 AM"), devolverlo tal cual
  return String(value);
}

/**
 * Convierte un timestamp completo a ISO string
 */
function formatTimestamp(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Parsea un número, devuelve 0 si no es válido
 */
function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  var num = Number(value);
  return isNaN(num) ? 0 : num;
}
