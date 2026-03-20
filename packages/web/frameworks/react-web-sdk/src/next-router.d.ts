declare module 'next/router' {
  type NextPagesQuery = Record<string, string | string[] | undefined>

  export interface NextRouter {
    asPath: string
    isReady: boolean
    pathname: string
    query: NextPagesQuery
  }

  export function useRouter(): NextRouter
}
