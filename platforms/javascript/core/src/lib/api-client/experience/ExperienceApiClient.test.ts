import { describe, it, expect } from 'vitest'
import ExperienceApiClient from './ExperienceApiClient'
import ApiClientBase, { type ApiConfig } from '../ApiClientBase'

describe('ExperienceApiClient', () => {
  const config: ApiConfig = { fetchOptions: {} }

  it('should create an instance extending ApiClientBase', () => {
    const client = new ExperienceApiClient(config)
    expect(client).toBeInstanceOf(ExperienceApiClient)
    expect(client).toBeInstanceOf(ApiClientBase)
  })
})
