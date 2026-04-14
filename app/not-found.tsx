/**
 * Custom 404 page for Arena 151
 */

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center max-w-md px-4">
        <div className="text-6xl mb-6">🔍</div>
        <h1 className="text-4xl font-black text-amber-400 mb-4">
          Page Not Found
        </h1>
        <p className="text-slate-400 mb-2">
          This route doesn't exist in Arena 151.
        </p>
        <p className="text-slate-500 text-sm mb-6">
          The page you're looking for may have been moved or deleted.
        </p>
        
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all"
        >
          Return to Arena
        </a>
      </div>
    </div>
  )
}
