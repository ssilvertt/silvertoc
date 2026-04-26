import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "silvertoc_session";

export type TelegramAuthPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export type SessionPayload = {
  telegramId: number;
  isAdmin: boolean;
};

export function verifyTelegramAuth(payload: TelegramAuthPayload, botToken: string): boolean {
  if (!payload.hash || !payload.auth_date || !payload.id || !payload.first_name) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = 24 * 60 * 60;
  if (Math.abs(now - Number(payload.auth_date)) > maxAgeSeconds) {
    return false;
  }

  const dataParts: string[] = [];

  const entries = Object.entries(payload)
    .filter(([key, value]) => key !== "hash" && value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [key, value] of entries) {
    dataParts.push(`${key}=${value}`);
  }

  const dataCheckString = dataParts.join("\n");
  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(calculatedHash, "hex"), Buffer.from(payload.hash, "hex"));
}

export function signSession(payload: SessionPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as SessionPayload;

    if (!decoded || !decoded.telegramId) {
      return null;
    }

    return {
      telegramId: Number(decoded.telegramId),
      isAdmin: Boolean(decoded.isAdmin),
    };
  } catch {
    return null;
  }
}
