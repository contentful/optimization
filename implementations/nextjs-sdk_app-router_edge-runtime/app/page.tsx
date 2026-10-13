import Link from 'next/link'

export default function HomePage() {
  return (
    <main>
      <h1>Next.js Edge runtime reference implementation</h1>
      <nav aria-label="Edge examples">
        <Link href="/edge-render/private" prefetch={false}>
          Personalized Edge request
        </Link>
        <Link href="/edge-render/public/new-visitor" prefetch={false}>
          Public new-visitor selection
        </Link>
        <Link href="/edge-render/public/baseline" prefetch={false}>
          Public baseline selection
        </Link>
      </nav>
    </main>
  )
}
