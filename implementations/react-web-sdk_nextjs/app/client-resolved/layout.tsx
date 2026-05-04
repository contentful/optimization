import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'

export default function ClientResolvedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <ClientProviderWrapper>{children}</ClientProviderWrapper>
}
