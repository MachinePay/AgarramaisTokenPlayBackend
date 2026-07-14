import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../utils/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Administrador Agarra Mais";
  const cpf = process.env.ADMIN_CPF || "00000000000";

  if (!email || !password) {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD ausentes; pulando criacao de admin.");
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    create: {
      name,
      email,
      cpf,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Admin garantido: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
