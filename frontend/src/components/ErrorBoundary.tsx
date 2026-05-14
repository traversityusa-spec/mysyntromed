import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const p = this as Component<Props, State>;
    const { fallback, children } = p.props;
    if (this.state.hasError) {
      if (fallback) {
        return fallback;
      }
      return (
        <div className="p-6 bg-red-50 text-red-900 rounded-lg border border-red-200">
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-[400px]">
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return children;
  }
}
