import type { ReactElement } from 'react'

interface ControlsSectionProps {
  consent: boolean | undefined
  eventLog: string[]
  onGrantConsent: () => void
  onRevokeConsent: () => void
  onIdentify: () => void
  onReset: () => void
  onSendPage: () => void
  onSendTrack: () => void
}

export function ControlsSection({
  consent,
  eventLog,
  onGrantConsent,
  onRevokeConsent,
  onIdentify,
  onReset,
  onSendPage,
  onSendTrack,
}: ControlsSectionProps): ReactElement {
  return (
    <section className="dashboard__grid">
      <article className="dashboard__card">
        <h2>Consent</h2>
        <p>{`Current consent: ${String(consent)}`}</p>
        <div className="dashboard__actions">
          <button onClick={onGrantConsent} type="button">
            Grant Consent
          </button>
          <button onClick={onRevokeConsent} type="button">
            Revoke Consent
          </button>
        </div>
      </article>

      <article className="dashboard__card">
        <h2>Identify / Reset</h2>
        <div className="dashboard__actions">
          <button onClick={onIdentify} type="button">
            Identify demo-user-123
          </button>
          <button onClick={onReset} type="button">
            Reset
          </button>
        </div>
      </article>

      <article className="dashboard__card">
        <h2>Event Stream</h2>
        <div className="dashboard__actions">
          <button onClick={onSendPage} type="button">
            Send Page
          </button>
          <button onClick={onSendTrack} type="button">
            Send Track
          </button>
        </div>
        <pre className="dashboard__pre">
          {eventLog.length ? eventLog.join('\n') : 'No events yet.'}
        </pre>
      </article>
    </section>
  )
}
