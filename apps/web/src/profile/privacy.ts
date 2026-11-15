// Dev check (bible §21): the explorer name stays on this computer. In development, warn loudly if
// it ever shows up in a fetch or XHR URL or body (analytics, logs, APIs). Never runs in production.
import { useStore } from "../store";

function leaks(text: string) {
  const p = useStore.getState().profile;
  const name = p?.playerName;
  if (!name || name.length < 2) return false;
  const t = text.toLowerCase();
  return t.includes(name.toLowerCase()) || (!!p?.playerPatch && t.includes(encodeURIComponent(p.playerPatch).toLowerCase()));
}
const warn = (where: string) => console.warn(`[privacy] the explorer name appeared in a ${where}. It must never leave this computer.`);

export function watchNameLeaks() {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const f = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const body = typeof init?.body === "string" ? init.body : "";
      // the one allowed place: our OWN local voice server says "{name}" lines (private, never forwarded)
      const local = url.startsWith("/api/nova/speak") && body.includes('"private":true');
      if (!local && leaks(decodeURIComponent(url) + " " + body)) warn("fetch request");
    } catch {
      /* never break a request */
    }
    return f(input, init);
  };
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    try {
      if (leaks(decodeURIComponent(String(url)))) warn("XHR URL");
    } catch {
      /* ignore */
    }
    return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    try {
      if (typeof body === "string" && leaks(body)) warn("XHR body");
    } catch {
      /* ignore */
    }
    return send.call(this, body);
  };
}
