export interface ConsentController {
  consent: (accept: boolean) => void
}

export interface ConsentGuard {
  // TODO: Determine whether these methods can be hard-private
  hasConsent: (name: string) => boolean
  onBlockedByConsent: (name: string, args: unknown[]) => void
}
