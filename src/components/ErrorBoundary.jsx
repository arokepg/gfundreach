import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log for debugging; you could pipe this to a logging service
    console.error('UI ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="card max-w-xl w-full p-6 text-center">
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
              Something went wrong
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              The page crashed while rendering. Try going back or reloading.
            </p>
            <details className="text-left">
              <summary className="cursor-pointer text-sm mb-2" style={{ color: 'var(--text)' }}>
                Error details
              </summary>
              <pre className="text-xs overflow-auto p-3 rounded" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text)' }}>
                {String(this.state.error)}
                {"\n\n"}
                {this.state.error?.stack || ''}
              </pre>
            </details>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 rounded bg-green-600 text-white"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
