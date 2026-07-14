import { prisma } from "../../utils/prisma";

const TOKEN_VALUE_KEY = "token_value_brl";
const DEFAULT_TOKEN_VALUE_BRL = "1.00";

export type AdminSettings = {
  tokenValueBrl: string;
};

export async function getAdminSettings(): Promise<AdminSettings> {
  const tokenValue = await prisma.appSetting.upsert({
    where: { key: TOKEN_VALUE_KEY },
    update: {},
    create: { key: TOKEN_VALUE_KEY, value: DEFAULT_TOKEN_VALUE_BRL },
  });

  return { tokenValueBrl: tokenValue.value };
}

export async function updateAdminSettings(input: { tokenValueBrl: number }): Promise<AdminSettings> {
  const tokenValue = await prisma.appSetting.upsert({
    where: { key: TOKEN_VALUE_KEY },
    update: { value: input.tokenValueBrl.toFixed(2) },
    create: { key: TOKEN_VALUE_KEY, value: input.tokenValueBrl.toFixed(2) },
  });

  return { tokenValueBrl: tokenValue.value };
}
