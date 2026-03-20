import type { NextRouter } from 'next/router'
import { useRouter } from 'next/router'

export function useNextPagesRouter(): NextRouter {
  return useRouter()
}
