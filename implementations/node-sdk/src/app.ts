import ContentfulOptimization, { type OptimizationNodeConfig } from '@contentful/optimization-node'
import {
  isMergeTagEntry,
  type OptimizationData,
  type SelectedOptimization,
} from '@contentful/optimization-node/api-schemas'
import type {
  EventEmissionResult,
  UniversalEventBuilderArgs,
} from '@contentful/optimization-node/core-sdk'
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { INLINES, type Document } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import * as contentful from 'contentful'
import express, { type Express, type Request } from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import type { ParsedQs } from 'qs'
import type {
  TypeContentSkeleton,
  TypeMergeTagContentSkeleton,
  TypeNestedContentSkeleton,
} from './contentful-generated'

const limiter = rateLimit({
  windowMs: 30_000,
  max: 1000,
})

const app: Express = express()
app.use(limiter)
const APP_LOCALE = 'en-US'

app.set('view engine', 'ejs') // configure EJS as the view engine
app.set('views', path.join(__dirname, '.')) // define the directory for view templates

const optimizationConfig: OptimizationNodeConfig = {
  clientId: process.env.PUBLIC_NINETAILED_CLIENT_ID ?? '',
  environment: process.env.PUBLIC_NINETAILED_ENVIRONMENT ?? '',
  logLevel: 'debug',
  locale: APP_LOCALE,
  api: {
    insightsBaseUrl: process.env.PUBLIC_INSIGHTS_API_BASE_URL,
    experienceBaseUrl: process.env.PUBLIC_EXPERIENCE_API_BASE_URL,
  },
}

const sdk = new ContentfulOptimization(optimizationConfig)

const ctflConfig: contentful.CreateClientParams = {
  accessToken: process.env.PUBLIC_CONTENTFUL_TOKEN ?? '',
  environment: process.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? '',
  space: process.env.PUBLIC_CONTENTFUL_SPACE_ID ?? '',
  host: process.env.PUBLIC_CONTENTFUL_CDA_HOST ?? '',
  basePath: process.env.PUBLIC_CONTENTFUL_BASE_PATH ?? '',
  insecure: Boolean(process.env.PUBLIC_CONTENTFUL_CDA_HOST),
}

const ctfl = contentful.createClient(ctflConfig)

type ContentEntrySkeleton =
  | TypeContentSkeleton
  | TypeMergeTagContentSkeleton
  | TypeNestedContentSkeleton
type ContentEntry = Entry<ContentEntrySkeleton>

function getCachedEntryKey(entryId: string, locale: string): string {
  return `${locale}:${entryId}`
}

async function getContentfulEntry(
  entryId: string,
  locale: string,
): Promise<ContentEntry | undefined> {
  try {
    return await ctfl.getEntry<ContentEntrySkeleton>(entryId, {
      include: 10,
      locale,
    })
  } catch (_error) {}
}

async function getCachedContentfulEntry(
  entryId: string,
  locale: string,
): Promise<ContentEntry | undefined> {
  const cacheKey = getCachedEntryKey(entryId, locale)
  const cachedEntry = cachedEntries.get(cacheKey)

  if (cachedEntry) {
    return cachedEntry
  }

  const entry = await getContentfulEntry(entryId, locale)
  if (entry) {
    cachedEntries.set(cacheKey, entry)
  }

  return entry
}

function cloneContentEntry(entry: ContentEntry): ContentEntry {
  return structuredClone(entry)
}

function isNonEmptyString(s?: unknown): s is string {
  return s !== undefined && typeof s === 'string' && s.trim().length > 0
}

function isRichText(field?: unknown): field is Document {
  return (
    typeof field === 'object' &&
    field !== null &&
    'nodeType' in field &&
    field.nodeType === 'document'
  )
}

function getAcceptedOptimizationData(result: EventEmissionResult): OptimizationData | undefined {
  return result.accepted ? result.data : undefined
}

const entryIds: string[] = [
  '1MwiFl4z7gkwqGYdvCmr8c', // Rich Text field Entry with Merge Tag
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  '2Z2WLOx07InSewC3LUB3eX',
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
]

const cachedEntries = new Map<string, ContentEntry>()

type QsPrimitive = string | ParsedQs
type QsArray = QsPrimitive[] // Note: mixed arrays are allowed by ParsedQs
type QsValue = QsPrimitive | QsArray | undefined

function toStringValue(value: QsValue): string | null {
  if (value === undefined) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const items = value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
    return items.join(',')
  }
  // value is a ParsedQs object
  return JSON.stringify(value)
}

export function getQueryRecordFromRequest(qs: ParsedQs): Record<string, string> {
  return Object.keys(qs).reduce<Record<string, string>>((acc, key) => {
    const str = toStringValue(qs[key])
    if (str !== null) {
      acc[key] = str
    }
    return acc
  }, {})
}

function getUniversalEventBuilderArgs(
  req: Request,
  eventLocale: string,
): UniversalEventBuilderArgs {
  const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
  return {
    locale: eventLocale,
    userAgent: req.get('User-Agent') ?? 'node-js-server',
    page: {
      path: req.path,
      query: getQueryRecordFromRequest(req.query),
      referrer: req.get('Referer') ?? '',
      search: url.search,
      url: req.url,
    },
  }
}

app.get('/', limiter, async (req, res) => {
  const universalEventBuilderArgs = getUniversalEventBuilderArgs(req, APP_LOCALE)
  const requestOptimization = sdk.forRequest({
    consent: true,
    eventContext: universalEventBuilderArgs,
    locale: APP_LOCALE,
  })

  const userId = isNonEmptyString(req.query.userId) ? req.query.userId.trim() : undefined
  const optimizationResponse: OptimizationData | undefined = isNonEmptyString(userId)
    ? await (async (): Promise<OptimizationData> => {
        const pageResponse = getAcceptedOptimizationData(await requestOptimization.page())
        const identifyResponse = getAcceptedOptimizationData(
          await requestOptimization.identify({
            userId,
            traits: { identified: true },
          }),
        )

        return identifyResponse ?? pageResponse ?? failOptimizationResponse()
      })()
    : getAcceptedOptimizationData(await requestOptimization.page())

  if (optimizationResponse === undefined) {
    throw new Error('Expected Optimization data for consented Node SDK request.')
  }

  const { profile, selectedOptimizations } = optimizationResponse

  const optimizedEntries = new Map<
    string,
    {
      entry: ContentEntry
      selectedOptimization?: SelectedOptimization
    }
  >()

  const baselineEntryResults = await Promise.all(
    entryIds.map(
      async (entryId) => [entryId, await getCachedContentfulEntry(entryId, APP_LOCALE)] as const,
    ),
  )

  baselineEntryResults.forEach(([entryId, cachedEntry]) => {
    if (!cachedEntry) return

    const optimizedEntry = sdk.resolveOptimizedEntry<ContentEntrySkeleton>(
      cloneContentEntry(cachedEntry),
      selectedOptimizations,
    )

    if (isRichText(optimizedEntry.entry.fields.text)) {
      optimizedEntry.entry.fields.text = documentToHtmlString(optimizedEntry.entry.fields.text, {
        renderNode: {
          [INLINES.EMBEDDED_ENTRY]: (node) => {
            if (isMergeTagEntry(node.data.target)) {
              return sdk.getMergeTagValue(node.data.target, profile) ?? ''
            } else {
              return ''
            }
          },
        },
      })
    }

    optimizedEntries.set(entryId, optimizedEntry)
  })

  const pageData = {
    profile,
    selectedOptimizations,
    entries: optimizedEntries,
  }

  res.render('index', { ...pageData })
})

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app

function failOptimizationResponse(): never {
  throw new Error('Expected Optimization data for consented Node SDK request.')
}
