import { z } from 'zod/mini'
import { Page } from './Page'

export const PageView = z.catchall(Page, z.json())

export type PageView = z.infer<typeof PageView>
