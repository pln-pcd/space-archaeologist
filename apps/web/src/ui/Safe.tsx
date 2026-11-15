// v8: a crash guard. If anything inside throws while rendering, the rest of the game keeps running
// (no black screen); `onError` lets the parent close a card or move on.
import { Component, type ReactNode } from "react";

export default class Safe extends Component<{ children: ReactNode; onError?: () => void; fallback?: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  componentDidCatch(e: unknown) {
    console.error("[safe]", e);
    setTimeout(() => this.props.onError?.(), 0);
  }
  render() {
    return this.state.err ? (this.props.fallback ?? null) : this.props.children;
  }
}
