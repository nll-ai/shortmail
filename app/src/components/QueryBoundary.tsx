"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Wraps client components that subscribe to Convex queries. When a query
 * throws (today: "Unauthenticated" until the WorkOS JWT template gains the
 * `aud`/`email` claims — issue #22), render a readable notice instead of
 * crashing the page.
 */
export class QueryBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Setting up your data…</p>
          <p className="mt-1">
            Retrying automatically ({this.state.error.message}).
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
