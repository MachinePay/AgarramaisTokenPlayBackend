import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { BadRequestError, HttpError } from "../../utils/http-error";
import { getSantanderPaymentSettings, type SantanderPaymentSettings } from "../../modules/admin/settings.service";
import type {
  CreatePreferenceParams,
  CreatePreferenceResult,
  CreatePixPaymentParams,
  CreatePixPaymentResult,
  IMercadoPagoGateway,
  MercadoPagoPayment,
} from "../mercadopago/mercadopago.types";

type SantanderTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type SantanderChargeResponse = {
  txid?: string;
  status?: string;
  pixCopiaECola?: string;
  copiaECola?: string;
  qrcode?: string;
  qrCode?: string;
  imagemQrcode?: string;
  imagemQRCode?: string;
  image?: string;
  base64?: string;
  valor?: { original?: string };
  pix?: Array<{ endToEndId?: string; valor?: string }>;
};

type HttpRequestOptions = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  config?: SantanderPaymentSettings;
  label: string;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function buildTxId(externalReference: string): string {
  const normalized = externalReference.replace(/[^A-Za-z0-9]/g, "");
  if (normalized.length >= 26 && normalized.length <= 35) return normalized;
  return `${normalized}${randomUUID().replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 35).padEnd(26, "0");
}

function normalizeSantanderStatus(status?: string): MercadoPagoPayment["status"] {
  const value = (status ?? "").toUpperCase();
  if (["CONCLUIDA", "CONCLUIDO", "LIQUIDADA", "LIQUIDADO", "PAID", "APPROVED"].includes(value)) return "approved";
  if (["REMOVIDA_PELO_USUARIO_RECEBEDOR", "REMOVIDA_PELO_PSP", "CANCELED", "CANCELLED", "REMOVED"].includes(value)) {
    return "canceled";
  }
  return "pending";
}

function stripDataImagePrefix(value: string | undefined): string {
  return value?.replace(/^data:image\/[a-zA-Z]+;base64,/, "") ?? "";
}

async function requestJson<T>({ method, url, headers = {}, body, config, label }: HttpRequestOptions): Promise<T> {
  const parsed = new URL(url);
  const transport = parsed.protocol === "http:" ? httpRequest : httpsRequest;

  return new Promise<T>((resolve, reject) => {
    const request = transport(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          Accept: "application/json",
          "User-Agent": "AgarraMais/1.0",
          ...headers,
        },
        ...(config?.certificatePem && config.privateKeyPem
          ? {
              cert: config.certificatePem,
              key: config.privateKeyPem,
            }
          : {}),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`Santander ${label}: falha HTTP ${response.statusCode} ${raw}`));
            return;
          }
          if (!raw) {
            resolve({} as T);
            return;
          }
          try {
            resolve(JSON.parse(raw) as T);
          } catch {
            reject(new Error(`Santander: resposta invalida ${raw}`));
          }
        });
      },
    );

    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

export class SantanderPixGateway implements IMercadoPagoGateway {
  private token: { value: string; expiresAt: number } | null = null;

  private async getConfig() {
    const config = await getSantanderPaymentSettings();
    if (!config.clientId || !config.clientSecret || !config.pixKey) {
      throw new BadRequestError("Configure Client ID, Client Secret e Chave Pix do Santander no setor financeiro");
    }
    return config;
  }

  private async getAccessToken(config: SantanderPaymentSettings): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
    }).toString();

    const data = await requestJson<SantanderTokenResponse>({
      method: "POST",
      url: `${normalizeBaseUrl(config.baseUrl)}/auth/oauth/v2/token`,
      label: "OAuth",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        "Content-Length": Buffer.byteLength(body).toString(),
      },
      body,
      config,
    });

    if (!data.access_token) {
      throw new Error("Santander: token OAuth sem access_token");
    }

    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(60, data.expires_in ?? 900) * 1000,
    };
    return data.access_token;
  }

  private normalizeError(error: unknown, fallback: string): never {
    if (error instanceof HttpError) throw error;
    const message = error instanceof Error ? error.message : fallback;
    throw new BadRequestError(message || fallback);
  }

  async createPixPayment(params: CreatePixPaymentParams): Promise<CreatePixPaymentResult> {
    try {
      const config = await this.getConfig();
      const token = await this.getAccessToken(config);
      const txid = buildTxId(params.externalReference);
      const body = JSON.stringify({
        calendario: { expiracao: 900 },
        valor: { original: params.amountBrl.toFixed(2) },
        chave: config.pixKey,
        solicitacaoPagador: params.title.slice(0, 140),
        infoAdicionais: [{ nome: "Referencia", valor: params.externalReference }],
      });

      const data = await requestJson<SantanderChargeResponse>({
        method: "PUT",
        url: `${normalizeBaseUrl(config.baseUrl)}/pix/v2/cob/${txid}`,
        label: "criacao de cobranca Pix",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body).toString(),
        },
        body,
        config,
      });

      const qrCode = data.pixCopiaECola ?? data.copiaECola ?? data.qrcode ?? data.qrCode;
      if (!qrCode) {
        throw new Error("Santander: cobranca criada sem Pix copia e cola");
      }

      return {
        paymentId: data.txid ?? txid,
        qrCode,
        qrCodeBase64: stripDataImagePrefix(data.imagemQrcode ?? data.imagemQRCode ?? data.image ?? data.base64),
      };
    } catch (error) {
      this.normalizeError(error, "Nao foi possivel gerar o Pix Santander");
    }
  }

  async getPayment(txid: string): Promise<MercadoPagoPayment | null> {
    try {
      const config = await this.getConfig();
      const token = await this.getAccessToken(config);
      const data = await requestJson<SantanderChargeResponse>({
        method: "GET",
        url: `${normalizeBaseUrl(config.baseUrl)}/pix/v2/cob/${txid}`,
        label: "consulta de cobranca Pix",
        headers: { Authorization: `Bearer ${token}` },
        config,
      });

      return {
        id: data.txid ?? txid,
        status: normalizeSantanderStatus(data.status),
        statusDetail: data.status ?? null,
        externalReference: txid.length === 32 ? txid.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5") : null,
        transactionAmount: data.valor?.original ? Number(data.valor.original) : null,
      };
    } catch (error) {
      this.normalizeError(error, "Nao foi possivel consultar o Pix Santander");
    }
  }

  async cancelPayment(_txid: string): Promise<void> {
    // A documentacao Santander Pix trabalha a remocao/alteracao da cobranca em endpoints
    // proprios. Mantemos o cancelamento local ate validarmos esse detalhe no sandbox.
  }

  async createPreference(_params: CreatePreferenceParams): Promise<CreatePreferenceResult> {
    throw new BadRequestError("Santander configurado apenas para Pix. Use Pix ou mantenha Mercado Pago para checkout hospedado.");
  }

  async getMerchantOrderPaymentIds(_merchantOrderId: string): Promise<string[]> {
    return [];
  }
}

export const santanderPixGateway = new SantanderPixGateway();
