import { CAN_ADD_LISTENERS } from '../../../constants'
import type { ElementState } from './element-view-observer-support'

interface MarginValue {
  readonly unit: '%' | 'px'
  readonly value: number
}

export interface ObservationSource {
  readonly source: ElementState['source']
  readonly target: Element | null
}

export interface RootMargin {
  readonly bottom: MarginValue
  readonly left: MarginValue
  readonly right: MarginValue
  readonly top: MarginValue
}

interface RenderedTargets {
  readonly hasText: boolean
  readonly targets: Element[]
}

interface VirtualVisibilityOptions {
  readonly minVisibleRatio: number
  readonly root: Element | Document | null
  readonly rootMargin: RootMargin
}

type ClipRect = Pick<DOMRectReadOnly, 'bottom' | 'left' | 'right' | 'top'>

const ROOT_MARGIN_BOTTOM_INDEX = 2
const ROOT_MARGIN_LEFT_INDEX = 3
const ROOT_MARGIN_MAX_TOKENS = 4
const ZERO_MARGIN: MarginValue = Object.freeze({ unit: 'px' as const, value: 0 })
const ZERO_ROOT_MARGIN: RootMargin = Object.freeze({
  bottom: ZERO_MARGIN,
  left: ZERO_MARGIN,
  right: ZERO_MARGIN,
  top: ZERO_MARGIN,
})
const OVERFLOW_CLIP_RE = /(auto|scroll|hidden|clip)/

export const getElementDisplay = (element: Element): string =>
  CAN_ADD_LISTENERS && typeof getComputedStyle === 'function'
    ? getComputedStyle(element).display
    : ''

export const isDisplayContentsElement = (element: Element): boolean =>
  getElementDisplay(element) === 'contents'

const isNestedEntryElement = (element: Element): boolean =>
  element.hasAttribute('data-ctfl-entry-id')

const hasVisibleText = (node: ChildNode): boolean =>
  node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()

const collectRenderedTargets = (element: Element): RenderedTargets => {
  const targets: Element[] = []
  let hasText = false

  const visit = (parent: ParentNode): void => {
    parent.childNodes.forEach((node) => {
      if (hasVisibleText(node)) {
        hasText = true
        return
      }

      if (!(node instanceof Element)) return
      if (isNestedEntryElement(node)) return

      const display = getElementDisplay(node)
      if (display === 'none') return

      if (display === 'contents') {
        visit(node)
        return
      }

      targets.push(node)
    })
  }

  visit(element)

  return { hasText, targets }
}

export const resolveObservationSource = (element: Element): ObservationSource => {
  if (!isDisplayContentsElement(element)) {
    return { source: 'element', target: element }
  }

  const { hasText, targets } = collectRenderedTargets(element)

  if (!hasText && targets.length === 1) {
    return { source: 'element', target: targets[0] ?? null }
  }

  return { source: 'virtual', target: null }
}

const parseMarginValue = (token: string): MarginValue | undefined => {
  const match = /^(-?(?:\d+|\d*\.\d+))(px|%)$/.exec(token)
  if (!match) return undefined

  const [, rawValue, unit] = match
  const value = Number(rawValue)

  if (!Number.isFinite(value) || (unit !== 'px' && unit !== '%')) return undefined

  return { unit, value }
}

export const parseRootMargin = (raw: string): RootMargin => {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > ROOT_MARGIN_MAX_TOKENS) return ZERO_ROOT_MARGIN

  const values: MarginValue[] = []

  for (const token of tokens) {
    const value = parseMarginValue(token)
    if (!value) return ZERO_ROOT_MARGIN
    values.push(value)
  }

  const top = values[0] ?? ZERO_MARGIN
  const right = values[1] ?? top
  const bottom = values[ROOT_MARGIN_BOTTOM_INDEX] ?? top
  const left = values[ROOT_MARGIN_LEFT_INDEX] ?? right

  return { bottom, left, right, top }
}

const resolveMarginValue = (margin: MarginValue, size: number): number =>
  margin.unit === '%' ? (margin.value / 100) * size : margin.value

const intersectRects = (first: ClipRect, second: ClipRect): ClipRect => ({
  bottom: Math.min(first.bottom, second.bottom),
  left: Math.max(first.left, second.left),
  right: Math.min(first.right, second.right),
  top: Math.max(first.top, second.top),
})

const toRect = (rect: DOMRectReadOnly): ClipRect => ({
  bottom: rect.bottom,
  left: rect.left,
  right: rect.right,
  top: rect.top,
})

const rectArea = (rect: ClipRect): number =>
  Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top)

const resolveRootClipRect = ({
  root,
  rootMargin,
}: Pick<VirtualVisibilityOptions, 'root' | 'rootMargin'>): ClipRect => {
  const rootRect =
    root instanceof Element
      ? root.getBoundingClientRect()
      : {
          bottom: window.innerHeight,
          left: 0,
          right: window.innerWidth,
          top: 0,
        }
  const height = rootRect.bottom - rootRect.top
  const width = rootRect.right - rootRect.left

  return {
    bottom: rootRect.bottom + resolveMarginValue(rootMargin.bottom, height),
    left: rootRect.left - resolveMarginValue(rootMargin.left, width),
    right: rootRect.right + resolveMarginValue(rootMargin.right, width),
    top: rootRect.top - resolveMarginValue(rootMargin.top, height),
  }
}

const resolveClipRect = (element: Element, options: VirtualVisibilityOptions): ClipRect => {
  let clip = resolveRootClipRect(options)
  const root = options.root instanceof Element ? options.root : null
  let { parentElement: current } = element

  while (current && current !== document.documentElement) {
    if (root && current === root) break

    const style = getComputedStyle(current)
    const clips = OVERFLOW_CLIP_RE.test(style.overflowX) || OVERFLOW_CLIP_RE.test(style.overflowY)

    if (clips) {
      clip = intersectRects(clip, toRect(current.getBoundingClientRect()))
    }

    const { parentElement } = current
    current = parentElement
  }

  return clip
}

export const measureVirtualVisibility = (
  element: Element,
  options: VirtualVisibilityOptions,
): boolean => {
  if (typeof document.createRange !== 'function') return false

  const range = document.createRange()
  range.selectNodeContents(element)

  const rects = Array.from(range.getClientRects())
  range.detach()

  if (rects.length === 0) return false

  const clip = resolveClipRect(element, options)
  let totalArea = 0
  let visibleArea = 0

  rects.forEach((rect) => {
    const area = rect.width * rect.height
    if (area <= 0) return

    totalArea += area
    visibleArea += rectArea(intersectRects(toRect(rect), clip))
  })

  return totalArea > 0 && visibleArea / totalArea >= options.minVisibleRatio
}
