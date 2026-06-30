export const isHtmlOrSvgElement = (element: unknown): element is HTMLElement | SVGElement => {
  if (typeof HTMLElement === 'undefined' || typeof SVGElement === 'undefined') return false

  return element instanceof HTMLElement || element instanceof SVGElement
}
