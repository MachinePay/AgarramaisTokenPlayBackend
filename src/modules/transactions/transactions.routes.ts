import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  checkoutPackage,
  confirmTransaction,
  failTransaction,
  getUserTransaction,
  handleMercadoPagoPaymentUpdate,
  listAdminTransactions,
  listUserTransactions,
} from "./transactions.service";

const checkoutBodySchema = z.object({
  packageId: z.string().uuid(),
});

const transactionParamsSchema = z.object({ id: z.string().uuid() });

const mercadoPagoWebhookQuerySchema = z.object({
  topic: z.string().optional(),
  id: z.string().optional(),
});

const mercadoPagoWebhookBodySchema = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
});

export async function transactionsRoutes(app: FastifyInstance) {
  app.post("/transactions/checkout", { onRequest: [app.authenticate] }, async (request, reply) => {
    const { packageId } = checkoutBodySchema.parse(request.body);
    const transaction = await checkoutPackage(request.user.sub, packageId);
    return reply.status(201).send(transaction);
  });

  app.get("/transactions", { onRequest: [app.authenticate] }, async (request, reply) => {
    const transactions = await listUserTransactions(request.user.sub);
    return reply.status(200).send(transactions);
  });

  app.get("/admin/transactions", { onRequest: [app.requireAdmin] }, async (_request, reply) => {
    const transactions = await listAdminTransactions();
    return reply.status(200).send(transactions);
  });

  // Usado pelo frontend para dar polling apos o redirect de volta do checkout.
  app.get("/transactions/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    const { id } = transactionParamsSchema.parse(request.params);
    const transaction = await getUserTransaction(request.user.sub, id);
    return reply.status(200).send(transaction);
  });

  // Webhook publico do Mercado Pago (sem autenticacao - eles chamam direto).
  // Responde 200 de imediato e processa em background, como recomendado pelo
  // Mercado Pago, para evitar timeout/retentativas desnecessarias.
  app.post("/webhooks/mercadopago", async (request, reply) => {
    const query = mercadoPagoWebhookQuerySchema.parse(request.query);
    const body = mercadoPagoWebhookBodySchema.parse(request.body ?? {});

    const topic = query.topic || body.type || "";
    const paymentId = query.id || (body.data?.id ? String(body.data.id) : undefined);

    reply.status(200).send({ received: true });

    if (!paymentId || !topic.includes("payment")) return;

    handleMercadoPagoPaymentUpdate(paymentId).catch((error) => {
      app.log.error(error, "Falha ao processar webhook do Mercado Pago");
    });
  });

  // Fallback manual (admin/testes) - so necessario quando MP_MOCK=true, ja
  // que nesse modo nenhum webhook real chega.
  app.post(
    "/admin/transactions/:id/confirm",
    { onRequest: [app.requireAdmin] },
    async (request, reply) => {
      const { id } = transactionParamsSchema.parse(request.params);
      const result = await confirmTransaction(id);
      return reply.status(200).send(result);
    },
  );

  app.post(
    "/admin/transactions/:id/fail",
    { onRequest: [app.requireAdmin] },
    async (request, reply) => {
      const { id } = transactionParamsSchema.parse(request.params);
      const result = await failTransaction(id);
      return reply.status(200).send(result);
    },
  );
}
