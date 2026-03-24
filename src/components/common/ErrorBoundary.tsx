import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import type { Theme } from '../../theme';

interface Props {
  children: ReactNode;
  theme?: Theme;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[VibeSynth] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isDark = this.props.theme?.isDark ?? false;
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: isDark ? '#12121f' : '#FFF5EE',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          gap: 16,
          padding: 40,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>🎵</div>
          <h2 style={{ color: isDark ? '#FFB5A7' : '#B5736A', fontSize: 20, fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ color: isDark ? '#8878a0' : '#A89AAF', fontSize: 14, maxWidth: 400 }}>
            {this.state.error?.message ?? 'An unexpected error occurred in the synthesizer.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: `1.5px solid ${isDark ? '#3a5a4a' : '#B5EAD7'}`,
              background: isDark ? '#1a2a22' : '#D4F5E9',
              color: isDark ? '#8DD4B8' : '#5A8A72',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
