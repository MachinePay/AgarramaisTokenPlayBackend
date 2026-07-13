import { prisma } from "../../utils/prisma";

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
