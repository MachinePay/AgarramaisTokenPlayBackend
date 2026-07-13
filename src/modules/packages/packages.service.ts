import { prisma } from "../../utils/prisma";

export async function listActivePackages() {
  return prisma.creditPackage.findMany({
    where: { active: true },
    orderBy: { amountBrl: "asc" },
  });
}

export async function listAllPackages() {
  return prisma.creditPackage.findMany({ orderBy: { amountBrl: "asc" } });
}

export async function createPackage(input: {
  name: string;
  amountBrl: number;
  baseCredits: number;
  bonusCredits: number;
  isPopular?: boolean;
  active?: boolean;
}) {
  return prisma.creditPackage.create({ data: input });
}

export async function updatePackage(
  id: string,
  input: Partial<{
    name: string;
    amountBrl: number;
    baseCredits: number;
    bonusCredits: number;
    isPopular: boolean;
    active: boolean;
  }>,
) {
  return prisma.creditPackage.update({ where: { id }, data: input });
}
