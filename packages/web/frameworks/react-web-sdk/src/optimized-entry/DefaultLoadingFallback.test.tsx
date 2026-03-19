import { renderToString } from 'react-dom/server'
import { DefaultLoadingFallback } from './DefaultLoadingFallback'

describe('DefaultLoadingFallback', () => {
  it('renders the provided baseline content wrapper', () => {
    const markup = renderToString(<DefaultLoadingFallback>baseline content</DefaultLoadingFallback>)

    expect(markup).toContain('data-ctfl-loading="true"')
    expect(markup).toContain('baseline content')
  })
})
