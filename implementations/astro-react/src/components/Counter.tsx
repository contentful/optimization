import { useState, type ReactElement } from 'react'

export default function Counter(): ReactElement {
  const [count, setCount] = useState(0)
  return (
    <button
      type="button"
      onClick={() => {
        setCount((value) => value + 1)
      }}
    >
      Independent React island: {count}
    </button>
  )
}
