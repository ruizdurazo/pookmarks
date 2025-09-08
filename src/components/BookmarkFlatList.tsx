import styles from "./BookmarkFlatList.module.scss"
import * as ContextMenu from "@radix-ui/react-context-menu"
import EditBookmarkDialog from "./EditBookmarkDialog"
import { useState } from "react"
import { handleBookmarkClick } from "../utils/bookmarkNavigation"
import {
  getBookmarkCount,
  openAllInNewTabs,
  openAllInNewWindow,
  openAllInNewTabGroup,
} from "../utils/bookmarkUtils"
import FolderIcon from "../assets/icons/folder.svg?react"
import YoutubeIcon from "../assets/icons/youtube.svg?react"
import LinkIcon from "../assets/icons/globe.svg?react"

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
  const highlightText = (text: string, query: string) => {
    if (!query) return text
    const regex = new RegExp(`(${query})`, "gi")
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className={styles.highlight}>
          {part}
        </span>
      ) : (
        part
      ),
    )
  }

  const [editingNode, setEditingNode] =
    useState<chrome.bookmarks.BookmarkTreeNode | null>(null)

  return (
    <>
      <ul className={styles.list}>
        {nodes.map((node) => {
          const isFolder = !!node.children
          const isTopLevel = node.id === "1" || node.id === "2"
          const bookmarkCount = isFolder ? getBookmarkCount(node) : 0

          return (
            <li key={node.id} className={styles.item}>
              <ContextMenu.Root>
                <ContextMenu.Trigger asChild>
                  {node.children ? (
                    <div
                      className={styles.folder}
                      onClick={(event) => {
                        onOpenFolderInTree?.(node.id)
                        ;(event.currentTarget as HTMLElement).blur()
                      }}
                    >
                      <div className={styles.icon}><FolderIcon /></div>
                      <div className={styles.title}>
                        {highlightText(node.title, searchQuery)}
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={(event) => {
                        handleBookmarkClick(event, node.url)
                        ;(event.currentTarget as HTMLElement).blur() // Release focus from extension
                      }}
                      className={styles.bookmark}
                    >
                      <div className={styles.icon}>
                        {/* TODO: Add icons for other websites */}
                        {node.url?.includes("youtube.com") ? <YoutubeIcon /> : <LinkIcon />}
                      </div>
                      <div className={styles.title}>
                        {highlightText(node.title, searchQuery)}
                      </div>
                    </div>
                  )}
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Content className={styles.contextMenu}>
                    {isFolder && !isTopLevel && (
                      <>
                        <ContextMenu.Item
                          className={styles.contextMenuItem}
                          onSelect={() => openAllInNewTabs(node)}
                        >
                          Open All ({bookmarkCount})
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          className={styles.contextMenuItem}
                          onSelect={() => openAllInNewWindow(node)}
                        >
                          Open All ({bookmarkCount}) in New Window
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          className={styles.contextMenuItem}
                          onSelect={() => openAllInNewTabGroup(node)}
                        >
                          Open All ({bookmarkCount}) in New Tab Group
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
                          Open in New Tab
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          className={styles.contextMenuItem}
                          onSelect={() => {
                            if (node.url)
                              chrome.windows.create({ url: node.url })
                          }}
                        >
                          Open in New Window
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
                          {isFolder ? "Rename" : "Edit"}
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
                          Delete
                        </ContextMenu.Item>
                      </>
                    )}
                  </ContextMenu.Content>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            </li>
          )
        })}
      </ul>

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
