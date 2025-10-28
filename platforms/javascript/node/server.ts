import type { SelectedPersonalizationArray } from '@contentful/optimization-api-schemas'
import type { Entry } from 'contentful'
import * as contentful from 'contentful'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import Optimization from './src'

interface ContentEntrySkeleton {
  contentTypeId: 'content'
  fields: {
    text: contentful.EntryFieldTypes.Text
  }
}

const limiter = rateLimit({
  windowMs: 900_000,
  max: 100,
})

const app: Express = express()
app.use(limiter)

app.set('view engine', 'pug') // configure Pug as the view engine
app.set('views', path.join(__dirname, '.')) // define the directory for view templates

const sdk = new Optimization({
  clientId: process.env.VITE_NINETAILED_CLIENT_ID ?? '',
  environment: process.env.VITE_NINETAILED_ENVIRONMENT ?? '',
  logLevel: 'debug',
  api: {
    analytics: { baseUrl: process.env.VITE_INSIGHTS_API_BASE_URL },
    personalization: { baseUrl: process.env.VITE_EXPERIENCE_API_BASE_URL },
  },
})

const ctfl = contentful.createClient({
  accessToken: process.env.VITE_CONTENTFUL_TOKEN ?? '',
  environment: process.env.VITE_CONTENTFUL_ENVIRONMENT ?? '',
  space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
  host: process.env.VITE_CONTENTFUL_CDA_HOST ?? '',
  basePath: process.env.VITE_CONTENTFUL_BASE_PATH ?? '',
  insecure: Boolean(process.env.VITE_CONTENTFUL_CDA_HOST),
})

async function getEntries(
  personalizations: SelectedPersonalizationArray = [],
): Promise<Array<Entry<ContentEntrySkeleton>>> {
  const possibleEntries: Array<Entry<ContentEntrySkeleton> | undefined> = await Promise.all(
    personalizations.map(async ({ variants }) => {
      const baselines = Object.keys(variants)

      if (!baselines.length || !baselines[0]) return

      try {
        return await ctfl.getEntry<ContentEntrySkeleton>(baselines[0], {
          include: 10,
        })
      } catch (_error) {}
    }),
  )

  const entries: Array<Entry<ContentEntrySkeleton>> = possibleEntries.filter(
    (entry): entry is Entry<ContentEntrySkeleton> => entry !== undefined,
  )

  return entries
}

app.get('/', limiter, async (_req, res) => {
  const { profile, personalizations, changes } =
    (await sdk.personalization.identify({
      userId: 'charles',
    })) ?? {}

  const entries = await getEntries(personalizations)

  const pageData = {
    consent: false, // Consent is handled manually, server-side
    profile,
    personalizations,
    entries: entries.map((entry) =>
      sdk.personalization.personalizedEntryResolver.resolve(entry, personalizations),
    ),
    flags: sdk.personalization.flagsResolver.resolve(changes),
  }

  res.render('index', { ...pageData })
})

const port = 3000

app.listen(port, () => {
  // eslint-disable-next-line no-console -- debug
  console.log(`Express is listening at http://localhost:${port}`)
})

export default app
