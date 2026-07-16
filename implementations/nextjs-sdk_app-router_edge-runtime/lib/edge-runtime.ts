export interface EdgeRuntimeWitness {
  readonly isEdgeRuntime: true
  readonly witness: 'edge-runtime'
}

export function assertEdgeRuntime(): EdgeRuntimeWitness {
  const witness = (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime

  if (witness !== 'edge-runtime') {
    throw new Error('Expected Next.js Edge runtime.')
  }

  return { isEdgeRuntime: true, witness }
}
