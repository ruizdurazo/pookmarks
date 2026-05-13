import styles from "./BookmarkFlatList.module.scss"
import * as ContextMenu from "@radix-ui/react-context-menu"
import EditBookmarkDialog from "./EditBookmarkDialog"
import {
  forwardRef,
  useRef,
  useState,
  useEffect,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react"
import { useBookmarkPreview } from "../hooks/useBookmarkPreview"
import { handleBookmarkClick } from "../utils/bookmarkNavigation"
import {
  getBookmarkCount,
  openAllInNewTabs,
  openAllInNewWindow,
  openAllInNewTabGroup,
} from "../utils/bookmarkUtils"
import FolderIcon from "../assets/icons/folder.svg?react"
import { getBookmarkIcon } from "../utils/iconUtils"
import { useTranslation } from "react-i18next"
import { findFoldedMatchRangesForQuery } from "../utils/searchNormalize.ts"

interface BookmarkFlatListProps {
  nodes: chrome.bookmarks.BookmarkTreeNode[]
  searchQuery: string
  onRefresh: () => void
  onOpenFolderInTree?: (nodeId: string) => void
}

const BookmarkFlatList = ({
  nodes,
  searchQuery,
  onRefresh,
  onOpenFolderInTree,
}: BookmarkFlatListProps) => {
  const { t } = useTranslation()
  const highlightText = (text: string, query: string): ReactNode => {
    if (!query) return text
    const ranges = findFoldedMatchRangesForQuery(text, query)
    if (ranges.length === 0) return text

    const parts: ReactNode[] = []
    let cursor = 0
    for (let idx = 0; idx < ranges.length; idx++) {
      const { start, end } = ranges[idx]!
      if (start > cursor) {
        parts.push(text.slice(cursor, start))
      }
      parts.push(
        <span key={`h-${idx}`} className={styles.highlight}>
          {text.slice(start, end)}
        </span>,
      )
      cursor = end
    }
    if (cursor < text.length) {
      parts.push(text.slice(cursor))
    }
    return parts
  }

  const [editingNode, setEditingNode] =
    useState<chrome.bookmarks.BookmarkTreeNode | null>(null)

  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const clickPositionRef = useRef<{ x: number; y: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [menuElement, setMenuElement] = useState<HTMLDivElement | null>(null)

  const [isMenuOpening, setIsMenuOpening] = useState(false)

  useEffect(() => {
    // console.log("isMenuOpening", isMenuOpening)
    // console.log("clickPositionRef", clickPositionRef.current)
    // console.log("menuElement", menuElement)
    if (isMenuOpening && clickPositionRef.current && menuElement) {
      requestAnimationFrame(() => {
        const menu = menuElement // Use the state-captured element
        // console.log("menu", menu)
        if (!menu) return // Safety check, though unlikely now

        const menuRect = menu.getBoundingClientRect()
        const padding = 8 // Buffer to avoid edge cutoff

        let left = clickPositionRef.current?.x ?? 0
        // console.log("left", left)
        if (left + menuRect.width + padding > document.body.clientWidth) {
          // console.log("width overflow")
          left = -(
            left -
            (document.body.clientWidth - menuRect.width - padding)
          )
        } else {
          left = 0
        }

        let top = clickPositionRef.current?.y ?? 0
        // console.log("top", top)
        if (top + menuRect.height + padding > document.body.clientHeight) {
          // console.log("height overflow")
          top = -menuRect.height
        } else {
          top = 0
        }

        menu.style.position = "absolute"
        menu.style.left = `${left}px`
        menu.style.top = `${top}px`
        menu.style.transform = "none" // Override any Floating UI transform
      })
    }
  }, [isMenuOpening, menuElement]) // Re-run when opening or when element mounts

  return (
    <>
      <div className={styles.list} ref={listContainerRef}>
        {nodes.map((node) => {
          const isFolder = !!node.children
          const isTopLevel = node.id === "1" || node.id === "2"
          const bookmarkCount = isFolder ? getBookmarkCount(node) : 0

          return (
            <ContextMenu.Root
              key={node.id}
              onOpenChange={(open) => {
                setIsMenuOpening(open) // Triggers the useEffect on true
              }}
            >
              <ContextMenu.Trigger asChild>
                {node.children ? (
                  <button
                    type="button"
                    className={`${styles.item} ${styles.folder}`}
                    onClick={(event) => {
                      onOpenFolderInTree?.(node.id)
                      ;(event.currentTarget as HTMLElement).blur()
                    }}
                    onContextMenu={(e) =>
                      (clickPositionRef.current = {
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }
                  >
                    <div className={styles.icon}>
                      <FolderIcon />
                    </div>
                    <div className={styles.title}>
                      {highlightText(node.title, searchQuery)}
                    </div>
                  </button>
                ) : (
                  <BookmarkFlatListBookmarkButton
                    highlightText={highlightText}
                    node={node}
                    searchQuery={searchQuery}
                    onClick={(event) => {
                      handleBookmarkClick(event, node.url)
                      ;(event.currentTarget as HTMLElement).blur() // Release focus from extension
                    }}
                    onContextMenu={(e) =>
                      (clickPositionRef.current = {
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }
                  />
                )}
              </ContextMenu.Trigger>

              <ContextMenu.Portal>
                <ContextMenu.Content
                  ref={(el) => {
                    contentRef.current = el // Keep the mutable ref for other uses if needed
                    setMenuElement(el) // Trigger state update when mounted/unmounted
                  }}
                  className={styles.contextMenu}
                  collisionBoundary={listContainerRef.current}
                  avoidCollisions={true}
                  sticky="partial"
                >
                  {isFolder && !isTopLevel && (
                    <>
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => openAllInNewTabs(node)}
                      >
                        {t("openAll", { count: bookmarkCount })}
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => openAllInNewWindow(node)}
                      >
                        {t("openAllInNewWindow", { count: bookmarkCount })}
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => openAllInNewTabGroup(node)}
                      >
                        {t("openAllInNewTabGroup", { count: bookmarkCount })}
                      </ContextMenu.Item>
                      <ContextMenu.Separator
                        className={styles.contextMenuSeparator}
                      />
                    </>
                  )}
                  {!isFolder && (
                    <>
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => {
                          if (node.url) chrome.tabs.create({ url: node.url })
                        }}
                      >
                        {t("openInNewTab")}
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => {
                          if (node.url) chrome.windows.create({ url: node.url })
                        }}
                      >
                        {t("openInNewWindow")}
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => {
                          if (node.url)
                            chrome.tabs
                              .create({ url: node.url })
                              .then((tab) => {
                                if (tab.id) {
                                  chrome.tabs
                                    .group({ tabIds: [tab.id] })
                                    .then((groupId) => {
                                      chrome.tabGroups.update(groupId, {
                                        title: node.title,
                                      })
                                    })
                                }
                              })
                        }}
                      >
                        {t("openInNewTabGroup")}
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => {
                          if (node.url)
                            chrome.windows.create({
                              url: node.url,
                              incognito: true,
                            })
                        }}
                      >
                        {t("openInNewIncognitoWindow")}
                      </ContextMenu.Item>
                      <ContextMenu.Separator
                        className={styles.contextMenuSeparator}
                      />
                    </>
                  )}
                  {!isTopLevel && (
                    <>
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => setEditingNode(node)}
                      >
                        {isFolder ? t("rename") : t("edit")}
                      </ContextMenu.Item>
                      <ContextMenu.Separator
                        className={styles.contextMenuSeparator}
                      />
                      <ContextMenu.Item
                        className={styles.contextMenuItem}
                        onSelect={() => {
                          const removeFunction = isFolder
                            ? chrome.bookmarks.removeTree
                            : chrome.bookmarks.remove
                          removeFunction(node.id, () => onRefresh())
                        }}
                      >
                        {t("delete")}
                      </ContextMenu.Item>
                    </>
                  )}
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          )
        })}
      </div>

      {/* Edit Bookmark Dialog */}
      {editingNode && (
        <EditBookmarkDialog
          node={editingNode!}
          onRefresh={onRefresh}
          onClose={() => setEditingNode(null)}
        />
      )}
    </>
  )
}

export default BookmarkFlatList

interface BookmarkFlatListBookmarkButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  highlightText: (text: string, query: string) => ReactNode
  node: chrome.bookmarks.BookmarkTreeNode
  searchQuery: string
}

const BookmarkFlatListBookmarkButton = forwardRef<
  HTMLDivElement,
  BookmarkFlatListBookmarkButtonProps
>(function BookmarkFlatListBookmarkButton(
  { className, highlightText, node, searchQuery, ...buttonProps },
  ref,
) {
  const { previewElement, previewTriggerProps } = useBookmarkPreview({
    fallbackTitle: node.title,
    url: node.url || undefined,
  })

  return (
    <div ref={ref} className={styles.bookmarkRow} {...previewTriggerProps}>
      <button
        type="button"
        className={`${styles.item} ${styles.bookmark} ${className ?? ""}`}
        {...buttonProps}
      >
        <div className={`${styles.icon} ${styles.bookmarkIcon}`}>
          {getBookmarkIcon(node.url)}
        </div>
        <div className={styles.title}>
          {highlightText(node.title, searchQuery)}
        </div>
      </button>
      {previewElement}
    </div>
  )
})
