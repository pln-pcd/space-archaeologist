// Content checks that WARN but never block a build (bible §0, §16).
import { spawnSync } from "node:child_process";
const py = process.platform === "win32" ? "python" : "python3";
for (const script of ["tools/compile_content.py", "tools/verify_facts.py"]) {
  const r = spawnSync(py, [script], { stdio: "inherit" });
  if (r.status !== 0) console.warn(`⚠ ${script} reported problems (warning only, build continues).`);
}
