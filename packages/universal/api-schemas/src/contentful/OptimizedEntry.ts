import * as z from 'zod/mini'
import { CtflEntry, EntryFields } from './CtflEntry'
import { OptimizationEntryArray } from './OptimizationEntry'

/**
 * Zod schema describing a Contentful entry that has attached optimizations.
 *
 * @remarks
 * Extends {@link CtflEntry} and adds `nt_experiences` to the `fields` object.
 *
 * @public
 */
export const OptimizedEntry = z.extend(CtflEntry, {
  fields: z.extend(EntryFields, {
    /**
     * Optimization or experimentation experiences attached to this entry.
     */
    nt_experiences: OptimizationEntryArray,
  }),
})

/**
 * TypeScript type inferred from {@link OptimizedEntry}.
 *
 * @public
 */
export type OptimizedEntry = z.infer<typeof OptimizedEntry>
