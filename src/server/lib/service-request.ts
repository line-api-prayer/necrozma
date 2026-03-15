import crypto from "crypto";
import { getServiceRequestPageUrl } from "~/server/lib/app-links";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 90;

type ServiceRequestTokenPayload = {
  orderNo: string;
  exp: number;
};

function getSigningSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required to sign service request links");
  }
  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signPayload(payload: string) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");
}

export function createServiceRequestToken(orderNo: string) {
  const payload = toBase64Url(
    JSON.stringify({
      orderNo,
      exp: Date.now() + TOKEN_TTL_MS,
    } satisfies ServiceRequestTokenPayload),
  );

  return `${payload}.${signPayload(payload)}`;
}

export function verifyServiceRequestToken(orderNo: string, token: string | null | undefined) {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = signPayload(payload);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return false;
  }

  let parsed: ServiceRequestTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ServiceRequestTokenPayload;
  } catch {
    return false;
  }

  return parsed.orderNo === orderNo && parsed.exp > Date.now();
}

export function buildServiceRequestUrl(orderNo: string) {
  const token = createServiceRequestToken(orderNo);
  return getServiceRequestPageUrl(orderNo, token);
}

export function isServiceRequestComplete(order: {
  requestedServiceDate: string | null;
  prayerText: string | null;
}) {
  return Boolean(order.requestedServiceDate && order.prayerText?.trim());
}
