// api/webhooks/mercado-pago.mjs
export const config = { runtime: 'nodejs18.x' };

async function readRawJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(200).send('ok');

    const body = await readRawJson(req);
    // MP manda dados em vários formatos; tentamos cobrir os comuns:
    const query = req.query || {};
    const topic = body.topic || body.type || query.topic || query.type || '';
    const dataId =
      body.data?.id ||
      body.resource?.id ||
      body.id ||
      query.id ||
      null;

    console.log('MP Webhook payload:', { topic, dataId, body });

    // Se quiser atualizar pedido: buscar detalhes no MP
    // (requer MP_ACCESS_TOKEN nas variáveis da Vercel)
    if (dataId && process.env.MP_ACCESS_TOKEN) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const payment = await r.json();
      console.log('MP payment detail:', payment);

      // TODO: aqui você cruza payment.external_reference ou description
      // com seu order.id e salva o novo status (approved, pending, rejected...)
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return res.status(500).json({ ok: false });
  }
}