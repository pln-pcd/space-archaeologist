// Typed intent bus + per-scene scopes (bible §5 step 8).
// Game code ONLY listens here. Gestures, mouse, touch and keyboard all emit the same intents.
import { useEffect, useRef, useSyncExternalStore } from "react";
import { INTENT_VERB, VERBS, type IntentEvent, type IntentMap, type IntentName, type Source, type VerbId } from "./types";

export type ScopeOptions = {
  /** arrow keys / WASD move the walking explorer (base) */
  walk?: boolean;
  /** arrow keys move an on-screen cursor instead (aiming scenes) */
  keyboardCursor?: boolean;
};
type Scope = { id: number; verbs: Set<VerbId>; opts: ScopeOptions; label: string };
type Handler<K extends IntentName> = (e: IntentEvent<K>) => void;

/** Verbs active when no scene has pushed a scope (the base). */
export const BASE_VERBS: VerbId[] = ["pointer", "pinch", "palmHold", "swipe"];
const BASE_SET = new Set<VerbId>(BASE_VERBS);

class IntentBus {
  private listeners = new Map<IntentName, Set<Handler<IntentName>>>();
  private any = new Set<Handler<IntentName>>();
  private scopes: Scope[] = [];
  private scopeListeners = new Set<() => void>();
  private nextId = 1;
  lastSource: Source = "mouse";
  private sourceListeners = new Set<() => void>();
  /** total intents emitted per name, for the playground */
  counts: Partial<Record<IntentName, number>> = {};

  emit<K extends IntentName>(name: K, payload: IntentMap[K], source: Source) {
    const verb = INTENT_VERB[name];
    if (verb && !this.enabled(verb)) return false;
    if (source !== this.lastSource && name !== "pointer") {
      this.lastSource = source;
      this.sourceListeners.forEach((f) => f());
    }
    const e = { ...payload, name, source, t: performance.now() } as IntentEvent<K>;
    this.counts[name] = (this.counts[name] ?? 0) + 1;
    this.listeners.get(name)?.forEach((h) => h(e as IntentEvent<IntentName>));
    this.any.forEach((h) => h(e as IntentEvent<IntentName>));
    return true;
  }
  on<K extends IntentName>(name: K, h: Handler<K>) {
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    set.add(h as Handler<IntentName>);
    return () => void set!.delete(h as Handler<IntentName>);
  }
  onAny(h: Handler<IntentName>) {
    this.any.add(h);
    return () => void this.any.delete(h);
  }

  // ---- scopes ----
  pushScope(verbs: VerbId[], opts: ScopeOptions = {}, label = "scene") {
    const s: Scope = { id: this.nextId++, verbs: new Set<VerbId>(["pointer", ...verbs]), opts, label };
    this.scopes.push(s);
    this.notifyScope();
    return () => {
      this.scopes = this.scopes.filter((x) => x.id !== s.id);
      this.notifyScope();
    };
  }
  private top(): Scope | null {
    return this.scopes[this.scopes.length - 1] ?? null;
  }
  private cache: Set<VerbId> = BASE_SET;
  /** stable reference until the scope changes (safe for useSyncExternalStore) */
  activeVerbs(): Set<VerbId> {
    return this.cache;
  }
  options(): ScopeOptions {
    return this.top()?.opts ?? { walk: true };
  }
  label() {
    return this.top()?.label ?? "base";
  }
  enabled(v: VerbId) {
    return this.activeVerbs().has(v);
  }
  private notifyScope() {
    this.cache = this.top()?.verbs ?? BASE_SET;
    this.scopeListeners.forEach((f) => f());
  }
  subscribeScope = (f: () => void) => {
    this.scopeListeners.add(f);
    return () => void this.scopeListeners.delete(f);
  };
  subscribeSource = (f: () => void) => {
    this.sourceListeners.add(f);
    return () => void this.sourceListeners.delete(f);
  };
}

export const intents = new IntentBus();
export const ALL_VERBS: VerbId[] = [...VERBS];

/** Listen to one intent. The handler can change every render; the subscription stays put. */
export function useIntent<K extends IntentName>(name: K, handler: Handler<K>, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    return intents.on(name, (e) => ref.current(e));
  }, [name, active]);
}

/** While mounted, only these verbs fire (plus pointer and navigation helpers). */
export function useIntentScope(verbs: VerbId[] | null, opts: ScopeOptions = {}, label = "scene") {
  const key = verbs ? verbs.join(",") + JSON.stringify(opts) : "";
  useEffect(() => {
    if (!verbs) return;
    return intents.pushScope(verbs, opts, label);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useActiveVerbs() {
  return useSyncExternalStore(intents.subscribeScope, () => intents.activeVerbs());
}
export function useLastSource() {
  return useSyncExternalStore(intents.subscribeSource, () => intents.lastSource);
}
