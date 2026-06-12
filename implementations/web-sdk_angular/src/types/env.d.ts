interface ImportMetaEnv {
  readonly PUBLIC_NINETAILED_CLIENT_ID?: string
  readonly PUBLIC_NINETAILED_ENVIRONMENT?: string
  readonly PUBLIC_INSIGHTS_API_BASE_URL?: string
  readonly PUBLIC_EXPERIENCE_API_BASE_URL?: string
  readonly PUBLIC_CONTENTFUL_TOKEN?: string
  readonly PUBLIC_CONTENTFUL_PREVIEW_TOKEN?: string
  readonly PUBLIC_CONTENTFUL_ENVIRONMENT?: string
  readonly PUBLIC_CONTENTFUL_SPACE_ID?: string
  readonly PUBLIC_CONTENTFUL_CDA_HOST?: string
  readonly PUBLIC_CONTENTFUL_BASE_PATH?: string
  readonly PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL?: string
  readonly PUBLIC_OPTIMIZATION_LOG_LEVEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
