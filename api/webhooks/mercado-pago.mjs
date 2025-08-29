// api/webhooks/mercado-pago.mjs
import mercadopago from "mercadopago";

export const config = {
  api: { bodyParser: false } // MP envia x-www-form-urlencoded às vezes
};

function readBody(req){
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
}

export default async function handler(req, res) {
  try {
    mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });

    const url = new URL(req.url, "http://localhost");
    const type = url.searchParams.get("type") || url.searchParams.get("topic");
    const id = url.searchParams.get("data.id") || url.searchParams.get("id");

    // Ping inicial
    if (!type) return res.status(200).end("ok");

    if (type === "payment" && id) {
      const payment = await mercadopago.payment.findById(id);
      const status = payment.body.status; // approved, pending, rejected
      const external_reference = payment.body.external_reference;

      // TODO: persistir no seu DB (Supabase/Firestore) -> status do pedido = status
      console.log("WEBHOOK MP:", external_reference, status);

      return res.status(200).end("processed");
    }

    return res.status(200).end("ok");
  } catch (e) {
    console.error("webhook error:", e);
    return res.status(500).end("err");
  }
}
