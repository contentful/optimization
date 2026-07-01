import { describe, expect, it, rs } from '@rstest/core'
import { act, StrictMode, useLayoutEffect, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useLifecycle, type InitResult } from './useLifecycle'

function createContainer(): { root: ReturnType<typeof createRoot>; unmount: () => void } {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  return {
    root,
    unmount() {
      act(() => {
        root.unmount()
      })
      el.remove()
    },
  }
}

function render(element: ReactElement): { unmount: () => void } {
  const { root, unmount } = createContainer()
  act(() => {
    root.render(element)
  })
  return { unmount }
}

describe('useLifecycle', () => {
  describe('init', () => {
    it('returns { value } when init resolves synchronously', () => {
      const value = { id: 1 }
      let result: InitResult<typeof value> = undefined

      function Component(): null {
        result = useLifecycle(() => value, rs.fn()).init()
        return null
      }

      const { unmount } = render(<Component />)
      expect(result).toEqual({ value })
      unmount()
    })

    it('returns { error } when init throws', () => {
      const error = new Error('init failed')
      let result: InitResult<unknown> = undefined

      function Component(): null {
        result = useLifecycle((): unknown => {
          throw error
        }, rs.fn<(v: unknown) => void>()).init()
        return null
      }

      const { unmount } = render(<Component />)
      expect(result).toEqual({ error })
      unmount()
    })

    it('returns undefined when init returns a Promise', () => {
      let result: InitResult<number> = { value: 0 }

      function Component(): null {
        async function asyncInit(): Promise<number> {
          return await Promise.resolve(42)
        }
        result = useLifecycle(asyncInit, rs.fn()).init()
        return null
      }

      const { unmount } = render(<Component />)
      expect(result).toBeUndefined()
      unmount()
    })
  })

  describe('mount — synchronous init', () => {
    it('calls onMount with the resolved value', () => {
      const onMount = rs.fn()
      const onFail = rs.fn()
      const value = { id: 1 }

      function Component(): null {
        const lifecycle = useLifecycle(() => value, rs.fn())
        useLayoutEffect(() => lifecycle.mount(onMount, onFail), [])
        return null
      }

      const { unmount } = render(<Component />)
      expect(onMount).toHaveBeenCalledWith(value)
      expect(onFail).not.toHaveBeenCalled()
      unmount()
    })

    it('calls dispose on unmount', () => {
      const dispose = rs.fn()
      const value = { id: 1 }

      function Component(): null {
        const lifecycle = useLifecycle(() => value, dispose)
        useLayoutEffect(() => lifecycle.mount(rs.fn(), rs.fn()), [])
        return null
      }

      const { unmount } = render(<Component />)
      expect(dispose).not.toHaveBeenCalled()
      unmount()
      expect(dispose).toHaveBeenCalledWith(value)
      expect(dispose).toHaveBeenCalledTimes(1)
    })

    it('calls onFail when init throws inside mount', () => {
      const error = new Error('sync throw')
      const onMount = rs.fn()
      const onFail = rs.fn()

      function Component(): null {
        const lifecycle = useLifecycle((): never => {
          throw error
        }, rs.fn())
        useLayoutEffect(() => lifecycle.mount(onMount, onFail), [])
        return null
      }

      const { unmount } = render(<Component />)
      expect(onFail).toHaveBeenCalledWith(error)
      expect(onMount).not.toHaveBeenCalled()
      unmount()
    })
  })

  describe('mount — async init', () => {
    it('calls onMount after Promise resolves', async () => {
      const onMount = rs.fn()
      const onFail = rs.fn()
      let resolve!: (v: number) => void
      const promise = new Promise<number>((_resolve) => {
        resolve = _resolve
      })

      function Component(): null {
        const lifecycle = useLifecycle(async () => await promise, rs.fn())
        useLayoutEffect(() => lifecycle.mount(onMount, onFail), [])
        return null
      }

      const { unmount } = render(<Component />)
      expect(onMount).not.toHaveBeenCalled()
      await act(async () => {
        await Promise.resolve()
        resolve(42)
      })
      expect(onMount).toHaveBeenCalledWith(42)
      expect(onFail).not.toHaveBeenCalled()
      unmount()
    })

    it('calls onFail when Promise rejects', async () => {
      const error = new Error('async fail')
      const onMount = rs.fn()
      const onFail = rs.fn()
      let reject!: (e: unknown) => void
      const promise = new Promise<number>((_resolve, _reject) => {
        reject = _reject
      })

      function Component(): null {
        const lifecycle = useLifecycle(async () => await promise, rs.fn())
        useLayoutEffect(() => lifecycle.mount(onMount, onFail), [])
        return null
      }

      const { unmount } = render(<Component />)
      await act(async () => {
        await Promise.resolve()
        reject(error)
      })
      expect(onFail).toHaveBeenCalledWith(error)
      expect(onMount).not.toHaveBeenCalled()
      unmount()
    })

    it('disposes value that resolves after unmount', async () => {
      const dispose = rs.fn()
      let resolve!: (v: number) => void
      const promise = new Promise<number>((_resolve) => {
        resolve = _resolve
      })

      function Component(): null {
        const lifecycle = useLifecycle(async () => await promise, dispose)
        useLayoutEffect(() => lifecycle.mount(rs.fn(), rs.fn()), [])
        return null
      }

      const { unmount } = render(<Component />)
      unmount()
      await act(async () => {
        await Promise.resolve()
        resolve(99)
      })
      expect(dispose).toHaveBeenCalledWith(99)
    })

    it('does not call onMount after unmount', async () => {
      const onMount = rs.fn()
      let resolve!: (v: number) => void
      const promise = new Promise<number>((_resolve) => {
        resolve = _resolve
      })

      function Component(): null {
        const lifecycle = useLifecycle(async () => await promise, rs.fn())
        useLayoutEffect(() => lifecycle.mount(onMount, rs.fn()), [])
        return null
      }

      const { unmount } = render(<Component />)
      unmount()
      await act(async () => {
        await Promise.resolve()
        resolve(99)
      })
      expect(onMount).not.toHaveBeenCalled()
    })
  })

  describe('StrictMode', () => {
    it('disposes after StrictMode teardown and re-inits on remount', () => {
      const dispose = rs.fn()
      const onMount = rs.fn()
      const value = { id: 1 }

      function Component(): null {
        const lifecycle = useLifecycle(() => value, dispose)
        useLayoutEffect(() => lifecycle.mount(onMount, rs.fn()), [])
        return null
      }

      const { unmount } = render(
        <StrictMode>
          <Component />
        </StrictMode>,
      )
      // StrictMode: mount → unmount → remount
      expect(dispose).toHaveBeenCalledTimes(1)
      expect(onMount).toHaveBeenCalledTimes(2)
      unmount()
      expect(dispose).toHaveBeenCalledTimes(2)
    })

    it('disposes exactly once on final unmount after StrictMode', () => {
      const dispose = rs.fn()
      const value = { id: 1 }

      function Component(): null {
        const lifecycle = useLifecycle(() => value, dispose)
        useLayoutEffect(() => lifecycle.mount(rs.fn(), rs.fn()), [])
        return null
      }

      const { unmount } = render(
        <StrictMode>
          <Component />
        </StrictMode>,
      )
      dispose.mockClear()
      unmount()
      expect(dispose).toHaveBeenCalledTimes(1)
    })
  })
})
