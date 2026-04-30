export const BOOKMARK_PREVIEW_MESSAGE = "bookmark-preview:get"

export interface BookmarkPreviewRequest {
  type: typeof BOOKMARK_PREVIEW_MESSAGE
  url: string
}

export interface BookmarkPreviewMetadata {
  url: string
  finalUrl: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

export type BookmarkPreviewResponse =
  | {
      ok: true
      preview: BookmarkPreviewMetadata
    }
  | {
      ok: false
      error: string
    }

export function requestBookmarkPreview(
  url: string,
): Promise<BookmarkPreviewMetadata> {
  return new Promise((resolve, reject) => {
    const message: BookmarkPreviewRequest = {
      type: BOOKMARK_PREVIEW_MESSAGE,
      url,
    }

    chrome.runtime.sendMessage(message, (response?: BookmarkPreviewResponse) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        reject(new Error(runtimeError.message))
        return
      }

      if (!response) {
        reject(new Error("No preview response received."))
        return
      }

      if (!response.ok) {
        reject(new Error(response.error))
        return
      }

      resolve(response.preview)
    })
  })
}
