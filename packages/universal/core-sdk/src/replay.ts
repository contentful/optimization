import type { ExperienceEvent, InsightsEvent, PartialProfile } from './api-schemas'
import type {
  ClickBuilderArgs,
  FlagViewBuilderArgs,
  HoverBuilderArgs,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  ScreenViewBuilderArgs,
  TrackBuilderArgs,
  ViewBuilderArgs,
} from './events'

/** Safe caller input for optional commands before the SDK-built page command. @public */
export type InitialExperienceCommandInput =
  | ({ readonly type: 'identify' } & IdentifyBuilderArgs)
  | ({ readonly type: 'track' } & TrackBuilderArgs)
  | ({ readonly type: 'trackView' } & ViewBuilderArgs)
  | ({ readonly type: 'trackClick' } & ClickBuilderArgs)
  | ({ readonly type: 'trackHover' } & HoverBuilderArgs)
  | ({ readonly type: 'trackFlagView' } & FlagViewBuilderArgs)

/** Server inputs used to build one paired event batch. @public */
export type OptimizationReplayCommand =
  | InitialExperienceCommandInput
  | ({ readonly type: 'page' } & PageViewBuilderArgs)
  | ({ readonly type: 'screen' } & ScreenViewBuilderArgs)

/** One batch preflight; all events are built on the server for browser delivery. @public */
export interface PreviewExperienceOptions {
  readonly events: readonly OptimizationReplayCommand[]
}

/** Initial request preview input. @public */
export interface PreviewInitialExperienceOptions {
  readonly events?: readonly InitialExperienceCommandInput[]
  readonly page?: PageViewBuilderArgs
}
/** Private replay payload carried inside an optimization handoff. @public */
export interface OptimizationReplayEnvelope {
  /** Required when commands contain a page. */
  readonly routeKey?: string
  /** Profile known before preview, when available. */
  readonly profile?: PartialProfile
  /** Server-built Personalization events, in input order. */
  readonly experience: readonly ExperienceEvent[]
  /** Server-built Analytics events, delivered after Personalization. */
  readonly insights: readonly InsightsEvent[]
}
