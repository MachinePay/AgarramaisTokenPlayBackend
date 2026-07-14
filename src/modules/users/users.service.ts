import { prisma } from "../../utils/prisma";
import { BadRequestError, NotFoundError } from "../../utils/http-error";

export async function listAdminUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      status: true,
      role: true,
      creditBalance: true,
      totalCreditsPurchased: true,
      createdAt: true,
    },
  });
}

export async function updateAdminUser(
  requesterId: string,
  userId: string,
  input: Partial<{ status: "ACTIVE" | "BLOCKED"; role: "CUSTOMER" | "ADMIN" }>,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("Usuario nao encontrado");
  }

  if (requesterId === userId && (input.status === "BLOCKED" || input.role === "CUSTOMER")) {
    throw new BadRequestError("Voce nao pode remover seu proprio acesso admin");
  }

  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      status: true,
      role: true,
      creditBalance: true,
      totalCreditsPurchased: true,
      createdAt: true,
    },
  });
}
