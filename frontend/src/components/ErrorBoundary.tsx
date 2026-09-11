/* Keeps one bad page from blanking the whole app: the shell, sidebar and
   navigation stay usable while the failed route shows a recoverable message. */
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // navigating away from a broken route clears the error
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="card mx-auto mt-6 max-w-lg p-8 text-center">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-bad-soft text-bad">
          <AlertTriangle size={20} />
        </span>
        <h2 className="text-[17px] font-semibold">This page hit an error</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          The rest of the app is still fine — use the sidebar to carry on, or try loading this page again.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-page px-3 py-2 text-left text-xs text-muted">
          {error.message}
        </pre>
        <button className="btn-primary mt-5" onClick={() => this.setState({ error: null })}>
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    );
  }
}
