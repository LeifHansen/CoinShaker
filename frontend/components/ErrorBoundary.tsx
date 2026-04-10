"use client";

import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="glass-card rounded-xl p-6 text-center">
            <div className="text-2xl mb-2 opacity-30">{"\u26A0\uFE0F"}</div>
            <p className="text-white/40 text-sm">
              Something went wrong loading this section.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-3 text-ditto-teal text-xs hover:underline"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
