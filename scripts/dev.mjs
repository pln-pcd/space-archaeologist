// npm run dev      → the Vite game (http://127.0.0.1:5173) + the Nova server (127.0.0.1:8000)
// npm run dev:lan  → the same on your network over HTTPS (phones and tablets need HTTPS for the
//                    microphone and camera). A self-signed certificate is made once in .certs/;
//                    each device has to accept it the first time.
// The server is optional: without Python, or without an API key, the game still runs (Nova answers
// from the game's fact sheet and speaks with pre-rendered clips).
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

const lan = process.argv.includes("--lan");
const env = { ...process.env };
if (lan) {
  mkdirSync(".certs", { recursive: true });
  if (!existsSync(".certs/key.pem")) {
    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "365", "-subj", "/CN=starship-odyssey.local", "-keyout", ".certs/key.pem", "-out", ".certs/cert.pem"], { stdio: "inherit" });
    } catch {
      console.error("[dev:lan] openssl is needed to make a local certificate (it comes with Git for Windows).");
      process.exit(1);
    }
  }
  env.ODYSSEY_HTTPS = "1";
}

const procs = [];
const run = (name, cmd, args) => {
  const p = spawn(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  p.on("exit", (code) => {
    if (name === "vite") {
      procs.forEach((q) => q !== p && q.kill());
      process.exit(code ?? 0);
    } else if (code) console.warn(`[dev] the Nova server stopped (code ${code}). The game keeps working offline.`);
  });
  procs.push(p);
};
const py = process.platform === "win32" ? "python" : "python3";
// --reload: edits to server/ apply without restarting npm run dev
run("server", py, ["-m", "uvicorn", "server.app:app", "--host", "127.0.0.1", "--port", "8000", "--no-access-log", "--reload", "--reload-dir", "server"]);
run("vite", "npx", ["vite", "--host", lan ? "0.0.0.0" : "127.0.0.1"]);
process.on("SIGINT", () => procs.forEach((p) => p.kill()));
