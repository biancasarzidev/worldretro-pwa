// api/checkout.mjs
import mercadopago from "mercadopago";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { order } = req.body || {};
    if (!order || !order.items?.length) {
      return res.status(400).json({ error: "Order inválido" });
    }

    // Configura credencial secreta
    mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });

    // Monta itens em formato MP
    const items = order.items.map((it) => ({
      id: String(it.id || it.sku || Date.now()),
      title: String(it.name || "Produto"),
      quantity: Number(it.qty || 1),
      currency_id: "BRL",
      unit_price: Number(it.price || 0)
    }));

    // URL do seu site (ajuste se usar domínio próprio)
    const BASE_URL = process.env.PUBLIC_BASE_URL || "https://<seu-usuario>.github.io/<seu-repo>";

    const preference = {
      items,
      payer: {
        name: order.customer?.nome,
        email: order.customer?.email
      },
      back_urls: {
        success: `${BASE_URL}/?status=approved&oid=${order.id}`,
        failure: `${BASE_URL}/?status=failure&oid=${order.id}`,
        pending: `${BASE_URL}/?status=pending&oid=${order.id}`
      },
      auto_return: "approved",
      notification_url: `${BASE_URL}/api/webhooks/mercado-pago`, // se usar domínio próprio em Vercel, troque pelo domínio de produção
      metadata: { oid: order.id },
      statement_descriptor: "WORLD RETRO",
      external_reference: order.id
    };

    const mpRes = await mercadopago.preferences.create(preference);
    return res.status(200).json({ init_point: mpRes.body.init_point, id: order.id });
  } catch (err) {
    console.error("checkout error:", err);
    return res.status(500).json({ error: "Falha ao criar preferência" });
  }
}
