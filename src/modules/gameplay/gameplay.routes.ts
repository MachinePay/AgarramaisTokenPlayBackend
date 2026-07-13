import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { playMachine } from "./gameplay.service";

const playBodySchema = z.object({
  machineId: z.string().uuid(),
  quantity: z.number().int().positive().max(20).default(1),
});

export async function gameplayRoutes(app: FastifyInstance) {
  app.post("/machines/play", { onRequest: [app.authenticate] }, async (request, reply) => {
    const { machineId, quantity } = playBodySchema.parse(request.body);
    const userId = request.user.sub;

    const result = await playMachine(userId, machineId, quantity);

    return reply.status(200).send(result);
  });
}
