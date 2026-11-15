// The demo video's gameplay shots, captured from the current build (see lib.mjs).
//   node video/capture/shots.mjs <shot> [<shot> ...]   or   all
// Needs `npm run dev` (Vite on 5173 and the Nova server on 8000).
import { launch, seed, open, Rec, W, H } from "./lib.mjs";

const SHOTS = {};

// S01: the title screen, START, Nova's short tour, a nickname and the explorer designer
SHOTS.onboarding = async () => {
  const { browser, page, errors } = await launch();
  await seed(page, { fresh: true });
  await open(page, "", 7000);
  const r = await new Rec(page, "onboarding").start();
  r.mark("title");
  await r.hold(2.5);
  await r.tap("Start the game", { move: 0.8 });
  r.mark("intro");
  await r.hold(1.6);
  for (let i = 0; i < 3; i++) {
    await r.tap("Next", { move: 0.45, after: 0.9 });
  }
  await r.tap("Let's go!", { move: 0.45, after: 0.9 });
  r.mark("name");
  const input = await r.box("input");
  await r.click(input.x, input.y, { move: 0.5, after: 0.2 });
  await r.type("Luna", 0.12);
  await r.hold(0.4);
  await r.tap("Let's go!", { move: 0.5, after: 1.4 });
  r.mark("designer");
  await r.hold(0.8);
  await r.tap("Suit: Sky", { move: 0.6, after: 0.7 });
  await r.tap("Suit: Lilac", { move: 0.5, after: 0.7 });
  await r.tap("Helmet", { move: 0.5, after: 0.9 });
  const tiles = page.locator(".dsg-grid button, [class*=grid] [aria-label^='Helmet:']");
  if (await tiles.count()) {
    const b = await r.box(tiles.nth(2));
    await r.click(b.x, b.y, { move: 0.5, after: 0.8 });
  }
  await r.tap("I'm ready!", { move: 0.6, after: 0.2 });
  r.mark("warp");
  r.showCursor(false);
  await r.hold(3.2);
  r.mark("ship");
  await r.hold(4.5);
  await r.finish({ errors });
  await browser.close();
};

const which = process.argv.slice(2);
const list = which[0] === "all" ? Object.keys(SHOTS) : which;
for (const name of list) {
  if (!SHOTS[name]) throw new Error("no shot " + name);
  const t = Date.now();
  await SHOTS[name]();
  console.log(`  (${((Date.now() - t) / 1000).toFixed(0)} s real time)`);
}
