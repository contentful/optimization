import { renderToString } from 'react-dom/server'
import { DefaultLoadingFallback } from './DefaultLoadingFallback'

describe('DefaultLoadingFallback', () => {
  it('renders the default loading affordance', () => {
    const markup = renderToString(<DefaultLoadingFallback />)

    expect(markup).toContain('data-ctfl-loading="true"')
    expect(markup).toContain('aria-label="Loading content"')
    expect(markup).toContain('Loading...')
  })
})
