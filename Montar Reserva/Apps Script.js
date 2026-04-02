// ===============================================================
//         API PARA FORMULARIO DE RESERVAS - CABALLOLOCO
// ===============================================================

// --- CONFIGURACIÓN FINAL ---
const SPREADSHEET_ID = '1b6c46IZTD24K9XDUEOeuZbTcZOFIUE_yNdKPaVUN5j4';
const SHEET_NAME = 'Reservas';
// --- FIN DE LA CONFIGURACIÓN ---

function doPost(e) {
  // Usamos LockService para evitar que dos reservas entren al milisegundo exacto y choquen
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

    // =======================================================
    //   CASO 1: SOLO PINTAR DE AMARILLO (Confirmación N8N)
    // =======================================================
    if (data.action === 'confirmar_color') {
      const filaAPintar = parseInt(data.row);
      // Validamos que sea un número válido para no dañar la hoja
      if (filaAPintar > 1) {
        // Pintamos la Columna D (índice 4) de Amarillo
        sheet.getRange(filaAPintar, 4).setBackground('#ffff00');
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'success', message: 'Celda pintada.' }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        throw new Error('Número de fila inválido');
      }
    }

    // =======================================================
    //   CASO 2: GUARDAR NUEVA RESERVA (Tu lógica original)
    // =======================================================
    
    const columnBValues = sheet.getRange("B:B").getValues();
    const firstEmptyRow = columnBValues.filter(String).length + 1;

    // ===== SOLUCIÓN DEFINITIVA PARA EL ERROR DE FECHA =====
    const dateParts = data.fecha.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const fechaObjeto = new Date(year, month, day);

    const valorReserva = Number(data.valor);

    // ===== PARSEO Y LIMPIEZA DEL NÚMERO DE TELÉFONO =====
    const telefonoLimpio = data.telefono.replace(/\D/g, ''); 

    // --- ESCRITURA DE DATOS ---
    sheet.getRange(firstEmptyRow, 2).setValue(fechaObjeto);          
    sheet.getRange(firstEmptyRow, 4).setValue(data.hora);             
    
    // CAMBIO IMPORTANTE: 
    // Antes pintabas amarillo aquí. Ahora pintamos BLANCO (pendiente) explícitamente.
    // El amarillo se pondrá solo si N8N responde éxito en el segundo paso.
    sheet.getRange(firstEmptyRow, 4).setBackground('#ffffff');        

    sheet.getRange(firstEmptyRow, 5).setValue(data.cliente);          
    sheet.getRange(firstEmptyRow, 7).setValue(Number(data.tour));     
    sheet.getRange(firstEmptyRow, 8).setValue(telefonoLimpio);        
    sheet.getRange(firstEmptyRow, 9).setValue(Number(data.caballos)); 
    sheet.getRange(firstEmptyRow, 12).setValue(valorReserva);         
    sheet.getRange(firstEmptyRow, 15).setValue(Number(data.adicionales) || 0); 
    sheet.getRange(firstEmptyRow, 18).setValue(Number(data.asados) || 0);    
    sheet.getRange(firstEmptyRow, 19).setValue(Number(data.licor) || 0);     
    sheet.getRange(firstEmptyRow, 20).setValue(Number(data.kits) || 0);      
    sheet.getRange(firstEmptyRow, 21).setValue(Number(data.transporte) || 0); 
    sheet.getRange(firstEmptyRow, 29).setValue(valorReserva);         

    SpreadsheetApp.flush();

    // Lógica de WhatsApp
    let telefonoParaWhatsapp = telefonoLimpio;
    if (telefonoParaWhatsapp.length === 10 && telefonoParaWhatsapp.startsWith('3')) {
      telefonoParaWhatsapp = '57' + telefonoParaWhatsapp;
    }

    const confirmacionTexto = sheet.getRange(firstEmptyRow, 31).getDisplayValue();
    
    const response = { 
      status: 'success', 
      message: 'Reserva guardada correctamente.',
      row: firstEmptyRow, // <--- CAMBIO: Devolvemos la fila para usarla después
      confirmationText: confirmacionTexto,
      whatsappNumber: telefonoParaWhatsapp
    };

    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    const errorResponse = { status: 'error', message: error.toString() };
    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    // Liberamos el cerrojo para permitir otras peticiones
    lock.releaseLock();
  }
}