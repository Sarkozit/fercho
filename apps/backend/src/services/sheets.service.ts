/**
 * Google Sheets API service — replaces the Web App approach.
 * 
 * Uses a Service Account for authentication.
 * Reads directly from the spreadsheet via the Sheets API v4.
 * 
 * Required env vars:
 *   GOOGLE_SHEETS_ID                — Spreadsheet ID
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL    — Service Account email
 *   GOOGLE_PRIVATE_KEY              — Private key from the JSON credentials (with \n)
 */

import { sheets as sheetsApi } from '@googleapis/sheets';
import { JWT } from 'google-auth-library';

// ── Cache ──
let sheetsCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// ── Auth ──
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error(
      'Google Sheets API no configurada. Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL y/o GOOGLE_PRIVATE_KEY en .env'
    );
  }

  return new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// ── Date/Time helpers ──

function parseDate(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Date serial number from Sheets (days since 1899-12-30)
  if (/^\d+$/.test(str)) {
    const serial = parseInt(str);
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + serial);
    return formatDateObj(epoch);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return formatDateObj(d);
  return str;
}

function formatDateObj(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseTime(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (/^\d{1,2}:\d{2}$/.test(str)) return str;
  const m = str.match(/(\d{1,2}):(\d{2}):\d{2}/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  // Fractional day (e.g., 0.5625 = 13:30)
  const num = parseFloat(str);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const min = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  return str;
}

function parseNumber(raw: any): number {
  if (raw === '' || raw === null || raw === undefined) return 0;
  const n = Number(raw);
  return isNaN(n) ? 0 : n;
}

function todayStr(): string {
  const d = new Date();
  return formatDateObj(d);
}

// ── Main fetch ──

export async function fetchFromSheetsAPI() {
  // Check cache
  if (sheetsCache && Date.now() - sheetsCache.timestamp < CACHE_TTL) {
    return sheetsCache.data;
  }

  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEETS_ID no configurado en .env');

  const auth = getAuth();
  const client = sheetsApi({ version: 'v4', auth });

  // Fetch both sheets in parallel
  const [reservasRes, polizasRes] = await Promise.all([
    client.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Reservas!A:AD',
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    }),
    client.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Póliza!A:P',
      valueRenderOption: 'FORMATTED_VALUE',
    }),
  ]);

  const reservasRows = reservasRes.data.values || [];
  const polizasRows = polizasRes.data.values || [];

  const today = todayStr();

  // ── Parse Reservas (skip header row) ──
  const reservas: any[] = [];
  const idsHoy = new Set<string>();

  for (let i = 1; i < reservasRows.length; i++) {
    const row = reservasRows[i];
    if (!row[0] || row[0] === '') continue;

    const fecha = parseDate(row[1]);
    if (fecha && fecha < today) continue;

    const resId = String(row[0]);
    idsHoy.add(resId);

    reservas.push({
      id: resId,
      fecha,
      horaSalida: parseTime(row[3]),         // D
      nombre: String(row[4] || ''),          // E
      horasCabalgata: parseNumber(row[6]),    // G
      telefono: String(row[7] || ''),        // H
      caballos: parseNumber(row[8]),          // I
      asignacion: String(row[9] || ''),      // J
      asados: parseNumber(row[17]),           // R
      mediasLicor: parseNumber(row[18]),      // S
      ponchoSombrero: String(row[19] || ''), // T
      transporte: String(row[20] || ''),     // U
      total: parseNumber(row[27]),            // AB
      adelanto: parseNumber(row[28]),         // AC
      saldoPendiente: parseNumber(row[29]),   // AD
    });
  }

  // ── Parse Pólizas ──
  const polizas: any[] = [];

  for (let j = 1; j < polizasRows.length; j++) {
    const pRow = polizasRows[j];
    if (!pRow[5] || pRow[5] === '') continue;

    const idCabalgata = String(pRow[5]);
    if (!idsHoy.has(idCabalgata)) continue;

    polizas.push({
      timestamp: String(pRow[0] || ''),
      identificacion: String(pRow[1] || ''),
      nombre: String(pRow[2] || ''),
      apellido: String(pRow[3] || ''),
      idCabalgata,
      fechaCabalgata: String(pRow[8] || ''),
      horaCabalgata: String(pRow[9] || ''),
      estado: String(pRow[15] || ''),
    });
  }

  const result = {
    reservas,
    polizas,
    totalReservasFiltradas: reservas.length,
    totalPolizasFiltradas: polizas.length,
    filtradoDesde: today,
    fetchedAt: new Date().toISOString(),
  };

  sheetsCache = { data: result, timestamp: Date.now() };
  return result;
}

export function invalidateCache() {
  sheetsCache = null;
}

// ── Write: Append a new reservation ──

export interface ReservationInput {
  fecha: string;       // YYYY-MM-DD
  hora: string;        // HH:MM
  cliente: string;
  tour: number;        // 1, 2, or 4
  telefono: string;
  caballos: number;
  valor: number;       // adelanto
  adicionales: number;
  asados: number;
  licor: number;
  kits: number;
  transporte: number;
}

export async function appendReservation(input: ReservationInput) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEETS_ID no configurado en .env');

  const auth = getAuth();
  const client = sheetsApi({ version: 'v4', auth });

  // 1. Find first empty row (check column B)
  const colBRes = await client.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Reservas!B:B',
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const colBValues = colBRes.data.values || [];
  const firstEmptyRow = colBValues.length + 1;

  // 2. Parse date → serial or Date string for Sheets
  const [year, month, day] = input.fecha.split('-').map(Number);
  // Sheets accepts date as string "YYYY-MM-DD" in FORMATTED_VALUE mode
  const fechaStr = input.fecha;

  // 3. Clean phone number
  const telefonoLimpio = input.telefono.replace(/\D/g, '');

  // 4. Build the row data — columns A through AD (30 columns)
  //    We write to specific columns matching the Apps Script mapping:
  //    B(2)=fecha, D(4)=hora, E(5)=cliente, G(7)=tour, H(8)=telefono,
  //    I(9)=caballos, L(12)=valor, O(15)=adicionales, R(18)=asados,
  //    S(19)=licor, T(20)=kits, U(21)=transporte, AC(29)=adelanto
  const updates = [
    { range: `Reservas!B${firstEmptyRow}`, values: [[fechaStr]] },
    { range: `Reservas!D${firstEmptyRow}`, values: [[input.hora]] },
    { range: `Reservas!E${firstEmptyRow}`, values: [[input.cliente]] },
    { range: `Reservas!G${firstEmptyRow}`, values: [[input.tour]] },
    { range: `Reservas!H${firstEmptyRow}`, values: [[telefonoLimpio]] },
    { range: `Reservas!I${firstEmptyRow}`, values: [[input.caballos]] },
    { range: `Reservas!L${firstEmptyRow}`, values: [[input.valor]] },
    { range: `Reservas!O${firstEmptyRow}`, values: [[input.adicionales || 0]] },
    { range: `Reservas!R${firstEmptyRow}`, values: [[input.asados || 0]] },
    { range: `Reservas!S${firstEmptyRow}`, values: [[input.licor || 0]] },
    { range: `Reservas!T${firstEmptyRow}`, values: [[input.kits || 0]] },
    { range: `Reservas!U${firstEmptyRow}`, values: [[input.transporte || 0]] },
    { range: `Reservas!AC${firstEmptyRow}`, values: [[input.valor]] },
  ];

  // 5. Batch update all cells
  await client.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates,
    },
  });

  // 6. Read confirmation text from column AE (31)
  let confirmationText = '';
  try {
    // Small delay for Sheets formula recalculation
    await new Promise(r => setTimeout(r, 1500));
    const confirmRes = await client.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `Reservas!AE${firstEmptyRow}`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    confirmationText = confirmRes.data.values?.[0]?.[0] || '';
  } catch {
    // If column AE doesn't exist or has no formula, that's fine
  }

  // 7. WhatsApp number formatting
  let whatsappNumber = telefonoLimpio;
  if (whatsappNumber.length === 10 && whatsappNumber.startsWith('3')) {
    whatsappNumber = '57' + whatsappNumber;
  }

  // 8. Invalidate cache so the new reservation shows immediately
  invalidateCache();

  return {
    row: firstEmptyRow,
    confirmationText,
    whatsappNumber,
  };
}

// ── Paint cell yellow (confirmation) ──
export async function paintCellYellow(row: number) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) return;

  const auth = getAuth();
  const client = sheetsApi({ version: 'v4', auth });

  // Get the sheet's numeric ID (gid)
  const spreadsheet = await client.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: 'sheets.properties',
  });
  const reservasSheet = spreadsheet.data.sheets?.find(
    (s: any) => s.properties?.title === 'Reservas'
  );
  const sheetGid = reservasSheet?.properties?.sheetId ?? 0;

  // Paint column D (index 3) yellow
  await client.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{
        updateCells: {
          range: {
            sheetId: sheetGid,
            startRowIndex: row - 1,
            endRowIndex: row,
            startColumnIndex: 3,
            endColumnIndex: 4,
          },
          rows: [{
            values: [{
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 1, blue: 0 },
              },
            }],
          }],
          fields: 'userEnteredFormat.backgroundColor',
        },
      }],
    },
  });
}
