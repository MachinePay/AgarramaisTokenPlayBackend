import { prisma } from "../../utils/prisma";

const TOKEN_VALUE_KEY = "token_value_brl";
const TOKEN_BUNDLE_AMOUNT_KEY = "token_bundle_amount_brl";
const TOKEN_BUNDLE_CREDITS_KEY = "token_bundle_credits";
const POINTS_PER_CREDIT_KEY = "points_per_credit";
const DEFAULT_TOKEN_VALUE_BRL = "1.00";
const DEFAULT_TOKEN_BUNDLE_AMOUNT_BRL = "1.00";
const DEFAULT_TOKEN_BUNDLE_CREDITS = "1";
const DEFAULT_POINTS_PER_CREDIT = "0";

export type AdminSettings = {
  tokenBundleAmountBrl: string;
  tokenBundleCredits: number;
  tokenValueBrl: string;
  pointsPerCredit: number;
};

export async function getAdminSettings(): Promise<AdminSettings> {
  const [bundleAmount, bundleCredits, legacyTokenValue, pointsPerCredit] = await Promise.all([
    upsertSetting(TOKEN_BUNDLE_AMOUNT_KEY, DEFAULT_TOKEN_BUNDLE_AMOUNT_BRL),
    upsertSetting(TOKEN_BUNDLE_CREDITS_KEY, DEFAULT_TOKEN_BUNDLE_CREDITS),
    upsertSetting(TOKEN_VALUE_KEY, DEFAULT_TOKEN_VALUE_BRL),
    upsertSetting(POINTS_PER_CREDIT_KEY, DEFAULT_POINTS_PER_CREDIT),
  ]);

  const credits = Math.max(1, Number.parseInt(bundleCredits.value, 10) || 1);
  const amount = Number(bundleAmount.value || legacyTokenValue.value || DEFAULT_TOKEN_VALUE_BRL);
  const unitValue = amount / credits;

  return {
    tokenBundleAmountBrl: amount.toFixed(2),
    tokenBundleCredits: credits,
    tokenValueBrl: unitValue.toFixed(2),
    pointsPerCredit: Number(pointsPerCredit.value) || 0,
  };
}

export async function updateAdminSettings(input: {
  tokenBundleAmountBrl?: number;
  tokenBundleCredits?: number;
  tokenValueBrl?: number;
  pointsPerCredit?: number;
}): Promise<AdminSettings> {
  const amount = input.tokenBundleAmountBrl ?? input.tokenValueBrl ?? Number(DEFAULT_TOKEN_BUNDLE_AMOUNT_BRL);
  const credits = input.tokenBundleCredits ?? 1;
  const unitValue = amount / credits;
  const current = await getAdminSettings();
  const pointsPerCredit = input.pointsPerCredit ?? current.pointsPerCredit;

  await Promise.all([
    upsertSetting(TOKEN_BUNDLE_AMOUNT_KEY, amount.toFixed(2)),
    upsertSetting(TOKEN_BUNDLE_CREDITS_KEY, String(credits)),
    upsertSetting(TOKEN_VALUE_KEY, unitValue.toFixed(2)),
    upsertSetting(POINTS_PER_CREDIT_KEY, String(pointsPerCredit)),
  ]);

  return getAdminSettings();
}

function upsertSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
