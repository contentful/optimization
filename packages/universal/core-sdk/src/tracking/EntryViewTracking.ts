/**
 * Decide whether an entry-view event should request sticky assignment.
 *
 * @param sticky - Sticky value from resolved tracking metadata.
 * @param alreadyAccepted - Whether the rendered entry already accepted a sticky event.
 * @returns `true` when the SDK should include `sticky: true`.
 *
 * @public
 */
export const shouldSendStickyEntryView = (
  sticky: boolean | undefined,
  alreadyAccepted: boolean,
): boolean => sticky === true && !alreadyAccepted

/**
 * Decide whether a sticky entry-view result should be remembered by the runtime.
 *
 * @param stickySent - Whether the event included `sticky: true`.
 * @param accepted - Whether the event was accepted by Core.
 * @returns `true` when platform-local sticky state should record success.
 *
 * @public
 */
export const shouldRememberStickyEntryViewResult = (
  stickySent: boolean,
  accepted: boolean,
): boolean => stickySent && accepted
