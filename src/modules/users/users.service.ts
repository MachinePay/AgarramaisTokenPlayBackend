import { prisma } from "../../utils/prisma";
import { hashPassword } from "../../utils/password";
import { BadRequestError, NotFoundError } from "../../utils/http-error";

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  cpf: true,
  phone: true,
  status: true,
  role: true,
  creditBalance: true,
  totalCreditsPurchased: true,
  createdAt: true,
};

export async function listAdminUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: adminUserSelect,
  });
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  password: string;
  role?: "CUSTOMER" | "ADMIN";
  status?: "ACTIVE" | "BLOCKED";
}) {
  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      cpf: input.cpf,
      phone: input.phone,
      passwordHash,
      role: input.role ?? "CUSTOMER",
      status: input.status ?? "ACTIVE",
    },
    select: adminUserSelect,
  });
}

export async function updateAdminUser(
  requesterId: string,
  userId: string,
  input: Partial<{
    name: string;
    email: string;
    cpf: string;
    phone: string | null;
    password: string;
    status: "ACTIVE" | "BLOCKED";
    role: "CUSTOMER" | "ADMIN";
  }>,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("Usuario nao encontrado");
  }

  if (requesterId === userId && (input.status === "BLOCKED" || input.role === "CUSTOMER")) {
    throw new BadRequestError("Voce nao pode remover seu proprio acesso admin");
  }

  const { password, ...rest } = input;

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...rest,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
    select: adminUserSelect,
  });
}

export async function grantUserCredits(userId: string, credits: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("Usuario nao encontrado");
  }

  return prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: credits } },
    select: adminUserSelect,
  });
}
