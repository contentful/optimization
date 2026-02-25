import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { HOME_PATH } from '../config/routes'

export function PageTwoPage(): JSX.Element {
  return (
    <section data-testid="page-two-view">
      <h2>Page Two</h2>
      <p>Secondary route for SPA navigation and page event validation.</p>
      <Link data-testid="link-back-home" to={HOME_PATH}>
        Back to Home
      </Link>
    </section>
  )
}
