import { prisma } from "../../utils/prisma";
import { compactPayGateway } from "../../integrations/compactpay";

export async function listAllMachines() {
  return prisma.machine.findMany({ orderBy: { name: "asc" }, include: { store: true } });
}

export async function createMachine(input: {
  storeId: string;
  name: string;
  imageUrl?: string;
  telemetryId: string;
  costPerGame: number;
  pulsesPerCredit: number;
}) {
  return prisma.machine.create({ data: input });
}

export async function updateMachine(
  id: string,
  input: Partial<{
    name: string;
    imageUrl: string;
    costPerGame: number;
    pulsesPerCredit: number;
    status: "AVAILABLE" | "BUSY" | "MAINTENANCE";
  }>,
) {
  return prisma.machine.update({ where: { id }, data: input });
}

/** Lista as maquinas reais cadastradas na CompactPay, para popular o dropdown de telemetryId no admin. */
export async function listCompactPayMachines() {
  return compactPayGateway.listMachines();
}
