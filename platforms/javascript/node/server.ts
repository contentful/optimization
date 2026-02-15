import type {
  OptimizationData,
  PartialProfile,
  SelectedPersonalization,
} from '@contentful/optimization-api-schemas'
import { documentToHtmlString } from '@contentful/rich-text-html-renderer'
import { type Document, INLINES } from '@contentful/rich-text-types'
import type { Entry } from 'contentful'
import * as contentful from 'contentful'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import Optimization from './src'

const limiter = rateLimit({
  windowMs: 30_000,
  max: 1000,
})

const app: Express = express()
app.use(limiter)

app.set('view engine', 'pug') // configure Pug as the view engine
app.set('views', path.join(__dirname, '.')) // define the directory for view templates

const sdk = new Optimization({
  clientId: process.env.PUBLIC_NINETAILED_CLIENT_ID ?? '',
  environment: process.env.PUBLIC_NINETAILED_ENVIRONMENT ?? '',
  logLevel: 'debug',
  analytics: { baseUrl: process.env.PUBLIC_INSIGHTS_API_BASE_URL },
  personalization: { baseUrl: process.env.PUBLIC_EXPERIENCE_API_BASE_URL },
})

const ctfl = contentful.createClient({
  accessToken: process.env.PUBLIC_CONTENTFUL_TOKEN ?? '',
  environment: process.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? '',
  space: process.env.PUBLIC_CONTENTFUL_SPACE_ID ?? '',
  host: process.env.PUBLIC_CONTENTFUL_CDA_HOST ?? '',
  basePath: process.env.PUBLIC_CONTENTFUL_BASE_PATH ?? '',
  insecure: Boolean(process.env.PUBLIC_CONTENTFUL_CDA_HOST),
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

  let apiResponse: OptimizationData | undefined = undefined

  if (isNonEmptyString(userId)) {
    await sdk.personalization.page({ profile: requestProfile })
    apiResponse = await sdk.personalization.identify({
      userId,
      profile: requestProfile,
    })
  } else {
    apiResponse = await sdk.personalization.page({ profile: requestProfile })
  }

  const { profile, personalizations, changes } = apiResponse

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
      personalization?: SelectedPersonalization
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

      entries.set(entryId, personalizedEntry)
    }),
  )

  const flags = sdk.personalization.flagsResolver.resolve(changes)

  const pageData = {
    consent,
    profile,
    personalizations,
    entries,
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
