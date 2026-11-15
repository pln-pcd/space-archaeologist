// Builds the game's scene modules into one ES module for the HyperFrames compositions.
// npm run cutscene:build  →  hyperframes/_shared/dist/scenes.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("../../apps/web"),
  publicDir: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: here("./dist"),
    emptyOutDir: true,
    sourcemap: false,
    lib: { entry: here("../../apps/web/src/scenes/shared/hfEntry.tsx"), formats: ["es"], fileName: () => "scenes.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
