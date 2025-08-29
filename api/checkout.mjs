// api/checkout.mjs
export default async function handler(req, res) {
  // --- CORS (permite chamada a partir do GitHub Pages) ---
  const ALLOWED_ORIGINS = [
    'https://biancasarzidev.github.io',           // seu GitHub Pages
    'https://worldretro-pwa.vercel.app'           // seu backend na Vercel
  ];
  const origin = req.headers.origin || '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ error: 'MP_ACCESS_TOKEN missing' });

    const FRONTEND_URL =
      process.env.FRONTEND_URL || 'https://biancasarzidev.github.io/worldretro-pwa';
    const API_BASE_URL =
      process.env.API_BASE_URL || 'https://worldretro-pwa.vercel.app';

    const { order } = req.body || {};
    if (!order || !Array.isArray(order.items)) {
      return res.status(400).json({ error: 'Invalid payload: order/items missing' });
    }

    // Monta preferência pro Mercado Pago
    const preference = {
      items: order.items.map((i) => ({
        title: i.name,
        quantity: Number(i.qty),
        currency_id: 'BRL',
        unit_price: Number(i.price)
      })),
      payer: {
        email: order?.customer?.email || 'comprador-teste@example.com'
      },
      back_urls: {
        success: `${FRONTEND_URL}/?status=approved&oid=${order.id}`,
        pending: `${FRONTEND_URL}/?status=pending&oid=${order.id}`,
        failure: `${FRONTEND_URL}/?status=failure&oid=${order.id}`
      },
      auto_return: 'approved',
      notification_url: `${API_BASE_URL}/api/webhooks/mercado-pago`
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const data = await mpRes.json();
    if (!mpRes.ok || !data.init_point) {
      return res.status(400).json({ error: data.message || 'MP error', details: data });
    }

    return res.status(200).json({ id: data.id, init_point: data.init_point });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
