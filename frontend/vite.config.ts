import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        timeout: 140_000,
        proxyTimeout: 140_000,
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if (!res || !("writeHead" in res)) return;
            const outgoing = res as { headersSent?: boolean; writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void };
            if (outgoing.headersSent) return;
            outgoing.writeHead(504, { "Content-Type": "application/json; charset=utf-8" });
            outgoing.end(
              JSON.stringify({
                error: "PROXY_ERROR",
                message: "החיבור לשרת נקטע באמצע הניתוח. נסו שוב.",
              }),
            );
          });
        },
      },
      "/health": "http://127.0.0.1:3001",
      "/docs": "http://127.0.0.1:3001",
    },
  },
});
