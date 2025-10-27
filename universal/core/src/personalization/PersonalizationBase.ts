import type {
  OptimizationData,
  ExperienceEvent as PersonalizationEvent,
} from '@contentful/optimization-api-client'
import ProductBase from '../ProductBase'
import { FlagsResolver, MergeTagValueResolver, PersonalizedEntryResolver } from './resolvers'

abstract class PersonalizationBase extends ProductBase<PersonalizationEvent> {
  readonly flagsResolver = FlagsResolver
  readonly mergeTagValueResolver = MergeTagValueResolver
  readonly personalizedEntryResolver = PersonalizedEntryResolver

  abstract identify(...args: unknown[]): Promise<OptimizationData | undefined>
  abstract page(...args: unknown[]): Promise<OptimizationData>
  abstract track(...args: unknown[]): Promise<OptimizationData>
  abstract trackComponentView(...args: unknown[]): Promise<OptimizationData>
}

export default PersonalizationBase
