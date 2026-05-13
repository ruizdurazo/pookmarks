const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
})

/** Case- and combining-mark-insensitive folding for bookmark search. */
export function foldForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}

export function matchesFolded(haystack: string, needle: string): boolean {
  if (!needle) return true
  return foldForSearch(haystack).includes(foldForSearch(needle))
}

/** Whitespace-separated pieces; drops segments that fold to nothing (e.g. only marks). */
export function parseSearchTokens(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => foldForSearch(t).length > 0)
}

/**
 * Every search token must appear as a substring of `haystack` after {@link foldForSearch}.
 * Whitespace-only or empty queries yield no tokens → false (do not match all nodes).
 */
export function matchesAllFoldedTokens(haystack: string, query: string): boolean {
  const tokens = parseSearchTokens(query)
  if (tokens.length === 0) return false
  const foldedHaystack = foldForSearch(haystack)
  return tokens.every((token) =>
    foldedHaystack.includes(foldForSearch(token)),
  )
}

/** Same OR semantics as legacy search: all tokens in title, or all tokens in URL. */
export function matchesBookmarkSearch(
  title: string,
  url: string | undefined,
  query: string,
): boolean {
  return (
    matchesAllFoldedTokens(title, query) ||
    (url !== undefined && matchesAllFoldedTokens(url, query))
  )
}

function mergeMatchRanges(
  ranges: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: Array<{ start: number; end: number }> = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end)
    } else {
      out.push({ start: r.start, end: r.end })
    }
  }
  return out
}

function buildFoldMap(text: string): {
  folded: string
  origStart: number[]
  origEnd: number[]
} {
  const foldedChars: string[] = []
  const origStart: number[] = []
  const origEnd: number[] = []

  for (const { segment, index } of graphemeSegmenter.segment(text)) {
    const foldedSeg = foldForSearch(segment)
    const start = index
    const end = index + segment.length
    for (const ch of foldedSeg) {
      foldedChars.push(ch)
      origStart.push(start)
      origEnd.push(end)
    }
  }

  return {
    folded: foldedChars.join(""),
    origStart,
    origEnd,
  }
}

/**
 * Ranges in the original string that match the query under {@link foldForSearch}.
 * Non-overlapping; scans left to right.
 */
export function findFoldedMatchRanges(
  text: string,
  query: string,
): Array<{ start: number; end: number }> {
  const fq = foldForSearch(query)
  if (!fq) return []

  const { folded, origStart, origEnd } = buildFoldMap(text)
  if (fq.length > folded.length) return []

  const ranges: Array<{ start: number; end: number }> = []
  let i = 0
  while (i <= folded.length - fq.length) {
    if (folded.slice(i, i + fq.length) === fq) {
      ranges.push({
        start: origStart[i]!,
        end: origEnd[i + fq.length - 1]!,
      })
      i += fq.length
    } else {
      i += 1
    }
  }
  return ranges
}

/**
 * Highlight ranges for a multi-token query: each token is matched with {@link findFoldedMatchRanges};
 * overlapping / touching ranges in the original string are merged.
 */
export function findFoldedMatchRangesForQuery(
  text: string,
  query: string,
): Array<{ start: number; end: number }> {
  const tokens = parseSearchTokens(query)
  if (tokens.length === 0) return []

  const all: Array<{ start: number; end: number }> = []
  for (const token of tokens) {
    all.push(...findFoldedMatchRanges(text, token))
  }
  return mergeMatchRanges(all)
}
