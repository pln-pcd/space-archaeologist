import "./fx/capture";
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import OdysseyApp from "./odyssey/OdysseyApp";
import { attachFallbacks } from "./input/fallbacks";
import { watchNameLeaks } from "./profile/privacy";
import "./content/check";
import "@fontsource/lexend/400.css";
import "@fontsource/lexend/500.css";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/stylish/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/bigelow-rules/400.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "./style.css";
import "./fx/quiet.css";
// (new flow) the Mistwood look is replaced by the after-p2 style + additions (odyssey/odyssey.css)
import "./fx/eases";
import { SwirlLayer } from "./fx/Swirl";
import { watchPaperCards } from "./ui/paperCards";
import { isLegacyStyle } from "./style/styleMode";

// a lost WebGL context draws black: log it (and how often) so a flicker can be traced
if (typeof window !== "undefined") {
  let lost = 0;
  window.addEventListener("webglcontextlost", () => console.warn(`[webgl] context lost (${++lost} this session)`), true);
}

if (typeof document !== "undefined") {
  if (isLegacyStyle()) {
    document.documentElement.classList.add("style-legacy");
  } else {
    document.documentElement.classList.remove("style-legacy");
  }
}

// dev pages load only on their own URL (kept out of the game bundle)
const DEV: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "/dev/avatar": () => import("./dev/AvatarLab"),
  "/dev/artifacts": () => import("./dev/ArtifactLab"),
  "/dev/gestures": () => import("./dev/GesturePlayground"),
  "/dev/audio": () => import("./dev/AudioLab"),
  "/dev/facts": () => import("./dev/FactsPage"),
  "/dev/kids": () => import("./dev/KidLab"),
  "/dev/loading": () => import("./dev/LoadingLab"),
  "/dev/nova": () => import("./dev/NovaLab"),
  "/dev/stt": () => import("./dev/SttBench"),
  "/dev/title": () => import("./dev/TitleLab"),
  "/dev/voices": () => import("./dev/VoiceLab"),
};
const devKey = Object.keys(DEV).find((k) => location.pathname.startsWith(k));
const DevPage = devKey ? lazy(DEV[devKey]) : null;

attachFallbacks();
watchNameLeaks();
watchPaperCards();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {DevPage ? (
      <Suspense fallback={null}>
        <DevPage />
      </Suspense>
    ) : (
      <OdysseyApp />
    )}
    <SwirlLayer />
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
