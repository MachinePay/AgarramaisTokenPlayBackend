import type { FastifyInstance } from "fastify";
import { getLoyaltyDistribution } from "./dashboard.service";

export async function dashboardAdminRoutes(app: FastifyInstance) {
  app.get(
    "/admin/dashboard/loyalty-distribution",
    { onRequest: [app.requireAdmin] },
    async (_request, reply) => {
      const distribution = await getLoyaltyDistribution();
      return reply.status(200).send(distribution);
    },
  );
}
