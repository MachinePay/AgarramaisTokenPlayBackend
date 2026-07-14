import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAdminSettings, updateAdminSettings } from "./settings.service";

const settingsBodySchema = z.object({
  tokenBundleAmountBrl: z.number().positive().optional(),
  tokenBundleCredits: z.number().int().positive().optional(),
  tokenValueBrl: z.number().positive().optional(),
});

export async function settingsAdminRoutes(app: FastifyInstance) {
  app.get("/settings/credits", async (_request, reply) => {
    const settings = await getAdminSettings();
    return reply.status(200).send(settings);
  });

  app.get("/admin/settings", { onRequest: [app.requireAdmin] }, async (_request, reply) => {
    const settings = await getAdminSettings();
    return reply.status(200).send(settings);
  });

  app.put("/admin/settings", { onRequest: [app.requireAdmin] }, async (request, reply) => {
    const body = settingsBodySchema.parse(request.body);
    const settings = await updateAdminSettings(body);
    return reply.status(200).send(settings);
  });
}
