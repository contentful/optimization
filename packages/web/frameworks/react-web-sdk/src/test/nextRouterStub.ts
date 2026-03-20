export interface NextRouterStub {
  asPath: string
  isReady: boolean
  pathname: string
  query: Record<string, string | string[] | undefined>
}

export function useRouter(): NextRouterStub {
  throw new Error('next/router is not available in this test environment.')
}
