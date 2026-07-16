const MAX_NEXTJS_PUBLIC_PERMUTATION_CACHE_TAGS = 128
const MAX_NEXTJS_PUBLIC_PERMUTATION_CACHE_TAG_LENGTH = 256
const NEXTJS_PUBLIC_PERMUTATION_CACHE_TAG_ERROR =
  'Next.js public permutation cache tags must be an array of up to 128 non-empty strings, each 256 characters or fewer and without commas.'

export function validateNextjsPublicPermutationCacheTags(
  tags: unknown,
): asserts tags is readonly string[] | undefined {
  if (tags === undefined) return

  if (
    !Array.isArray(tags) ||
    tags.length > MAX_NEXTJS_PUBLIC_PERMUTATION_CACHE_TAGS ||
    tags.some(
      (tag) =>
        typeof tag !== 'string' ||
        tag.trim() === '' ||
        tag.length > MAX_NEXTJS_PUBLIC_PERMUTATION_CACHE_TAG_LENGTH ||
        tag.includes(','),
    )
  ) {
    throw new TypeError(NEXTJS_PUBLIC_PERMUTATION_CACHE_TAG_ERROR)
  }
}
