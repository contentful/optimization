import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'

export default function ServerResolvedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <ClientProviderWrapper>{children}</ClientProviderWrapper>
}
