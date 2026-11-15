// Phase-scoped UI checks. The complete, non-injected playthrough lives in missions.spec.ts.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { findOverlaps } from "./overlap_lib.mjs";
const phase = Number(
  process.argv.find((a) => a.startsWith("--phase="))?.split("=")[1] ?? 8,
);
const overlap = process.argv.includes("--overlap");
const out = `docs/audit/v5/phase-${phase}/${overlap ? "overlap" : "flow"}`;
mkdirSync(out, { recursive: true });
const routes = [
  ["cover", "/"],
  ["hub", "/?screen=dashboard"],
  ...(phase >= 3
    ? [
        ["hub-stations", "/?screen=dashboard"],
        ["hub-records", "/?screen=dashboard"],
        ["hub-chart", "/?screen=dashboard"],
      ]
    : []),
  ...(phase >= 2 ? [["avatar", "/dev/avatar"]] : []),
  ...(phase >= 4
    ? [
        ["briefing", "/?mission=moon-001&step=04"],
        ["exploration", "/?mission=moon-001&step=05"],
      ]
    : []),
  ...(phase >= 5
    ? [
        ["investigation", "/?mission=moon-001&artifact=retroreflector"],
        ["inspection-record", "/?mission=moon-001&artifact=retroreflector"],
        ["evidence", "/?mission=moon-001&step=07"],
        ["evidence-matched", "/?mission=moon-001&step=07"],
      ]
    : []),
  ...(phase >= 6
    ? [
        ["reconstruction", "/?mission=moon-001&step=08"],
        ["reconstruction-replay", "/?mission=moon-001&step=08"],
      ]
    : []),
  ...(phase >= 7
    ? [
        ["discovery", "/?mission=moon-001&step=09"],
        ["challenge", "/?mission=moon-001&step=10"],
        ["rewards", "/?mission=moon-001&step=11"],
        ["archive", "/?mission=moon-001&step=12"],
      ]
    : []),
  ...(phase >= 8
    ? [
        ["artifact-lab", "/dev/artifacts"],
        [
          "judge-investigation",
          "/?mission=moon-001&artifact=retroreflector&judge=1",
        ],
        ["travel-video", "/?mission=moon-001&step=04"],
        ["travel-launch", "/?mission=moon-001&step=04"],
        ["travel-story", "/?mission=moon-001&step=04&judge=1"],
      ]
    : []),
];
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11", "--ignore-gpu-blocklist"],
});
const report = {};
// User steering: desktop only from phase 6 onward (1366x768 and 1920x1080).
for (const [size, width, height] of overlap
  ? [
      ["laptop", 1366, 768],
      ["desktop", 1920, 1080],
    ]
  : [["laptop", 1366, 768]]) {
  for (const [name, route] of routes) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 250));
    });
    page.on("request", (r) => requests.push(r.url()));
    await page.addInitScript(() => {
      window.__missionCameraCalls = 0;
      if (navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = async () => {
          window.__missionCameraCalls++;
          throw new Error("Camera requires explicit consent");
        };
      localStorage.clear();
      localStorage.setItem(
        "homeward-session-v1",
        JSON.stringify({
          version: 2,
          state: {
            profile: {
              nickname: "Orbit",
              playerName: "Orbit",
              playerPatch: "ORBIT",
              characterId: "maya",
              code: "qa",
              mode: "device",
              greeted: true,
            },
            progress: { completed: [], pages: {}, scores: {}, choices: {} },
            settings: {
              sound: false,
              novaVoice: false,
              askNova: false,
              aiNotice: true,
              talkMode: "chat",
              tutorialDone: true,
              reducedMotion: true,
            },
          },
        }),
      );
      localStorage.setItem(
        "odyssey-avatar-v5",
        JSON.stringify({
          base: "maya",
          suitColor: 0,
          skin: 3,
          hair: 0,
          helmet: 0,
          visor: 0,
          accessory: 0,
        }),
      );
    });
    try {
      await page.goto(`http://127.0.0.1:5173${route}`);
      await page.waitForSelector(
        name === "cover"
          ? ".od-start"
          : name.startsWith("hub")
            ? ".od-dash"
            : ".m-page,.m-exploration",
      );
      await page.waitForTimeout(name.startsWith("hub") ? 2200 : 600);
      if (name.startsWith("hub-")) {
        await page
          .getByRole("button", { name: "Ship stations", exact: true })
          .click();
        if (name === "hub-records")
          await page
            .getByRole("button", { name: "Mission Records", exact: true })
            .click();
        if (name === "hub-chart")
          await page
            .getByRole("button", { name: "Progress star chart", exact: true })
            .click();
      }
      if (name === "avatar") {
        await page.getByRole("button", { name: "Suit 2", exact: true }).click();
        await page
          .getByRole("button", { name: "Randomize", exact: true })
          .click();
      }
      if (name === "cover")
        await page.getByRole("button", { name: "Start the game" }).hover();
      if (name.startsWith("travel-")) {
        for (let n = 0; n < 4; n++)
          await page
            .getByRole("button", { name: "Next briefing", exact: true })
            .click();
        if (name !== "travel-video")
          await page
            .getByRole("button", { name: "Skip the video", exact: true })
            .click();
        if (name === "travel-story") {
          await page.getByRole("button", { name: "Skip", exact: true }).click();
          await page.waitForSelector(".od-caption [data-source-id]");
          await page
            .getByRole("button", { name: "Pause", exact: true })
            .click();
        }
      }
      if (name === "inspection-record") {
        await page.keyboard.down("e");
        await page.waitForTimeout(700);
        await page.keyboard.up("e");
        for (let n = 1; n <= 3; n++)
          await page
            .getByRole("button", { name: `Inspect clue ${n}`, exact: true })
            .click();
      }
      if (name === "evidence-matched") {
        for (const slot of [
          "component",
          "mission",
          "photo",
          "function",
          "reason",
        ]) {
          await page
            .getByRole("button", {
              name: `Choose evidence ${slot}`,
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: `Place evidence ${slot}`,
              exact: true,
            })
            .click();
        }
        for (const part of ["legs", "footpads"]) {
          await page
            .getByRole("button", {
              name: `Choose component ${part}`,
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: `Match function ${part}`,
              exact: true,
            })
            .click();
        }
      }
      if (name === "reconstruction-replay") {
        await page
          .getByRole("button", { name: "Grab ascent stage", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Snap onto descent stage", exact: true })
          .click();
        for (const id of ["descent", "ascent"])
          await page
            .getByRole("button", { name: `Assign ${id} function`, exact: true })
            .click();
        for (const id of [
          "undock",
          "descent",
          "landing",
          "moonwalk",
          "ascent",
          "dock",
        ])
          await page
            .getByRole("button", { name: `Timeline ${id}`, exact: true })
            .click();
        await page
          .getByRole("button", { name: "Next replay card", exact: true })
          .click();
      }
      await page.waitForTimeout(800);
      const cameraCalls = await page.evaluate(
        () => window.__missionCameraCalls ?? 0,
      );
      if (cameraCalls) errors.push("Camera used without opt-in");
      const overlaps = overlap ? await page.evaluate(findOverlaps) : [];
      await page.screenshot({ path: `${out}/${size}-${name}.png` });
      const thirdParty = requests.filter(
        (u) =>
          /^https?:/.test(u) &&
          !u.startsWith("http://127.0.0.1") &&
          !u.startsWith("http://localhost"),
      );
      if (thirdParty.length) errors.push("Third-party runtime request");
      report[`${size}/${name}`] = { errors, overlaps, thirdParty };
      console.log(
        `${size}/${name}: errors=${errors.length} overlaps=${overlaps.length}`,
      );
    } catch (e) {
      report[`${size}/${name}`] = {
        errors: [...errors, e.message],
        overlaps: [],
      };
      console.log(`${size}/${name}: FAILED ${e.message.slice(0, 180)}`);
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
process.exitCode = Object.values(report).some(
  (r) => r.errors.length || r.overlaps.length,
)
  ? 1
  : 0;
