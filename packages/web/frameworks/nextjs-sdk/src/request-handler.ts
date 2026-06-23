import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import {
  bindNextjsOptimizationRequest,
  getNextjsServerOptimizationData,
  persistNextjsAnonymousId,
  type BindNextjsOptimizationRequestOptions,
  type ContentfulOptimization,
  type CoreStatelessRequestConsent,
  type PageViewBuilderArgs,
  type PersistNextjsAnonymousIdOptions,
  type UniversalEventBuilderArgs,
} from './server'

export type MaybePromise<T> = T | Promise<T>

export type NextjsOptimizationRequestHandler = (
  request: NextRequest,
  responseOrEvent?: NextResponse | NextFetchEvent,
) => Promise<NextResponse>

export interface NextjsOptimizationRequestBaseContext {
  readonly request: NextRequest
  readonly response: NextResponse
}

export interface NextjsOptimizationRequestContext extends NextjsOptimizationRequestBaseContext {
  readonly consent: CoreStatelessRequestConsent
}

export interface CreateNextjsOptimizationRequestHandlerOptions
  extends
    Omit<
      BindNextjsOptimizationRequestOptions,
      'consent' | 'cookies' | 'eventContext' | 'headers' | 'locale' | 'profile' | 'request'
    >,
    PersistNextjsAnonymousIdOptions {
  readonly errorPolicy?: 'continue' | 'throw'
  readonly getEventContext?: (
    context: NextjsOptimizationRequestContext,
  ) => MaybePromise<UniversalEventBuilderArgs | undefined>
  readonly getLocale?: (
    context: NextjsOptimizationRequestContext,
  ) => MaybePromise<string | undefined>
  readonly getPagePayload?: (
    context: NextjsOptimizationRequestContext,
  ) => MaybePromise<PageViewBuilderArgs | undefined>
  readonly onError?: (
    error: unknown,
    context: NextjsOptimizationRequestBaseContext,
  ) => MaybePromise<void>
  readonly resolveConsent: (
    context: NextjsOptimizationRequestBaseContext,
  ) => MaybePromise<CoreStatelessRequestConsent>
  readonly shouldHandleRequest?: (
    context: NextjsOptimizationRequestContext,
  ) => MaybePromise<boolean>
  readonly shouldRequestOptimization?: (
    context: NextjsOptimizationRequestContext,
  ) => MaybePromise<boolean>
}

export function createNextjsOptimizationRequestHandler(
  sdk: ContentfulOptimization,
  options: CreateNextjsOptimizationRequestHandlerOptions,
): NextjsOptimizationRequestHandler {
  return async (request, responseOrEvent) => {
    const response = getRequestHandlerResponse(responseOrEvent)
    const baseContext: NextjsOptimizationRequestBaseContext = { request, response }

    try {
      const consent = await options.resolveConsent(baseContext)
      const context: NextjsOptimizationRequestContext = { ...baseContext, consent }

      if ((await options.shouldHandleRequest?.(context)) === false) {
        return response
      }

      const requestOptions = await createRequestOptions(options, context)

      if ((await options.shouldRequestOptimization?.(context)) === false) {
        persistNextjsAnonymousId(
          response,
          bindNextjsOptimizationRequest(sdk, requestOptions),
          undefined,
          options,
        )
        return response
      }

      const pagePayload = await options.getPagePayload?.(context)
      const { data, requestOptimization } = await getNextjsServerOptimizationData(sdk, {
        ...requestOptions,
        pagePayload,
      })

      persistNextjsAnonymousId(response, requestOptimization, data, options)

      return response
    } catch (error) {
      await handleRequestHandlerError(error, baseContext, options)
      return response
    }
  }
}

function getRequestHandlerResponse(
  responseOrEvent: NextResponse | NextFetchEvent | undefined,
): NextResponse {
  return isNextResponse(responseOrEvent) ? responseOrEvent : NextResponse.next()
}

function isNextResponse(
  responseOrEvent: NextResponse | NextFetchEvent | undefined,
): responseOrEvent is NextResponse {
  return responseOrEvent instanceof Response
}

async function createRequestOptions(
  options: CreateNextjsOptimizationRequestHandlerOptions,
  context: NextjsOptimizationRequestContext,
): Promise<BindNextjsOptimizationRequestOptions> {
  return {
    anonymousIdCookieName: options.anonymousIdCookieName,
    consent: context.consent,
    eventContext: await options.getEventContext?.(context),
    experienceOptions: options.experienceOptions,
    insightsOptions: options.insightsOptions,
    locale: await options.getLocale?.(context),
    request: context.request,
  }
}

async function handleRequestHandlerError(
  error: unknown,
  context: NextjsOptimizationRequestBaseContext,
  options: CreateNextjsOptimizationRequestHandlerOptions,
): Promise<void> {
  try {
    await options.onError?.(error, context)
  } catch (_error) {
    // Fail-open mode should not let observability callbacks block the request.
  }

  if (options.errorPolicy === 'throw') {
    throw error instanceof Error
      ? error
      : new Error('Next.js optimization request handler failed.', { cause: error })
  }
}
