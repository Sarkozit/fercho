import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component that catches rendering errors
 * and displays a visible error message on screen (useful for mobile debugging).
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '10px',
          backgroundColor: '#fef2f2',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#991b1b',
          maxHeight: '100vh',
          overflow: 'auto',
        }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 'bold' }}>
            ❌ Error en {this.props.fallbackTitle || 'la página'}
          </h2>
          <p style={{ margin: '0 0 8px', fontWeight: 'bold' }}>
            {this.state.error?.message}
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            backgroundColor: '#fff',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #fca5a5',
            fontSize: '11px',
            maxHeight: '300px',
            overflow: 'auto',
          }}>
            {this.state.error?.stack}
          </pre>
          {this.state.errorInfo && (
            <details style={{ marginTop: '10px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Component Stack
              </summary>
              <pre style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                backgroundColor: '#fff',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #fca5a5',
                fontSize: '11px',
                maxHeight: '200px',
                overflow: 'auto',
                marginTop: '6px',
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '12px',
              padding: '8px 20px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Recargar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
