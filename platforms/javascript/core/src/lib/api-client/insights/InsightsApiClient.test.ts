import { describe, it, expect } from 'vitest'
import InsightsApiClient from './InsightsApiClient'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'

describe('InsightsApiClient', () => {
  const config: ApiConfig = { clientId: 'testId', fetchOptions: {} }

  it('should create an instance extending ApiClientBase', () => {
    const client = new InsightsApiClient(config)
    expect(client).toBeInstanceOf(InsightsApiClient)
    expect(client).toBeInstanceOf(ApiClientBase)
  })
})
