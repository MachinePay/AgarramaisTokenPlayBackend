import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPackage, listActivePackages, listAllPackages, updatePackage } from "./packages.service";

const packageBodySchema = z.object({
  name: z.string().min(2),
  amountBrl: z.number().positive(),
  baseCredits: z.number().int().positive(),
  bonusCredits: z.number().int().nonnegative().default(0),
  isPopular: z.boolean().default(false),
  active: z.boolean().default(true),
});

const packageUpdateBodySchema = packageBodySchema.partial();
const packageParamsSchema = z.object({ id: z.string().uuid() });

export async function packagesRoutes(app: FastifyInstance) {
  // Vitrine de recarga do cliente: so pacotes ativos.
  app.get("/packages", async (_request, reply) => {
    const packages = await listActivePackages();
    return reply.status(200).send(packages);
  });

  app.get("/admin/packages", { onRequest: [app.requireAdmin] }, async (_request, reply) => {
    const packages = await listAllPackages();
    return reply.status(200).send(packages);
  });

  app.post("/admin/packages", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const body = packageBodySchema.parse(request.body);
    const created = await createPackage(body);
    return reply.status(201).send(created);
  });

  app.put("/admin/packages/:id", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const { id } = packageParamsSchema.parse(request.params);
    const body = packageUpdateBodySchema.parse(request.body);
    const updated = await updatePackage(id, body);
    return reply.status(200).send(updated);
  });
}
