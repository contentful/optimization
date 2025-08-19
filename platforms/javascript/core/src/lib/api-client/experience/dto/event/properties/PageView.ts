import { catchall, json, type infer as zInfer } from 'zod/mini'
import { Page } from './Page'

export const PageView = catchall(Page, json())

export type PageView = zInfer<typeof PageView>
