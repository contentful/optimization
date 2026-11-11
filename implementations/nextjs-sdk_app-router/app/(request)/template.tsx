import { RequestPageTracker } from '@/lib/optimization'
import { Suspense, type ReactNode } from 'react'

export default function RequestTemplate({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <Suspense fallback={null}>
        <RequestPageTracker />
      </Suspense>
      {children}
    </>
  )
}
