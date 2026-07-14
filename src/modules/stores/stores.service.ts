import { Prisma } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { ConflictError } from "../../utils/http-error";

export async function listActiveStores() {
  return prisma.store.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
}

export async function listAllStores() {
  return prisma.store.findMany({ orderBy: { name: "asc" } });
}

export async function createStore(input: { name: string; location: string }) {
  return prisma.store.create({ data: input });
}

export async function updateStore(
  id: string,
  input: Partial<{ name: string; location: string; status: "ACTIVE" | "INACTIVE" }>,
) {
  return prisma.store.update({ where: { id }, data: input });
}

export async function deleteStore(id: string) {
  try {
    await prisma.store.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new ConflictError("Esta loja possui maquinas vinculadas. Inative a loja ou remova as maquinas primeiro.");
    }
    throw error;
  }
}
