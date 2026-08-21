import assert from 'node:assert/strict'
import type { GitHub, Manifest } from 'release-please'
import type { PullRequest } from 'release-please/build/src/pull-request'
import { PullRequestBody } from 'release-please/build/src/util/pull-request-body'
import { FilePullRequestOverflowHandler } from 'release-please/build/src/util/pull-request-overflow-handler'
import { Version } from 'release-please/build/src/version'

const MANIFEST_OVERFLOW_HANDLER_PROPERTY = 'pullRequestOverflowHandler'

// Release Please parses a merged PR body, serializes it, then parses it again per
// component. Preserve angle-bracket text between those passes so it cannot become
// an unclosed HTML element that swallows a later component's <details> section.
class ReparseSafePullRequestOverflowHandler extends FilePullRequestOverflowHandler {
  override async parseOverflow(pullRequest: PullRequest): Promise<PullRequestBody | undefined> {
    const body = await super.parseOverflow(pullRequest)

    if (body === undefined) {
      return undefined
    }

    return new ReparseSafePullRequestBody(body)
  }
}

class ReparseSafePullRequestBody extends PullRequestBody {
  private readonly serializedBody: string

  constructor(body: PullRequestBody) {
    const options = {
      extra: body.extra,
      footer: body.footer,
      header: body.header,
      useComponents: body.useComponents,
    }

    super(body.releaseData, options)

    this.serializedBody = new PullRequestBody(
      body.releaseData.map((release) => ({
        ...release,
        notes: escapeHtmlText(release.notes),
      })),
      options,
    ).toString()
  }

  override toString(): string {
    return this.serializedBody
  }
}

export function configureReparseSafePullRequestBodies(manifest: Manifest, github: GitHub): void {
  assert(
    MANIFEST_OVERFLOW_HANDLER_PROPERTY in manifest,
    'Release Please no longer exposes the expected pull request overflow handler.',
  )

  const configured = Reflect.set(
    manifest,
    MANIFEST_OVERFLOW_HANDLER_PROPERTY,
    new ReparseSafePullRequestOverflowHandler(github),
  )

  assert(configured, 'Failed to configure Release Please pull request parsing.')
}

export function assertPullRequestBodySurvivesReleasePleaseReparse(): void {
  const originalBody = new PullRequestBody([
    {
      component: 'optimization-android',
      notes: 'Fix getField&lt;Int&gt; conversion.',
      version: Version.parse('1.1.0'),
    },
    {
      component: 'optimization-swift',
      notes: 'Fix the same conversion for Swift.',
      version: Version.parse('1.1.0'),
    },
  ]).toString()
  const parsedBody = PullRequestBody.parse(originalBody)

  assert(parsedBody !== undefined)

  const reparsedBody = PullRequestBody.parse(new ReparseSafePullRequestBody(parsedBody).toString())

  assert(reparsedBody !== undefined)
  assert.deepEqual(
    reparsedBody.releaseData.map((release) => release.component),
    ['optimization-android', 'optimization-swift'],
  )
  assert.equal(reparsedBody.releaseData[0]?.notes, 'Fix getField<Int> conversion.')
}

function escapeHtmlText(content: string): string {
  return content.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
}
