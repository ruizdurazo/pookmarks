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
import { getBookmarkIcon } from "../utils/iconUtils"
import { useTranslation } from "react-i18next"

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
      <div className={styles.list}>
        {nodes.map((node) => {
          const isFolder = !!node.children
          const isTopLevel = node.id === "1" || node.id === "2"
          const bookmarkCount = isFolder ? getBookmarkCount(node) : 0

          return (
            <ContextMenu.Root key={node.id}>
              <ContextMenu.Trigger asChild>
                {node.children ? (
                  <button
                    type="button"
                    className={`${styles.item} ${styles.folder}`}
                    onClick={(event) => {
                      onOpenFolderInTree?.(node.id)
                      ;(event.currentTarget as HTMLElement).blur()
                    }}
                  >
                    <div className={styles.icon}>
                      <FolderIcon />
                    </div>
                    <div className={styles.title}>
                      {highlightText(node.title, searchQuery)}
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.item} ${styles.bookmark}`}
                    onClick={(event) => {
                      handleBookmarkClick(event, node.url)
                      ;(event.currentTarget as HTMLElement).blur() // Release focus from extension
                    }}
                  >
                    <div className={`${styles.icon} ${styles.bookmarkIcon}`}>
                      {getBookmarkIcon(node.url)}
                    </div>
                    <div className={styles.title}>
                      {highlightText(node.title, searchQuery)}
                    </div>
                  </button>
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
