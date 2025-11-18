import Optimization, {
  type OptimizationData,
  type OptimizationNodeConfig,
  type SelectedPersonalization,
  type UniversalEventBuilderArgs,
} from '@contentful/optimization-node'
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { INLINES, type Document } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import * as contentful from 'contentful'
import express, { type Express, type Request } from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import type { ParsedQs } from 'qs'

const limiter = rateLimit({
  windowMs: 30_000,
  max: 1000,
})

const app: Express = express()
app.use(limiter)

app.set('view engine', 'pug') // configure Pug as the view engine
app.set('views', path.join(__dirname, '.')) // define the directory for view templates

const optimizationConfig: OptimizationNodeConfig = {
  clientId: process.env.VITE_NINETAILED_CLIENT_ID ?? '',
  environment: process.env.VITE_NINETAILED_ENVIRONMENT ?? '',
  logLevel: 'debug',
  api: {
    analytics: { baseUrl: process.env.VITE_INSIGHTS_API_BASE_URL },
    personalization: { baseUrl: process.env.VITE_EXPERIENCE_API_BASE_URL },
  },
}

const sdk = new Optimization(optimizationConfig)

const ctflConfig: contentful.CreateClientParams = {
  accessToken: process.env.VITE_CONTENTFUL_TOKEN ?? '',
  environment: process.env.VITE_CONTENTFUL_ENVIRONMENT ?? '',
  space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
  host: process.env.VITE_CONTENTFUL_CDA_HOST ?? '',
  basePath: process.env.VITE_CONTENTFUL_BASE_PATH ?? '',
  insecure: Boolean(process.env.VITE_CONTENTFUL_CDA_HOST),
}

const ctfl = contentful.createClient(ctflConfig)

interface ContentEntrySkeleton {
  contentTypeId: 'content'
  fields: {
    text: contentful.EntryFieldTypes.Text | contentful.EntryFieldTypes.RichText
  }
}

async function getContentfulEntry(
  entryId: string,
): Promise<Entry<ContentEntrySkeleton> | undefined> {
  try {
    return await ctfl.getEntry<ContentEntrySkeleton>(entryId, {
      include: 10,
    })
  } catch (_error) {}
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

const entryIds: string[] = [
  '1MwiFl4z7gkwqGYdvCmr8c', // Rich Text field Entry with Merge Tag
  '4ib0hsHWoSOnCVdDkizE8d',
  'xFwgG3oNaOcjzWiGe4vXo',
  '2Z2WLOx07InSewC3LUB3eX',
  '5XHssysWUDECHzKLzoIsg1',
  '6zqoWXyiSrf0ja7I2WGtYj',
  '7pa5bOx8Z9NmNcr7mISvD',
]

const entries = new Map<string, Entry<ContentEntrySkeleton>>()

Promise.all(
  entryIds.map(async (entryId) => {
    const entry = await getContentfulEntry(entryId)
    if (!entry) return
    entries.set(entryId, entry)
  }),
).catch((error: unknown) => {
  // eslint-disable-next-line no-console -- debug
  console.log(error)
})

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

function getUniversalEventBuilderArgs(req: Request): UniversalEventBuilderArgs {
  const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl)
  return {
    locale: req.acceptsLanguages()[0] ?? 'en-US',
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
  const universalEventBuilderArgs = getUniversalEventBuilderArgs(req)

  const userId = isNonEmptyString(req.query.userId) ? req.query.userId.trim() : undefined

  let optimizationResponse: OptimizationData | undefined = undefined

  if (isNonEmptyString(userId)) {
    const pageResponse = await sdk.personalization.page({
      ...universalEventBuilderArgs,
    })
    optimizationResponse = await sdk.personalization.identify({
      ...universalEventBuilderArgs,
      userId,
      traits: { identified: true },
      profile: pageResponse.profile,
    })
  } else {
    optimizationResponse = await sdk.personalization.page({
      ...universalEventBuilderArgs,
    })
  }

  const { profile, personalizations, changes } = optimizationResponse ?? {}

  const personalizedEntries = new Map<
    string,
    {
      entry: Entry<ContentEntrySkeleton>
      personalization?: SelectedPersonalization
    }
  >()

  entryIds.forEach((entryId) => {
    const entry = entries.get(entryId)

    if (!entry) return

    if (isRichText(entry.fields.text)) {
      entry.fields.text = documentToHtmlString(entry.fields.text, {
        renderNode: {
          [INLINES.EMBEDDED_ENTRY]: (node) => {
            if (sdk.personalization.mergeTagValueResolver.isMergeTagEntry(node.data.target)) {
              return (
                sdk.personalization.mergeTagValueResolver.resolve(node.data.target, profile) ?? ''
              )
            } else {
              return ''
            }
          },
        },
      })
    }

    const personalizedEntry = sdk.personalization.personalizedEntryResolver.resolve(
      entry,
      personalizations,
    )

    personalizedEntries.set(entryId, personalizedEntry)
  })

  const flags = sdk.personalization.flagsResolver.resolve(changes)

  const pageData = {
    profile,
    personalizations,
    entries: personalizedEntries,
    flags,
  }

  res.render('index', { ...pageData })
})

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
