import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-semibold mb-4">Optimization Next.js Reference Implementation</h1>
      <p className="text-zinc-600 max-w-lg text-center">
        This implementation demonstrates two integration patterns with the Contentful Optimization
        SDKs in a Next.js App Router application.
      </p>
      <nav className="mt-8 flex gap-4">
        <Link
          href="/client-resolved"
          className="rounded-lg border border-zinc-200 px-4 py-2 hover:bg-zinc-50 transition-colors"
        >
          Client-Resolved
        </Link>
        <Link
          href="/server-resolved"
          className="rounded-lg border border-zinc-200 px-4 py-2 hover:bg-zinc-50 transition-colors"
        >
          Server-Resolved
        </Link>
      </nav>
    </main>
  )
}
