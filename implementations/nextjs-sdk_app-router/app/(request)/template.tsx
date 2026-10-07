import { RequestPageTracker } from '@/lib/optimization'
import type { ReactNode } from 'react'

export default function RequestTemplate({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <RequestPageTracker />
      {children}
    </>
  )
}
