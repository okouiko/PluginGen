import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-canvas">
          <div className="p-xl text-center">
            <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-full bg-warning/10">
              <span className="text-2xl text-warning">⚠</span>
            </div>
            <h1 className="font-display text-display-sm text-ink mb-md">出错了</h1>
            <p className="font-sans text-body-md text-body mb-lg">
              页面遇到了意外错误，请刷新后重试。
            </p>
            <p className="font-mono text-body-sm text-muted mb-lg max-w-md">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
