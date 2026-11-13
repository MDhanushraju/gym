import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[500px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#FFFFFF] rounded-2xl border border-[#E2D9F3] p-6 text-center shadow-lg space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#EDE9FE] text-[#7F00FF] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#2F3159]">Session Notice</h2>
            <p className="text-sm text-[#696C92]">
              A temporary display error occurred. The tracking engine and session data remain safe.
            </p>
            {this.state.error && (
              <details className="text-left text-[11px] text-[#DC2626] bg-[#FEF2F2] p-2.5 rounded-xl border border-[#FECACA] max-h-36 overflow-auto">
                <summary className="font-semibold cursor-pointer text-[#B91C1C]">Error Details</summary>
                <pre className="mt-1 font-mono text-[10px] whitespace-pre-wrap break-all">
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-full bg-[#7F00FF] hover:bg-[#6E00DE] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Session</span>
              </button>
              {this.props.onReset && (
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    this.props.onReset();
                  }}
                  className="px-4 py-2.5 rounded-full bg-[#F3F0FF] hover:bg-[#EDE9FE] text-[#2F3159] font-bold text-xs flex items-center gap-1.5 transition-all"
                >
                  <Home className="w-4 h-4" />
                  <span>Return Home</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

