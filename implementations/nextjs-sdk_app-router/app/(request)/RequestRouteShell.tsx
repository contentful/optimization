import type { ReactNode } from 'react'
import { createCurrentRequestHandoff } from './request-handoff'

export async function RequestRouteShell({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  await createCurrentRequestHandoff()

  return children
}
