'use client'

/**
 * Global error page for Arena 151
 * Catches unhandled errors and shows user-friendly fallback
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center max-w-md px-4">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-4xl font-black text-red-400 mb-4">
          Server Error
        </h1>
        <p className="text-slate-400 mb-2">
          Arena 151 encountered a temporary issue.
        </p>
        <p className="text-slate-500 text-sm mb-6">
          Our team has been notified and is investigating.
        </p>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all"
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-semibold transition-all"
          >
            Return to Arena
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-400">
              Error Details (dev only)
            </summary>
            <pre className="mt-2 p-4 bg-slate-900 rounded text-xs overflow-auto max-h-60">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
