import type { Entry } from 'contentful'
import type { ReactElement } from 'react'
import { getFieldText } from '../utils'

interface EntryPanelProps {
  title: string
  resolvedEntry: Entry
}

export function EntryPanel({ title, resolvedEntry }: EntryPanelProps): ReactElement {
  return (
    <article className="dashboard__card">
      <h2>{title}</h2>
      <p>{getFieldText(resolvedEntry.fields.internalTitle) || 'No internalTitle field'}</p>
      <p>{getFieldText(resolvedEntry.fields.text) || 'No text field'}</p>
      <p>
        <strong>Entry ID:</strong> {resolvedEntry.sys.id}
      </p>
      <p>
        <strong>Type:</strong> {resolvedEntry.sys.contentType.sys.id}
      </p>
    </article>
  )
}
