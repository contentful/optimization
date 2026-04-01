import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { type Document, INLINES } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import * as contentful from 'contentful'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ContentfulOptimization from '../src'
import type { OptimizationData, PartialProfile, SelectedOptimization } from '../src/api-schemas'
import { isMergeTagEntry } from '../src/api-schemas'

/* eslint-disable @typescript-eslint/naming-convention -- standardized var names */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
/* eslint-enable @typescript-eslint/naming-convention -- standardized var names */

const limiter = rateLimit({
  windowMs: 30_000,
  max: 1000,
})

const app: Express = express()
app.use(limiter)

app.set('view engine', 'ejs') // configure EJS as the view engine
app.set('views', __dirname) // define the directory for view templates

function readEnv(key: string): string | undefined {
  const {
    env: { [key]: value },
  } = process

  if (typeof value !== 'string') return undefined

  const normalized = value.trim()

  return normalized.length > 0 ? normalized : undefined
}

function requireEnv(label: string, key: string): string {
  const value = readEnv(key)

  if (value) return value

  throw new Error(
    `Missing ${label}. Set ${key} in packages/node/node-sdk/.env. Start from packages/node/node-sdk/.env.example if needed.`,
  )
}

const env = {
  contentfulBasePath: readEnv('PUBLIC_CONTENTFUL_BASE_PATH'),
  contentfulEnvironment: requireEnv('Contentful environment', 'PUBLIC_CONTENTFUL_ENVIRONMENT'),
  contentfulHost: readEnv('PUBLIC_CONTENTFUL_CDA_HOST'),
  contentfulSpaceId: requireEnv('Contentful space ID', 'PUBLIC_CONTENTFUL_SPACE_ID'),
  contentfulToken: requireEnv('Contentful access token', 'PUBLIC_CONTENTFUL_TOKEN'),
  experienceBaseUrl: readEnv('PUBLIC_EXPERIENCE_API_BASE_URL'),
  insightsBaseUrl: readEnv('PUBLIC_INSIGHTS_API_BASE_URL'),
  optimizationClientId: requireEnv('Optimization client ID', 'PUBLIC_NINETAILED_CLIENT_ID'),
  optimizationEnvironment: readEnv('PUBLIC_NINETAILED_ENVIRONMENT') ?? 'main',
} as const

const sdk = new ContentfulOptimization({
  clientId: env.optimizationClientId,
  environment: env.optimizationEnvironment,
  logLevel: 'debug',
  api: {
    insightsBaseUrl: env.insightsBaseUrl,
    experienceBaseUrl: env.experienceBaseUrl,
  },
})

const ctfl = contentful.createClient({
  accessToken: env.contentfulToken,
  environment: env.contentfulEnvironment,
  space: env.contentfulSpaceId,
  host: env.contentfulHost ?? '',
  basePath: env.contentfulBasePath ?? '',
  insecure: Boolean(env.contentfulHost),
})

interface ContentEntrySkeleton {
  contentTypeId: 'content'
  fields: {
    text: contentful.EntryFieldTypes.Text
  }
}

interface ProfileState {
  consent: boolean
  userId?: string
}

const profileState = new Map<string, ProfileState>()

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

function updateState({
  profileId,
  consent,
  userId,
}: {
  profileId?: unknown
  consent?: unknown
  userId?: unknown
}): void {
  if (!isNonEmptyString(profileId)) return

  const stateKey = profileId.trim()

  const state = profileState.get(stateKey) ?? { consent: false }

  if (consent !== undefined) state.consent = consent === 'true'

  if (isNonEmptyString(userId)) state.userId = userId

  profileState.set(stateKey, state)
}

function resetState(profileId?: unknown): void {
  if (!isNonEmptyString(profileId)) {
    profileState.clear()
    return
  }

  profileState.set(profileId.trim(), { consent: false })
}

app.get('/', limiter, async (req, res) => {
  let profileId = isNonEmptyString(req.query.profileId) ? req.query.profileId.trim() : undefined

  if (req.query.reset === 'true') {
    resetState(profileId)
    profileId = undefined
  } else {
    updateState({
      profileId,
      consent: req.query.consent,
      userId: req.query.userId,
    })
  }

  const { consent, userId } = profileId ? (profileState.get(profileId) ?? {}) : {}

  const requestProfile: PartialProfile | undefined =
    typeof profileId === 'string' ? { id: profileId } : undefined

  const requestOptimization = sdk.forRequest()
  let apiResponse: OptimizationData = await requestOptimization.page({ profile: requestProfile })

  if (isNonEmptyString(userId)) {
    apiResponse = await requestOptimization.identify({
      userId,
      profile: requestProfile,
    })
  }

  const { profile, selectedOptimizations } = apiResponse

  const entryIds: string[] = [
    '1MwiFl4z7gkwqGYdvCmr8c', // Rich Text field Entry with Merge Tag
    '4ib0hsHWoSOnCVdDkizE8d',
    'xFwgG3oNaOcjzWiGe4vXo',
    '2Z2WLOx07InSewC3LUB3eX',
    '5XHssysWUDECHzKLzoIsg1',
    '6zqoWXyiSrf0ja7I2WGtYj',
    '7pa5bOx8Z9NmNcr7mISvD',
  ]

  const entries = new Map<
    string,
    {
      entry: Entry<ContentEntrySkeleton>
      selectedOptimization?: SelectedOptimization
    }
  >()

  await Promise.all(
    entryIds.map(async (entryId) => {
      const entry = await getContentfulEntry(entryId)

      if (!entry) return

      if (isRichText(entry.fields.text)) {
        entry.fields.text = documentToHtmlString(entry.fields.text, {
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

      const optimizedEntry = sdk.resolveOptimizedEntry(entry, selectedOptimizations)

      entries.set(entryId, optimizedEntry)
    }),
  )

  const pageData = {
    consent,
    profile,
    selectedOptimizations,
    entries,
  }

  res.render('index', { ...pageData })
})

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
