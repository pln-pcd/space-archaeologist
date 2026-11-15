// The video capture hook (apps/web/src/fx/capture.ts) must have zero effect on normal play.
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("does nothing when the page has no ?capture flag", async () => {
  vi.stubGlobal("location", { search: "?screen=dashboard" });
  const now = performance.now;
  const st = globalThis.setTimeout;
  const raf = (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
  const rnd = Math.random;
  const mod = await import("../apps/web/src/fx/capture");
  expect(mod.captureOn).toBe(false);
  expect(() => mod.capLog("sfx", "pop")).not.toThrow();
  expect(performance.now).toBe(now);
  expect(globalThis.setTimeout).toBe(st);
  expect((globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame).toBe(raf);
  expect(Math.random).toBe(rnd);
  expect((globalThis as { __capture?: unknown }).__capture).toBeUndefined();
});

it("does nothing outside a browser", async () => {
  vi.stubGlobal("location", undefined);
  const mod = await import("../apps/web/src/fx/capture");
  expect(mod.captureOn).toBe(false);
});
