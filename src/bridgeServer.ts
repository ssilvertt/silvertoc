import type http from "node:http";

import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Pool } from "pg";

import { SESSION_COOKIE_NAME, signSession, verifySession, verifyTelegramAuth, type TelegramAuthPayload } from "./auth.js";
import type { BridgeState } from "./bridgeState.js";
import {
  createMonitorItem,
  deleteMonitorItem,
  findUserByTelegramId,
  getMonitorSummary,
  getUserSummary,
  listEnabledMonitorItems,
  listMonitorItems,
  listUsers,
  updateMonitorAmounts,
  updateMonitorItem,
  upsertUser,
} from "./database.js";

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
    const [summary, monitorSummary] = await Promise.all([getUserSummary(pool), getMonitorSummary(pool)]);
    res.json({
      ok: true,
      summary: {
        ...summary,
        bridgeEnabledChats: bridgeState.enabledChatsCount(),
        bridgeQueuedMessages: bridgeState.totalQueuedMessages(),
        monitorItemsTotal: monitorSummary.total,
        monitorItemsEnabled: monitorSummary.enabled,
      },
    });
  });

  app.get("/api/admin/me-monitor/items", requireSession, requireAdmin, async (_req: Request, res: Response) => {
    const items = await listMonitorItems(pool);
    res.json({ ok: true, items });
  });

  app.post("/api/admin/me-monitor/items", requireSession, requireAdmin, async (req: Request, res: Response) => {
    const itemId = String(req.body?.itemId ?? req.body?.label ?? "").trim();
    const displayName = req.body?.displayName !== undefined ? String(req.body.displayName).trim() : undefined;

    if (!itemId) {
      res.status(400).json({ ok: false, error: "itemId is required" });
      return;
    }

    try {
      const item = await createMonitorItem(pool, itemId, displayName);
      res.json({ ok: true, item });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.patch("/api/admin/me-monitor/items/:id", requireSession, requireAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ ok: false, error: "id must be integer" });
      return;
    }

    const itemId =
      req.body?.itemId !== undefined ? String(req.body.itemId).trim() : req.body?.label !== undefined ? String(req.body.label).trim() : undefined;
    const displayName = req.body?.displayName !== undefined ? String(req.body.displayName).trim() : undefined;
    const enabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : undefined;

    try {
      const item = await updateMonitorItem(pool, id, { itemId, displayName, enabled });
      if (!item) {
        res.status(404).json({ ok: false, error: "Not found" });
        return;
      }

      res.json({ ok: true, item });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
  });

  app.delete("/api/admin/me-monitor/items/:id", requireSession, requireAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ ok: false, error: "id must be integer" });
      return;
    }

    const deleted = await deleteMonitorItem(pool, id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }

    res.json({ ok: true });
  });

  app.get("/api/me-monitor/config", (req: Request, res: Response) => {
    if (req.query.token !== token) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    void listEnabledMonitorItems(pool)
      .then((items) => {
        res.json({ ok: true, items });
      })
      .catch((error: unknown) => {
        res.status(500).json({ ok: false, error: String(error) });
      });
  });

  app.get("/oc/me-monitor/config-text", (req: Request, res: Response) => {
    if (req.query.token !== token) {
      res.status(401).send("Unauthorized");
      return;
    }

    void listEnabledMonitorItems(pool)
      .then((items) => {
        res.type("text/plain").send(items.map((item) => `${item.itemId}\t${item.displayName}`).join("\n"));
      })
      .catch((error: unknown) => {
        res.status(500).send(String(error));
      });
  });

  app.get("/oc/me-monitor/report", async (req: Request, res: Response) => {
    if (req.query.token !== token) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const label = String(req.query.label ?? "").trim();
    const amount = Number(req.query.amount ?? NaN);

    if (!label || !Number.isFinite(amount)) {
      res.status(400).json({ ok: false, error: "label and amount are required" });
      return;
    }

    try {
      await updateMonitorAmounts(pool, [{ itemId: label, amount }]);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: String(error) });
    }
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
