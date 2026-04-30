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
        <div className="m-4 rounded-2xl bg-red-50 p-6 text-red-900 dark:bg-red-950 dark:text-red-100">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm">{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
