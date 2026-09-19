import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 overflow-hidden rounded-xl bg-surface">
          <div className="h-1 w-full bg-critical" />
          <div className="px-5 py-4">
            <h2 className="text-base font-semibold">Terjadi kesalahan</h2>
            <p className="mt-1.5 text-sm text-ink-2">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 min-h-10 rounded-lg bg-ink px-4 text-sm font-medium text-plane hover:opacity-90"
            >
              Muat ulang
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
