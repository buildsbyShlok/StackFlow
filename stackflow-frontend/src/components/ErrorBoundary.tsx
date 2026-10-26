import { Component } from "react";
import type { ReactNode } from "react";
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="boot-screen">
        <h1>Something interrupted your workspace.</h1>
        <p>Reload the page to try again. Your saved work is safe.</p>
        <button
          className="text-button"
          onClick={() => window.location.reload()}
        >
          Reload StackFlow
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
