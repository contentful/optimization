import { createCurrentRequestHandoff } from '@/lib/request-handoff'
import type { ReactNode } from 'react'

export async function RequestRouteShell({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  await createCurrentRequestHandoff()

  return children
}
