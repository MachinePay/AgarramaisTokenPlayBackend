import type { FastifyInstance } from "fastify";
import { getUserNavbarSummary } from "../loyalty/loyalty.service";

export async function usersRoutes(app: FastifyInstance) {
  app.get("/users/me", { onRequest: [app.authenticate] }, async (request, reply) => {
    const summary = await getUserNavbarSummary(request.user.sub);
    return reply.status(200).send(summary);
  });
}
