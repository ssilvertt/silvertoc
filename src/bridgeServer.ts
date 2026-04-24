import http from "node:http";
import { URL } from "node:url";

import type { BridgeState } from "./bridgeState.js";

type BridgeServerOptions = {
  host: string;
  port: number;
  token: string;
  bridgeState: BridgeState;
  sendToTelegram: (chatId: number, message: string) => Promise<void>;
};

export function startBridgeServer(options: BridgeServerOptions): http.Server {
  const { host, port, token, bridgeState, sendToTelegram } = options;

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (requestUrl.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (
      requestUrl.pathname !== "/oc/pull"
      && requestUrl.pathname !== "/oc/pull-text"
      && requestUrl.pathname !== "/oc/push-text"
    ) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }

    const requestToken = requestUrl.searchParams.get("token");
    const chatIdRaw = requestUrl.searchParams.get("chatId");
    const chatId = Number(chatIdRaw);

    if (requestToken !== token) {
      res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
      return;
    }

    if (!Number.isInteger(chatId)) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "chatId must be integer" }));
      return;
    }

    if (requestUrl.pathname === "/oc/push-text") {
      const player = (requestUrl.searchParams.get("player") ?? "MC").trim();
      const text = (requestUrl.searchParams.get("message") ?? "").trim();

      if (text.length === 0) {
        res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "message is required" }));
        return;
      }

      const safePlayer = player.slice(0, 32);
      const safeText = text.slice(0, 3500);

      void sendToTelegram(chatId, `🟢 [${safePlayer}] ${safeText}`)
        .then(() => {
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true }));
        })
        .catch((error: unknown) => {
          res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: String(error) }));
        });

      return;
    }

    const message = bridgeState.pull(chatId);

    if (requestUrl.pathname === "/oc/pull-text") {
      if (message === null) {
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(message);
      return;
    }

    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, message }));
  });

  server.listen(port, host, () => {
    console.log(`Bridge server is listening on ${host}:${port}`);
  });

  return server;
}
