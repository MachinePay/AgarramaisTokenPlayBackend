import { prisma } from "../../utils/prisma";

export type LoyaltyDistributionEntry = {
  levelName: string;
  userCount: number;
  percentage: number;
};

/** Quantos usuarios estao em cada nivel de fidelidade hoje (grafico do painel admin). */
export async function getLoyaltyDistribution(): Promise<{
  totalUsers: number;
  distribution: LoyaltyDistributionEntry[];
}> {
  const levels = await prisma.loyaltyLevel.findMany({
    where: { status: "ACTIVE" },
    orderBy: { requiredCredits: "asc" },
  });
  const totalUsers = await prisma.user.count();

  const distribution = await Promise.all(
    levels.map(async (level, index) => {
      const nextLevel = levels[index + 1];
      const userCount = await prisma.user.count({
        where: {
          totalCreditsPurchased: {
            gte: level.requiredCredits,
            ...(nextLevel ? { lt: nextLevel.requiredCredits } : {}),
          },
        },
      });

      return {
        levelName: level.levelName,
        userCount,
        percentage: totalUsers === 0 ? 0 : Math.round((userCount / totalUsers) * 10000) / 100,
      };
    }),
  );

  return { totalUsers, distribution };
}
