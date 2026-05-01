import { clsx } from "clsx"
import { useLayoutEffect, useState, type CSSProperties } from "react"
import type { BookmarkPreviewMetadata } from "../utils/bookmarkPreview"
import styles from "./BookmarkPreview.module.scss"

export type PreviewStatus = "idle" | "loading" | "ready" | "error"

export type PreviewPlacement = "above" | "below"

export interface PreviewPosition {
  left: number
  placement: PreviewPlacement
  top: number
}

interface BookmarkPreviewCardProps {
  fallbackTitle: string
  instant?: boolean
  loadingLabel: string
  position: PreviewPosition
  preview: BookmarkPreviewMetadata | null
  status: PreviewStatus
  unavailableLabel: string
  url: string
}

export function BookmarkPreviewCard({
  fallbackTitle,
  instant = false,
  loadingLabel,
  position,
  preview,
  status,
  unavailableLabel,
  url,
}: BookmarkPreviewCardProps) {
  const title = preview?.title || fallbackTitle
  const displayUrl = getDisplayUrl(preview?.finalUrl ?? url)
  const [entered, setEntered] = useState(instant)

  useLayoutEffect(() => {
    if (instant) {
      setEntered(true)
      return
    }
    let cancelled = false
    let innerId = 0
    const outerId = requestAnimationFrame(() => {
      if (cancelled) return
      innerId = requestAnimationFrame(() => {
        if (!cancelled) setEntered(true)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outerId)
      cancelAnimationFrame(innerId)
    }
  }, [instant])

  const showFinal = instant || entered

  const style: CSSProperties = {
    left: position.left,
    top: position.top,
  }

  return (
    <aside
      className={clsx(
        styles.card,
        position.placement === "above"
          ? styles.placementAbove
          : styles.placementBelow,
        showFinal && styles.visible,
      )}
      data-instant={instant ? "" : undefined}
      style={style}
      role="tooltip"
    >
      {status === "loading" && (
        <>
          <div className={styles.title}>{fallbackTitle}</div>
          <div className={styles.description}>{loadingLabel}</div>
        </>
      )}

      {status === "error" && (
        <>
          <div className={styles.title}>{fallbackTitle}</div>
          <div className={styles.status}>{unavailableLabel}</div>
          <div className={styles.url}>{displayUrl}</div>
        </>
      )}

      {status === "ready" && (
        <>
          {preview?.image && (
            <img
              alt=""
              className={styles.image}
              referrerPolicy="no-referrer"
              src={preview.image}
            />
          )}
          {preview?.siteName && (
            <div className={styles.siteName}>{preview.siteName}</div>
          )}
          <div className={styles.title}>{title}</div>
          {preview?.description && (
            <div className={styles.description}>{preview.description}</div>
          )}
          <div className={styles.url}>{displayUrl}</div>
        </>
      )}
    </aside>
  )
}

function getDisplayUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return url.hostname.replace(/^www\./, "")
  } catch {
    return rawUrl
  }
}
