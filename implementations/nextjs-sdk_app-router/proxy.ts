export { proxy } from './lib/optimization'

export const config = {
  matcher: [
    '/',
    '/page-two',
    '/hidden-until-ready',
    '/static-shell-private-slot',
    '/selection-handoff/:path*',
    '/analytics-only/:path*',
  ],
}
