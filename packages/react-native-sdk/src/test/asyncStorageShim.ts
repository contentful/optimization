const asyncStorage = {
  async clear(): Promise<void> {
    await Promise.resolve()
  },
  async getAllKeys(): Promise<string[]> {
    await Promise.resolve()
    return []
  },
  async getItem(_key: string): Promise<string | null> {
    await Promise.resolve()
    return null
  },
  async getMany(_keys: string[]): Promise<Record<string, string | null>> {
    await Promise.resolve()
    return {}
  },
  async removeItem(_key: string): Promise<void> {
    await Promise.resolve()
  },
  async removeMany(_keys: string[]): Promise<void> {
    await Promise.resolve()
  },
  async setItem(_key: string, _value: string): Promise<void> {
    await Promise.resolve()
  },
  async setMany(_entries: Record<string, string>): Promise<void> {
    await Promise.resolve()
  },
}

export default asyncStorage
