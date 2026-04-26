import type http from "node:http";

import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Pool } from "pg";

import { SESSION_COOKIE_NAME, signSession, verifySession, verifyTelegramAuth, type TelegramAuthPayload } from "./auth.js";
import type { BridgeState } from "./bridgeState.js";
import { findUserByTelegramId, getUserSummary, listUsers, upsertUser } from "./database.js";

type BridgeServerOptions = {
  host: string;
  port: number;
  token: string;
  bridgeState: BridgeState;
  sendToTelegram: (chatId: number, message: string) => Promise<void>;
  pool: Pool;
  botToken: string;
  botUsername: string;
  adminTelegramIds: Set<number>;
  sessionSecret: string;
  secureCookies: boolean;
};

type AuthRequest = Request & {
  session?: {
    telegramId: number;
    isAdmin: boolean;
  };
};

function parseChatId(req: Request): number | null {
  const raw = String(req.query.chatId ?? "");
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export function startBridgeServer(options: BridgeServerOptions): http.Server {
  const {
    host,
    port,
    token,
    bridgeState,
    sendToTelegram,
    pool,
    botToken,
    botUsername,
    adminTelegramIds,
    sessionSecret,
    secureCookies,
  } = options;

  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const requireSession = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const tokenValue = req.cookies?.[SESSION_COOKIE_NAME];
    if (!tokenValue) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const session = verifySession(tokenValue, sessionSecret);
    if (!session) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    req.session = session;
    next();
  };

  const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.session?.isAdmin) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
    next();
  };

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get("/api/public/config", (_req: Request, res: Response) => {
    res.json({ ok: true, botUsername });
  });

  app.post("/api/auth/telegram", async (req: Request, res: Response) => {
    const payload = req.body as TelegramAuthPayload;

    if (!verifyTelegramAuth(payload, botToken)) {
      res.status(401).json({ ok: false, error: "Invalid Telegram auth payload" });
      return;
    }

    const telegramId = Number(payload.id);
    const isAdmin = adminTelegramIds.has(telegramId);

    const user = await upsertUser(
      pool,
      {
        telegramId,
        firstName: payload.first_name,
        lastName: payload.last_name ?? null,
        username: payload.username ?? null,
        photoUrl: payload.photo_url ?? null,
      },
      isAdmin,
    );

    const sessionToken = signSession(
      {
        telegramId: user.telegramId,
        isAdmin: user.isAdmin,
      },
      sessionSecret,
    );

    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({ ok: true, user });
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireSession, async (req: AuthRequest, res: Response) => {
    const user = await findUserByTelegramId(pool, req.session!.telegramId);
    if (!user) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    res.json({ ok: true, user });
  });

  app.get("/api/admin/users", requireSession, requireAdmin, async (_req: Request, res: Response) => {
    const users = await listUsers(pool);
    res.json({ ok: true, users });
  });

  app.get("/api/admin/summary", requireSession, requireAdmin, async (_req: Request, res: Response) => {
    const summary = await getUserSummary(pool);
    res.json({
      ok: true,
      summary: {
        ...summary,
        bridgeEnabledChats: bridgeState.enabledChatsCount(),
        bridgeQueuedMessages: bridgeState.totalQueuedMessages(),
      },
    });
  });

  app.get("/oc/pull", (req: Request, res: Response) => {
    if (req.query.token !== token) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const chatId = parseChatId(req);
    if (chatId === null) {
      res.status(400).json({ ok: false, error: "chatId must be integer" });
      return;
    }

    const message = bridgeState.pull(chatId);
    res.json({ ok: true, message });
  });

  app.get("/oc/pull-text", (req: Request, res: Response) => {
    if (req.query.token !== token) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const chatId = parseChatId(req);
    if (chatId === null) {
      res.status(400).json({ ok: false, error: "chatId must be integer" });
      return;
    }

    const message = bridgeState.pull(chatId);
    if (message === null) {
      res.status(204).end();
      return;
    }

    res.type("text/plain").send(message);
  });

  app.get("/oc/push-text", async (req: Request, res: Response) => {
    if (req.query.token !== token) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const chatId = parseChatId(req);
    if (chatId === null) {
      res.status(400).json({ ok: false, error: "chatId must be integer" });
      return;
    }

    const player = String(req.query.player ?? "MC").trim().slice(0, 32);
    const text = String(req.query.message ?? "").trim().slice(0, 3500);

    if (!text) {
      res.status(400).json({ ok: false, error: "message is required" });
      return;
    }

    try {
      await sendToTelegram(chatId, `🟢 [${player}] ${text}`);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  const server = app.listen(port, host, () => {
    console.log(`Bridge server is listening on ${host}:${port}`);
  });

  return server;
}
