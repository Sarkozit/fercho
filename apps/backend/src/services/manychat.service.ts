/**
 * ManyChat API Service
 * Sends WhatsApp messages via ManyChat flows (recordatorio de póliza).
 */

const MC_API_BASE = 'https://api.manychat.com/fb';

function getToken(): string {
  const token = process.env.MANYCHAT_API_TOKEN;
  if (!token) throw new Error('MANYCHAT_API_TOKEN no configurado en .env');
  return token;
}

function headers() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

// ── ManyChat Config ──
// Flow namespace for póliza reminder
const FLOW_RECORDATORIO = 'content20250816200001_897557';

// Custom User Field IDs (from ManyChat → Settings → Fields)
// TODO: Replace with actual IDs from user
const CUF_IDS = {
  POLIZAS_ENVIADAS: 13474480,
  ID_CABALGATA: 13474482,
  PHONE_DIGITS: 13476404,
};

// ── API Functions ──

/** Create or find subscriber by WhatsApp phone */
async function findOrCreateSubscriber(phone: string, firstName?: string): Promise<string | null> {
  const body: any = { whatsapp_phone: phone };
  if (firstName) body.first_name = firstName;

  const res = await fetch(`${MC_API_BASE}/subscriber/findOrCreate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (res.ok && data?.data) {
    return data.data.id || data.data.subscriber_id || null;
  }

  // If subscriber already exists (400 with wa_id error), try find by custom field
  if (res.status === 400 && CUF_IDS.PHONE_DIGITS) {
    return findByPhoneField(phone);
  }

  console.error('ManyChat findOrCreate failed:', res.status, data);
  return null;
}

/** Find subscriber by phone custom field */
async function findByPhoneField(phone: string): Promise<string | null> {
  if (!CUF_IDS.PHONE_DIGITS) return null;
  
  const url = `${MC_API_BASE}/subscriber/findByCustomField?field_id=${CUF_IDS.PHONE_DIGITS}&field_value=${phone}`;
  const res = await fetch(url, { method: 'GET', headers: headers() });
  const data = await res.json();

  if (res.ok && data?.data) {
    const arr = Array.isArray(data.data) ? data.data : [data.data];
    return arr[0]?.id || arr[0]?.subscriber_id || null;
  }
  return null;
}

/** Set a custom user field value */
async function setCustomField(subscriberId: string, fieldId: number, value: number | string): Promise<boolean> {
  if (!fieldId) return true; // Skip if no field ID configured

  const res = await fetch(`${MC_API_BASE}/subscriber/setCustomField`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      subscriber_id: subscriberId,
      field_id: fieldId,
      field_value: value,
    }),
  });

  return res.ok;
}

/** Send (trigger) a flow to a subscriber */
async function sendFlow(subscriberId: string, flowNs: string): Promise<boolean> {
  const res = await fetch(`${MC_API_BASE}/sending/sendFlow`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      subscriber_id: subscriberId,
      flow_ns: flowNs,
    }),
  });

  const data = await res.json();
  return res.ok && (!data.status || data.status === 'success');
}

// ── Main: Send Póliza Reminder ──

export interface PolizaReminderInput {
  phone: string;       // 10 or 12 digit Colombian number
  nombre: string;      // Client's full name
  reservaId: string;   // Reservation ID (column A in Sheets)
  polizasEnviadas: number;  // How many pólizas already sent
}

export async function sendPolizaReminder(input: PolizaReminderInput): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Format phone
    let phone = input.phone.replace(/\D/g, '');
    if (phone.length === 10 && phone.startsWith('3')) {
      phone = '57' + phone;
    }

    // 2. Get first name
    const firstName = input.nombre?.split(' ')[0] || undefined;

    // 3. Find or create subscriber
    const subscriberId = await findOrCreateSubscriber(phone, firstName);
    if (!subscriberId) {
      return { success: false, error: 'No se pudo crear/encontrar el contacto en ManyChat' };
    }

    // 4. Set custom fields
    await setCustomField(subscriberId, CUF_IDS.POLIZAS_ENVIADAS, input.polizasEnviadas);
    await setCustomField(subscriberId, CUF_IDS.ID_CABALGATA, Number(input.reservaId) || 0);

    // 5. Small delay to avoid race conditions
    await new Promise(r => setTimeout(r, 400));

    // 6. Trigger the reminder flow
    const sent = await sendFlow(subscriberId, FLOW_RECORDATORIO);
    if (!sent) {
      return { success: false, error: 'ManyChat no pudo enviar el flow' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('sendPolizaReminder error:', err);
    return { success: false, error: err.message };
  }
}
