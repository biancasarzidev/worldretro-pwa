// api/checkout.mjs
export const config = { runtime: 'nodejs18.x' };

function allowOrigin(req) {
  const ORIGINS = [
    'https://biancasarzidev.github.io',
    'https://worldretro-pwa.vercel.app',
  ];
  const o = req.headers?.origin || '';
  return ORIGINS.includes(o) ? o : ORIGINS[0];
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}

export default async function handler(req, res) {
  try {
    const origin = allowOrigin(req);
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, msg: 'Use POST com um order válido.' });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = await readJsonBody(req);
    const order = body?.order;
    if (!order || !Array.isArray(order.items)) {
      console.error('Payload inválido:', body);
      return res.status(400).json({ error: 'Invalid payload: order/items missing' });
    }

    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      console.error('Falta MP_ACCESS_TOKEN nas variáveis da Vercel');
      return res.status(500).json({ error: 'MP_ACCESS_TOKEN missing' });
    }

    // Ajuste aqui: garanta que FRONTEND_URL aponte para o caminho do app
    const FRONTEND_URL =
      (process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://biancasarzidev.github.io/worldretro-pwa');
    const API_BASE_URL =
      (process.env.API_BASE_URL?.replace(/\/$/, '') || 'https://worldretro-pwa.vercel.app');

    const preference = {
      items: order.items.map(i => ({
        title: i.name,
        quantity: Number(i.qty),
        currency_id: 'BRL',
        unit_price: Number(i.price),
      })),
      payer: { email: order?.customer?.email || 'comprador-teste@example.com' },
      back_urls: {
        success: `${FRONTEND_URL}/?status=approved&oid=${order.id}`,
        pending: `${FRONTEND_URL}/?status=pending&oid=${order.id}`,
        failure: `${FRONTEND_URL}/?status=failure&oid=${order.id}`,
      },
      auto_return: 'approved',
      notification_url: `${API_BASE_URL}/api/webhooks/mercado-pago`,
      external_reference: order.id,
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    });

    const data = await mpRes.json();
    if (!mpRes.ok || !data.init_point) {
      console.error('Erro do MP:', data);
      return res.status(400).json({ error: data.message || 'MP error', details: data });
    }

    return res.status(200).json({ id: data.id, init_point: data.init_point });
  } catch (err) {
    console.error('Checkout crash:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
