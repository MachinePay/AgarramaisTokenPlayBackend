import { randomUUID } from "node:crypto";
import { prisma } from "../../utils/prisma";
import { BadRequestError, ConflictError, HttpError, NotFoundError } from "../../utils/http-error";
import { compactPayGateway } from "../../integrations/compactpay";

export type PlayMachineResult = {
  gameplayLogId: string;
  creditsDebited: number;
  pulsesSent: number;
  remainingBalance: number;
  pulseStatus: string;
};

/**
 * Regra B: debita creditos do usuario, converte para pulsos fisicos e dispara
 * o comando na CompactPay. Se a CompactPay nao confirmar o pulso, os creditos
 * sao estornados automaticamente.
 *
 * `quantity` permite disparar varias jogadas de uma vez (seletor +/- do
 * WebApp): os creditos e pulsos sao multiplicados, mas apenas UM comando de
 * pulso e enviado a CompactPay.
 */
export async function playMachine(
  userId: string,
  machineId: string,
  quantity = 1,
): Promise<PlayMachineResult> {
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) {
    throw new NotFoundError("Maquina nao encontrada");
  }
  if (machine.status !== "AVAILABLE") {
    throw new ConflictError("Maquina indisponivel no momento");
  }

  const totalCredits = machine.costPerGame * quantity;
  const totalPulses = totalCredits * machine.pulsesPerCredit;
  const commandId = randomUUID();

  // Debita o saldo de forma atomica (updateMany com filtro de saldo evita corrida
  // entre duas jogadas simultaneas do mesmo usuario) e reserva a maquina.
  const debited = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.user.updateMany({
      where: { id: userId, creditBalance: { gte: totalCredits } },
      data: { creditBalance: { decrement: totalCredits } },
    });

    if (updateResult.count === 0) {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError("Usuario nao encontrado");
      throw new BadRequestError("Saldo de creditos insuficiente");
    }

    const machineUpdate = await tx.machine.updateMany({
      where: { id: machineId, status: "AVAILABLE" },
      data: { status: "BUSY" },
    });

    if (machineUpdate.count === 0) {
      throw new ConflictError("Maquina indisponivel no momento");
    }

    return tx.user.findUniqueOrThrow({ where: { id: userId } });
  });

  try {
    const dispenseResult = await compactPayGateway.firePulses({
      telemetryId: machine.telemetryId,
      pulses: totalPulses,
      correlationId: commandId,
    });

    const log = await prisma.gameplayLog.create({
      data: {
        userId,
        machineId,
        creditsDebited: totalCredits,
        pulsesSent: totalPulses,
        status: dispenseResult.ok ? "SUCCESS" : "FAILED",
      },
    });

    if (!dispenseResult.ok) {
      await refundCredits(userId, totalCredits);
      throw new HttpError(502, `CompactPay nao confirmou o pulso (${dispenseResult.pulseStatus})`);
    }

    return {
      gameplayLogId: log.id,
      creditsDebited: machine.costPerGame,
      pulsesSent: totalPulses,
      remainingBalance: debited.creditBalance,
      pulseStatus: dispenseResult.pulseStatus,
    };
  } catch (error) {
    if (!(error instanceof HttpError)) {
      // Erro de rede/infra ao falar com a CompactPay: registra falha e estorna.
      await prisma.gameplayLog.create({
        data: {
          userId,
          machineId,
          creditsDebited: totalCredits,
          pulsesSent: totalPulses,
          status: "FAILED",
        },
      });
      await refundCredits(userId, totalCredits);
    }
    throw error;
  } finally {
    await prisma.machine.update({ where: { id: machineId }, data: { status: "AVAILABLE" } });
  }
}

async function refundCredits(userId: string, credits: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: credits } },
  });
}
