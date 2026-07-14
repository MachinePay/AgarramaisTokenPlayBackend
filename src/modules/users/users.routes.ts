import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserNavbarSummary } from "../loyalty/loyalty.service";
import { createAdminUser, grantUserCredits, listAdminUsers, updateAdminUser } from "./users.service";

const userParamsSchema = z.object({ id: z.string().uuid() });

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  cpf: z.string().min(11).max(14).optional(),
  phone: z.string().min(8).max(20).nullable().optional(),
  password: z.string().min(6).optional(),
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
});

const userCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  cpf: z.string().min(11).max(14),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(6),
  status: z.enum(["ACTIVE", "BLOCKED"]).default("ACTIVE"),
  role: z.enum(["CUSTOMER", "ADMIN"]).default("CUSTOMER"),
});

const grantCreditsSchema = z.object({
  credits: z.number().int().positive().max(100000),
});

export async function usersRoutes(app: FastifyInstance) {
  app.get("/users/me", { onRequest: [app.authenticate] }, async (request, reply) => {
    const summary = await getUserNavbarSummary(request.user.sub);
    return reply.status(200).send(summary);
  });

  app.get("/admin/users", { onRequest: [app.requireAdmin] }, async (_request, reply) => {
    const users = await listAdminUsers();
    return reply.status(200).send(users);
  });

  app.post("/admin/users", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const body = userCreateSchema.parse(request.body);
    const user = await createAdminUser(body);
    return reply.status(201).send(user);
  });

  app.put("/admin/users/:id", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const { id } = userParamsSchema.parse(request.params);
    const body = userUpdateSchema.parse(request.body);
    const user = await updateAdminUser(request.user.sub, id, body);
    return reply.status(200).send(user);
  });

  app.post("/admin/users/:id/credits", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const { id } = userParamsSchema.parse(request.params);
    const { credits } = grantCreditsSchema.parse(request.body);
    const user = await grantUserCredits(id, credits);
    return reply.status(200).send(user);
  });
}
