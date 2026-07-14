import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserNavbarSummary } from "../loyalty/loyalty.service";
import { listAdminUsers, updateAdminUser } from "./users.service";

const userParamsSchema = z.object({ id: z.string().uuid() });

const userUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "BLOCKED"]).optional(),
  role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
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

  app.put("/admin/users/:id", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const { id } = userParamsSchema.parse(request.params);
    const body = userUpdateSchema.parse(request.body);
    const user = await updateAdminUser(request.user.sub, id, body);
    return reply.status(200).send(user);
  });
}
