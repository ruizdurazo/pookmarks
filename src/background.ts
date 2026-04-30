import type {
  BookmarkPreviewMetadata,
  BookmarkPreviewRequest,
  BookmarkPreviewResponse,
} from "./utils/bookmarkPreview"

const BOOKMARK_PREVIEW_MESSAGE = "bookmark-preview:get"
const PREVIEW_CACHE_TTL_MS = 1000 * 60 * 60 * 24
const PREVIEW_FETCH_TIMEOUT_MS = 8000
const MAX_HTML_CHARS = 500_000

interface CachedPreview {
  expiresAt: number
  preview: BookmarkPreviewMetadata
}

const previewCache = new Map<string, CachedPreview>()

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error))
})

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-pookmarks") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id })
      }
    })
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isBookmarkPreviewRequest(message)) {
    return false
  }

  getBookmarkPreview(message.url)
    .then((preview) => {
      const response: BookmarkPreviewResponse = { ok: true, preview }
      sendResponse(response)
    })
    .catch((error: unknown) => {
      const response: BookmarkPreviewResponse = {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unable to load preview.",
      }
      sendResponse(response)
    })

  return true
})

function isBookmarkPreviewRequest(
  message: unknown,
): message is BookmarkPreviewRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    "url" in message &&
    message.type === BOOKMARK_PREVIEW_MESSAGE &&
    typeof message.url === "string"
  )
}

async function getBookmarkPreview(
  rawUrl: string,
): Promise<BookmarkPreviewMetadata> {
  const url = normalizePreviewUrl(rawUrl)
  const cached = previewCache.get(url)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.preview
  }

  const preview = await fetchBookmarkPreview(url)
  previewCache.set(url, {
    expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
    preview,
  })

  return preview
}

function normalizePreviewUrl(rawUrl: string) {
  const url = new URL(rawUrl)

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS bookmarks can be previewed.")
  }

  return url.toString()
}

async function fetchBookmarkPreview(
  url: string,
): Promise<BookmarkPreviewMetadata> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PREVIEW_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Preview request failed with ${response.status}.`)
    }

    const finalUrl = response.url || url
    const contentType = response.headers.get("content-type") ?? ""

    if (!isHtmlContent(contentType)) {
      return { url, finalUrl }
    }

    const html = (await response.text()).slice(0, MAX_HTML_CHARS)
    return {
      url,
      finalUrl,
      ...extractPreviewMetadata(html, finalUrl),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function isHtmlContent(contentType: string) {
  const normalizedContentType = contentType.toLowerCase()

  return (
    normalizedContentType.includes("text/html") ||
    normalizedContentType.includes("application/xhtml+xml") ||
    normalizedContentType === ""
  )
}

function extractPreviewMetadata(html: string, baseUrl: string) {
  const metaTags = getMetaTags(html)
  const title =
    getMetaContent(metaTags, ["og:title", "twitter:title"]) ??
    getDocumentTitle(html)
  const description = getMetaContent(metaTags, [
    "og:description",
    "twitter:description",
    "description",
  ])
  const image = resolvePreviewImage(
    getMetaContent(metaTags, ["og:image", "twitter:image", "twitter:image:src"]),
    baseUrl,
  )
  const siteName = getMetaContent(metaTags, ["og:site_name", "application-name"])

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(siteName ? { siteName } : {}),
  }
}

function getMetaTags(html: string) {
  const tags: Record<string, string>[] = []
  const metaTagPattern = /<meta\s+[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = metaTagPattern.exec(html)) !== null) {
    const tag = match[0]
    const attributes = parseAttributes(tag)
    const key = attributes.property ?? attributes.name ?? attributes.itemprop

    if (key && attributes.content) {
      tags.push({
        key: key.toLowerCase(),
        content: attributes.content,
      })
    }
  }

  return tags
}

function parseAttributes(tag: string) {
  const attributes: Record<string, string> = {}
  const attributePattern =
    /([^\s"'=<>`]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
  let match: RegExpExecArray | null

  while ((match = attributePattern.exec(tag)) !== null) {
    const [, rawName, doubleQuotedValue, singleQuotedValue, unquotedValue] = match
    const name = rawName.toLowerCase()
    const value = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? ""
    attributes[name] = decodeHtml(value)
  }

  return attributes
}

function getMetaContent(tags: Record<string, string>[], keys: string[]) {
  const wantedKeys = new Set(keys)
  const tag = tags.find(({ key, content }) => wantedKeys.has(key) && content)

  return tag ? cleanText(tag.content) : undefined
}

function getDocumentTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)

  return titleMatch ? cleanText(decodeHtml(stripTags(titleMatch[1]))) : undefined
}

function resolvePreviewImage(imageUrl: string | undefined, baseUrl: string) {
  if (!imageUrl) {
    return undefined
  }

  try {
    const resolvedUrl = new URL(imageUrl, baseUrl)

    if (resolvedUrl.protocol !== "http:" && resolvedUrl.protocol !== "https:") {
      return undefined
    }

    return resolvedUrl.toString()
  } catch {
    return undefined
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ")
}

function decodeHtml(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  }

  return value.replace(/&(#x?[0-9a-f]+|\w+);/gi, (entity, rawCode) => {
    const code = rawCode.toLowerCase()

    if (code.startsWith("#x")) {
      const parsed = Number.parseInt(code.slice(2), 16)
      return Number.isNaN(parsed) ? entity : String.fromCodePoint(parsed)
    }

    if (code.startsWith("#")) {
      const parsed = Number.parseInt(code.slice(1), 10)
      return Number.isNaN(parsed) ? entity : String.fromCodePoint(parsed)
    }

    return namedEntities[code] ?? entity
  })
}
