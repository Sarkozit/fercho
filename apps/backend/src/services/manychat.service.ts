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

function getHeaders() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

/** Safe JSON parse — returns null if response is not valid JSON */
async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── ManyChat Config ──
const FLOW_RECORDATORIO = 'content20250816200001_897557';

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

  console.log('[ManyChat] findOrCreate phone:', phone, 'name:', firstName);

  const res = await fetch(`${MC_API_BASE}/subscriber/findOrCreate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await safeJson(res);
  console.log('[ManyChat] findOrCreate response:', res.status, JSON.stringify(data));

  if (res.ok && data?.data) {
    return data.data.id || data.data.subscriber_id || null;
  }

  // If subscriber already exists (400 with wa_id error), try find by custom field
  if (res.status === 400 && CUF_IDS.PHONE_DIGITS) {
    console.log('[ManyChat] Subscriber exists, trying findByCustomField...');
    return findByPhoneField(phone);
  }

  console.error('[ManyChat] findOrCreate failed:', res.status, data);
  return null;
}

/** Find subscriber by phone custom field */
async function findByPhoneField(phone: string): Promise<string | null> {
  if (!CUF_IDS.PHONE_DIGITS) return null;
  
  const url = `${MC_API_BASE}/subscriber/findByCustomField?field_id=${CUF_IDS.PHONE_DIGITS}&field_value=${phone}`;
  const res = await fetch(url, { method: 'GET', headers: getHeaders() });
  const data = await safeJson(res);
  console.log('[ManyChat] findByCustomField response:', res.status, JSON.stringify(data));

  if (res.ok && data?.data) {
    const arr = Array.isArray(data.data) ? data.data : [data.data];
    return arr[0]?.id || arr[0]?.subscriber_id || null;
  }
  return null;
}

/** Set a custom user field value */
async function setCustomField(subscriberId: string, fieldId: number, value: number | string): Promise<boolean> {
  if (!fieldId) return true;

  const res = await fetch(`${MC_API_BASE}/subscriber/setCustomField`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      subscriber_id: subscriberId,
      field_id: fieldId,
      field_value: value,
    }),
  });

  const ok = res.ok;
  if (!ok) {
    const data = await safeJson(res);
    console.error('[ManyChat] setCustomField failed:', res.status, data);
  }
  return ok;
}

/** Send (trigger) a flow to a subscriber */
async function sendFlow(subscriberId: string, flowNs: string): Promise<boolean> {
  const res = await fetch(`${MC_API_BASE}/sending/sendFlow`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      subscriber_id: subscriberId,
      flow_ns: flowNs,
    }),
  });

  const data = await safeJson(res);
  console.log('[ManyChat] sendFlow response:', res.status, JSON.stringify(data));
  return res.ok && (!data?.status || data.status === 'success');
}

// ── Main: Send Póliza Reminder ──

export interface PolizaReminderInput {
  phone: string;
  nombre: string;
  reservaId: string;
  polizasEnviadas: number;
}

export async function sendPolizaReminder(input: PolizaReminderInput): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Validate token is configured
    getToken(); // throws if not set

    // 2. Format phone
    let phone = input.phone.replace(/\D/g, '');
    if (phone.length === 10 && phone.startsWith('3')) {
      phone = '57' + phone;
    }
    if (phone.length < 10) {
      return { success: false, error: `Número de teléfono inválido: ${input.phone}` };
    }

    console.log('[ManyChat] Starting póliza reminder for:', input.nombre, 'phone:', phone);

    // 3. Get first name
    const firstName = input.nombre?.split(' ')[0] || undefined;

    // 4. Find or create subscriber
    const subscriberId = await findOrCreateSubscriber(phone, firstName);
    if (!subscriberId) {
      return { success: false, error: 'No se pudo crear/encontrar el contacto en ManyChat' };
    }

    console.log('[ManyChat] Subscriber ID:', subscriberId);

    // 5. Set custom fields
    await setCustomField(subscriberId, CUF_IDS.POLIZAS_ENVIADAS, input.polizasEnviadas);
    await setCustomField(subscriberId, CUF_IDS.ID_CABALGATA, Number(input.reservaId) || 0);

    // 6. Small delay to avoid race conditions
    await new Promise(r => setTimeout(r, 400));

    // 7. Trigger the reminder flow
    const sent = await sendFlow(subscriberId, FLOW_RECORDATORIO);
    if (!sent) {
      return { success: false, error: 'ManyChat no pudo enviar el flow' };
    }

    console.log('[ManyChat] ✅ Póliza reminder sent successfully');
    return { success: true };
  } catch (err: any) {
    console.error('[ManyChat] sendPolizaReminder error:', err);
    return { success: false, error: err.message || 'Error desconocido' };
  }
}
