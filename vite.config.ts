import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/** Dev-only: the F9 gesture recorder saves landmark JSON straight into tools/gesture-recordings/. */
function gestureRecordings(): Plugin {
  return {
    name: "gesture-recordings",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__gesture-recordings/", (req, res) => {
        if (req.method !== "POST") return void (res.statusCode = 405, res.end());
        const name = decodeURIComponent((req.url ?? "").replace(/^\//, ""));
        if (!/^[\w.-]+\.json$/.test(name)) return void (res.statusCode = 400, res.end());
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            JSON.parse(body);
            mkdirSync("tools/gesture-recordings", { recursive: true });
            writeFileSync(`tools/gesture-recordings/${name}`, body);
            res.statusCode = 200;
          } catch {
            res.statusCode = 400;
          }
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  root: "apps/web",
  plugins: [react(), gestureRecordings()],
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          vision: ["@mediapipe/tasks-vision"],
        },
      },
    },
  },
  // npm run dev:lan serves HTTPS (needed for the mic and camera on phones and tablets)
  server: {
    proxy: { "/api": "http://127.0.0.1:8000" },
    ...(process.env.ODYSSEY_HTTPS ? { https: { key: readFileSync(".certs/key.pem"), cert: readFileSync(".certs/cert.pem") } } : {}),
  },
  worker: { format: "es" },
  test: { include: ["../../tests/**/*.test.ts"] },
} as any);
