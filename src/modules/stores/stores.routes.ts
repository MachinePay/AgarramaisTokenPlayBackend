import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { NotFoundError } from "../../utils/http-error";
import { createStore, listActiveStores, listAllStores, updateStore } from "./stores.service";

const storeParamsSchema = z.object({ id: z.string().uuid() });

const storeBodySchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
});

const storeUpdateBodySchema = z.object({
  name: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function storesRoutes(app: FastifyInstance) {
  app.get("/stores", async (_request, reply) => {
    const stores = await listActiveStores();
    return reply.status(200).send(stores);
  });

  app.get("/stores/:id/machines", async (request, reply) => {
    const { id } = storeParamsSchema.parse(request.params);

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) {
      throw new NotFoundError("Loja nao encontrada");
    }

    const machines = await prisma.machine.findMany({
      where: { storeId: id },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        status: true,
        costPerGame: true,
      },
      orderBy: { name: "asc" },
    });

    return reply.status(200).send(machines);
  });

  app.get("/admin/stores", { onRequest: [app.requireAdmin] }, async (_request, reply) => {
    const stores = await listAllStores();
    return reply.status(200).send(stores);
  });

  app.post("/admin/stores", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const body = storeBodySchema.parse(request.body);
    const store = await createStore(body);
    return reply.status(201).send(store);
  });

  app.put("/admin/stores/:id", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const { id } = storeParamsSchema.parse(request.params);
    const body = storeUpdateBodySchema.parse(request.body);
    const store = await updateStore(id, body);
    return reply.status(200).send(store);
  });
}
