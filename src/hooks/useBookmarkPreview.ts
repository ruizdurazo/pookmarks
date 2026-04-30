import { createElement, useEffect, useRef, useState } from "react"
import type { MouseEvent, PointerEvent } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import {
  BookmarkPreviewCard,
  type PreviewPosition,
  type PreviewStatus,
} from "../components/BookmarkPreview"
import {
  requestBookmarkPreview,
  type BookmarkPreviewMetadata,
} from "../utils/bookmarkPreview"

const HOVER_DELAY_MS = 2000
const CARD_WIDTH = 300
const CARD_MARGIN = 12
const ESTIMATED_CARD_HEIGHT = 220

interface UseBookmarkPreviewOptions {
  disabled?: boolean
  fallbackTitle: string
  url?: string
}

export function useBookmarkPreview({
  disabled,
  fallbackTitle,
  url,
}: UseBookmarkPreviewOptions) {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<PreviewPosition | null>(null)
  const [preview, setPreview] = useState<BookmarkPreviewMetadata | null>(null)
  const [status, setStatus] = useState<PreviewStatus>("idle")
  const timerRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)
  const pointerRef = useRef({ x: 0, y: 0 })
  const isVisibleRef = useRef(false)

  useEffect(() => {
    isVisibleRef.current = isVisible
  }, [isVisible])

  const clearPreviewTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const hidePreview = () => {
    clearPreviewTimer()
    requestIdRef.current += 1
    setIsVisible(false)
    setPosition(null)
    setStatus("idle")
    setPreview(null)
  }

  useEffect(() => {
    if (disabled || !url) {
      hidePreview()
    }

    return hidePreview
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, url])

  const startHoverProbe = (clientX: number, clientY: number) => {
    if (disabled || !url) {
      return
    }

    clearPreviewTimer()
    requestIdRef.current += 1
    const requestId = requestIdRef.current
    pointerRef.current = {
      x: clientX,
      y: clientY,
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const { x, y } = pointerRef.current
      setPosition(getPreviewPositionFromPointer(x, y))
      setIsVisible(true)
      setStatus("loading")
      setPreview(null)

      requestBookmarkPreview(url)
        .then((nextPreview) => {
          if (requestIdRef.current !== requestId) {
            return
          }

          setPreview(nextPreview)
          setStatus("ready")
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) {
            return
          }

          setStatus("error")
        })
    }, HOVER_DELAY_MS)
  }

  const handlePointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") {
      return
    }

    startHoverProbe(event.clientX, event.clientY)
  }

  const handleMouseEnter = (event: MouseEvent<HTMLElement>) => {
    startHoverProbe(event.clientX, event.clientY)
  }

  const updateHoverCursor = (clientX: number, clientY: number) => {
    if (disabled || !url) {
      return
    }

    pointerRef.current = {
      x: clientX,
      y: clientY,
    }

    if (isVisibleRef.current) {
      setPosition(getPreviewPositionFromPointer(clientX, clientY))
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") {
      return
    }

    updateHoverCursor(event.clientX, event.clientY)
  }

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    updateHoverCursor(event.clientX, event.clientY)
  }

  const previewElement =
    isVisible && position && url
      ? createPortal(
          createElement(BookmarkPreviewCard, {
            fallbackTitle,
            loadingLabel: t("previewLoading", {
              defaultValue: "Loading preview...",
            }),
            position,
            preview,
            status,
            unavailableLabel: t("previewUnavailable", {
              defaultValue: "Preview unavailable",
            }),
            url,
          }),
          document.body,
        )
      : null

  return {
    previewElement,
    previewTriggerProps: {
      onMouseDown: hidePreview,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: hidePreview,
      onMouseMove: handleMouseMove,
      onPointerCancel: hidePreview,
      onPointerDown: hidePreview,
      onPointerEnter: handlePointerEnter,
      onPointerLeave: hidePreview,
      onPointerMove: handlePointerMove,
    },
  }
}

function getPlacement(clientY: number): PreviewPosition["placement"] {
  const gap = 12
  const spaceAbove = clientY - CARD_MARGIN
  const spaceBelow = window.innerHeight - CARD_MARGIN - clientY
  if (spaceAbove >= ESTIMATED_CARD_HEIGHT + gap) {
    return "above"
  }
  if (spaceBelow >= ESTIMATED_CARD_HEIGHT + gap) {
    return "below"
  }
  return spaceAbove >= spaceBelow ? "above" : "below"
}

function getPreviewPositionFromPointer(
  clientX: number,
  clientY: number,
): PreviewPosition {
  const width = Math.min(CARD_WIDTH, window.innerWidth - CARD_MARGIN * 2)
  const halfW = width / 2
  const left = clamp(
    clientX,
    CARD_MARGIN + halfW,
    window.innerWidth - CARD_MARGIN - halfW,
  )
  const top = clamp(
    clientY,
    CARD_MARGIN + 8,
    window.innerHeight - CARD_MARGIN - 8,
  )

  return {
    left,
    placement: getPlacement(clientY),
    top,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
