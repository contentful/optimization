import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  preparePublishReadme,
  restorePublishReadme,
  rewriteReadmeForPublish,
} from './publishReadme'

describe('rewriteReadmeForPublish', () => {
  it('rewrites relative README links and assets using package repository metadata', () => {
    const rewrittenReadme = rewriteReadmeForPublish(
      [
        '<img alt="Contentful Logo" src="../../../contentful-icon.png" width="150">',
        '',
        '[Reference](https://contentful.github.io/optimization) · [Contributing](../../../CONTRIBUTING.md)',
        '[Optimization Core Library](../../universal/core-sdk/README.md)',
        '![Logo](../../../contentful-icon.png)',
        '',
        '```md',
        '[Contributing](../../../CONTRIBUTING.md)',
        '```',
      ].join('\n'),
      {
        blobBaseUrl: 'https://github.com/contentful/optimization/blob/v1.2.3',
        rawBaseUrl: 'https://raw.githubusercontent.com/contentful/optimization/v1.2.3',
        readmeUrl: new URL('/packages/node/node-sdk/README.md', 'https://publish-readme.invalid'),
      },
    )

    expect(rewrittenReadme).toContain(
      '<img alt="Contentful Logo" src="https://raw.githubusercontent.com/contentful/optimization/v1.2.3/contentful-icon.png" width="150">',
    )
    expect(rewrittenReadme).toContain(
      '[Contributing](https://github.com/contentful/optimization/blob/v1.2.3/CONTRIBUTING.md)',
    )
    expect(rewrittenReadme).toContain(
      '[Optimization Core Library](https://github.com/contentful/optimization/blob/v1.2.3/packages/universal/core-sdk/README.md)',
    )
    expect(rewrittenReadme).toContain(
      '![Logo](https://raw.githubusercontent.com/contentful/optimization/v1.2.3/contentful-icon.png)',
    )
    expect(rewrittenReadme).toContain('```md\n[Contributing](../../../CONTRIBUTING.md)\n```')
  })
})

describe('preparePublishReadme', () => {
  it('rewrites README.md in place and restores it afterwards', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'build-tools-publish-readme-'))
    const readmePath = join(packageDir, 'README.md')

    try {
      writeFileSync(
        join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@contentful/example',
          repository: {
            type: 'git',
            url: 'git+https://github.com/contentful/optimization.git',
            directory: 'packages/example',
          },
        }),
      )
      writeFileSync(
        readmePath,
        '[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)\n![Logo](../../contentful-icon.png)\n',
      )

      preparePublishReadme(packageDir, { publishRef: 'v1.2.3' })

      expect(readFileSync(readmePath, 'utf8')).toBe(
        '[Reference](https://contentful.github.io/optimization) · [Contributing](https://github.com/contentful/optimization/blob/v1.2.3/CONTRIBUTING.md)\n![Logo](https://raw.githubusercontent.com/contentful/optimization/v1.2.3/contentful-icon.png)\n',
      )
      expect(existsSync(join(packageDir, '.tmp', 'build-tools-publish-readme-backup.md'))).toBe(
        true,
      )

      restorePublishReadme(packageDir)

      expect(readFileSync(readmePath, 'utf8')).toBe(
        '[Reference](https://contentful.github.io/optimization) · [Contributing](../../CONTRIBUTING.md)\n![Logo](../../contentful-icon.png)\n',
      )
      expect(existsSync(join(packageDir, '.tmp', 'build-tools-publish-readme-backup.md'))).toBe(
        false,
      )
    } finally {
      rmSync(packageDir, { force: true, recursive: true })
    }
  })
})
