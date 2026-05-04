import Link from 'next/link'

export default function ServerResolvedPage() {
  return (
    <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-2">Server-Resolved Pattern</h1>
      <p className="text-zinc-500 mb-6">
        Entries are pre-resolved on the server via the Node SDK and passed as props to client
        components for hydration. This pattern will be implemented in Phase 3.
      </p>
      <Link
        href="/"
        className="rounded-lg border border-zinc-200 px-4 py-2 hover:bg-zinc-50 transition-colors"
      >
        Back to Home
      </Link>
    </main>
  )
}
