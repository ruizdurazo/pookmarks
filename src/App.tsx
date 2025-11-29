import BookmarkTree from "./components/BookmarkTree.tsx"
import BookmarkFlatList from "./components/BookmarkFlatList.tsx"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import styles from "./App.module.scss"
import * as Select from "@radix-ui/react-select"
import EditBookmarkDialog from "./components/EditBookmarkDialog"
import BookmarkIcon from "./assets/icons/bookmark-plus.svg?react"
import FolderIcon from "./assets/icons/folder-plus.svg?react"
import SortIcon from "./assets/icons/sort.svg?react"
import SearchIcon from "./assets/icons/search.svg?react"
import CheckmarkIcon from "./assets/icons/checkmark.svg?react"
import { useTranslation } from "react-i18next"

function App() {
  const { t } = useTranslation()

  //
  // State
  //

  const [bookmarks, setBookmarks] = useState<
    chrome.bookmarks.BookmarkTreeNode[]
  >([])
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const toggleFolder = useCallback((id: string) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{
    nodes: chrome.bookmarks.BookmarkTreeNode[]
    forQuery: string
  }>({ nodes: [], forQuery: "" })

  const [isDarkMode, setIsDarkMode] = useState(false)
  const [sortType, setSortType] = useState<
    "none" | "newest" | "oldest" | "a-z" | "z-a"
  >("none")

  useEffect(() => {
    chrome.storage.local.get(["sortType"], (result) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError)
        return
      }
      if (result.sortType) {
        setSortType(result.sortType as typeof sortType)
      }
    })
  }, [])

  useEffect(() => {
    chrome.storage.local.set({ sortType }, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError)
      }
    })
  }, [sortType])

  const [showNewBookmarkDialog, setShowNewBookmarkDialog] = useState(false)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [initialBookmarkData, setInitialBookmarkData] = useState({
    title: "",
    url: "",
  })

  const sortTypeOptions = [
    { value: "none", label: t("sortCustom") },
    { value: "newest", label: t("sortNewest") },
    { value: "oldest", label: t("sortOldest") },
    { value: "a-z", label: t("sortAZ") },
    { value: "z-a", label: t("sortZA") },
  ]

  const getSortFunc = useCallback(
    (sortType: string) =>
      (
        a: chrome.bookmarks.BookmarkTreeNode,
        b: chrome.bookmarks.BookmarkTreeNode,
      ) => {
        const getMaxDate = (
          node: chrome.bookmarks.BookmarkTreeNode,
        ): number => {
          let max = node.dateAdded ?? 0
          if (node.children) {
            for (const child of node.children) {
              max = Math.max(max, getMaxDate(child))
            }
          }
          return max
        }
        const getMinDate = (
          node: chrome.bookmarks.BookmarkTreeNode,
        ): number => {
          let min = node.dateAdded ?? 0
          if (node.children) {
            for (const child of node.children) {
              min = Math.min(min, getMinDate(child))
            }
          }
          return min
        }
        if (sortType === "a-z") return a.title.localeCompare(b.title)
        if (sortType === "z-a") return b.title.localeCompare(a.title)
        if (sortType === "newest") return getMaxDate(b) - getMaxDate(a)
        if (sortType === "oldest") return getMinDate(a) - getMinDate(b)
        return 0
      },
    [],
  )

  const sortedBookmarks = useMemo(() => {
    if (sortType === "none") return bookmarks

    const sortFunc = getSortFunc(sortType)

    const sortRecursive = (
      nodes: chrome.bookmarks.BookmarkTreeNode[],
    ): chrome.bookmarks.BookmarkTreeNode[] => {
      const sorted = [...nodes].sort(sortFunc)
      return sorted.map((node) => ({
        ...node,
        children: node.children ? sortRecursive(node.children) : undefined,
      }))
    }

    return sortRecursive(bookmarks)
  }, [bookmarks, sortType, getSortFunc])

  const nodeMap = useMemo(() => {
    const map = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      nodes.forEach((node) => {
        map.set(node.id, node)
        if (node.children) traverse(node.children)
      })
    }
    traverse(sortedBookmarks)
    return map
  }, [sortedBookmarks])

  const visibleNodes = useMemo(() => {
    const result: { id: string; level: number }[] = []
    const traverse = (
      nodes: chrome.bookmarks.BookmarkTreeNode[],
      level: number,
    ) => {
      nodes.forEach((node) => {
        result.push({ id: node.id, level })
        if (node.children && openFolders.has(node.id)) {
          traverse(node.children, level + 1)
        }
      })
    }
    traverse(sortedBookmarks, 0)
    return result
  }, [sortedBookmarks, openFolders])

  // const [lastFocusedId, setLastFocusedId] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [shouldCenterFocus, setShouldCenterFocus] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    if (isDarkMode) {
      // Dark mode
      root.style.setProperty("--app-color", "#320BBD")
      root.style.setProperty("--bg-color", "#222")
      root.style.setProperty("--border-color", "#555")
      root.style.setProperty("--input-border-color", "#444")
      root.style.setProperty("--input-focus-border-color", "#484848")
      root.style.setProperty("--bookmark-color", "#fff")
      root.style.setProperty("--bookmark-bg-color", "#3a3a3a")
      root.style.setProperty("--bookmark-tree-bg-color", "#282828")
      root.style.setProperty("--bookmark-highlight-color", "#0000ff80")
      root.style.setProperty("--action-color", "#000000")
      root.style.setProperty("--action-bg-color", "#ffffff")
      root.style.setProperty("--action-bg-hover-color", "#fafafa")
      root.style.setProperty("--secondary-action-color", "#ccc")
      root.style.setProperty("--secondary-action-bg-color", "transparent")
      root.style.setProperty("--secondary-action-bg-hover-color", "#333")
      root.style.setProperty("--dialog-bg-color", "#222")
    } else {
      // Light mode
      root.style.setProperty("--app-color", "#4e26e1")
      root.style.setProperty("--bg-color", "#fafafa")
      root.style.setProperty("--border-color", "#ddd")
      root.style.setProperty("--input-border-color", "#ddd")
      root.style.setProperty("--input-focus-border-color", "#aaa")
      root.style.setProperty("--bookmark-color", "#000")
      root.style.setProperty("--bookmark-bg-color", "#f4f4f4")
      root.style.setProperty("--bookmark-tree-bg-color", "#fff")
      root.style.setProperty("--bookmark-highlight-color", "#ffff0080")
      root.style.setProperty("--action-color", "#ffffff")
      root.style.setProperty("--action-bg-color", "#000000")
      root.style.setProperty("--action-bg-hover-color", "#111111")
      root.style.setProperty("--secondary-action-color", "#333")
      root.style.setProperty("--secondary-action-bg-color", "transparent")
      root.style.setProperty("--secondary-action-bg-hover-color", "#f4f4f4")
      root.style.setProperty("--dialog-bg-color", "#fff")
    }
  }, [isDarkMode])

  const filterBookmarks = useCallback(
    (
      nodes: chrome.bookmarks.BookmarkTreeNode[],
      query: string,
    ): chrome.bookmarks.BookmarkTreeNode[] => {
      return nodes
        .map((node) => ({ ...node }))
        .filter((node) => {
          const matches =
            node.title.toLowerCase().includes(query.toLowerCase()) ||
            (node.url && node.url.toLowerCase().includes(query.toLowerCase()))
          if (node.children) {
            node.children = filterBookmarks(node.children, query)
            return matches || node.children.length > 0
          }
          return matches
        })
    },
    [],
  )

  const allFlatNodes = useMemo(() => {
    const results: chrome.bookmarks.BookmarkTreeNode[] = []
    const traverse = (currentNodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const node of currentNodes) {
        results.push(node)
        if (node.children) traverse(node.children)
      }
    }
    traverse(bookmarks)
    return results
  }, [bookmarks])

  const totalCount = allFlatNodes.length

  useEffect(() => {
    if (searchQuery === "") {
      setSearchResults({ nodes: [], forQuery: "" })
      return
    }

    const handler = setTimeout(() => {
      const lowerQuery = searchQuery.toLowerCase()
      const nodes = allFlatNodes.filter(
        (node) =>
          node.title.toLowerCase().includes(lowerQuery) ||
          (node.url && node.url.toLowerCase().includes(lowerQuery)),
      )

      let sortedNodes = nodes
      if (sortType !== "none") {
        sortedNodes = [...nodes].sort(getSortFunc(sortType))
      }

      setSearchResults({ nodes: sortedNodes, forQuery: searchQuery })
    }, 300)

    return () => clearTimeout(handler)
  }, [searchQuery, allFlatNodes, sortType, getSortFunc])

  useEffect(() => {
    const isIncognito = chrome.extension.inIncognitoContext
    if (isIncognito) {
      setIsDarkMode(true)
    } else {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      setIsDarkMode(mediaQuery.matches)
      const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches)
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  const refreshBookmarks = useCallback(() => {
    chrome.bookmarks.getTree((tree) => {
      setBookmarks(tree[0]?.children || [])
    })
  }, [])

  const handleAddBookmark = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    setInitialBookmarkData({ title: tab?.title || "", url: tab?.url || "" })
    setShowNewBookmarkDialog(true)
  }

  const handleAddFolder = () => {
    setShowNewFolderDialog(true)
  }

  const handleOpenFolderInTree = useCallback(
    (nodeId: string) => {
      setSearchQuery("")
      const newOpenFolders = new Set<string>()
      let current = nodeId
      while (current) {
        newOpenFolders.add(current)
        const node = nodeMap.get(current)
        if (!node || !node.parentId) break
        current = node.parentId
      }
      setOpenFolders(newOpenFolders)
      setShouldCenterFocus(true)
      setCurrentId(nodeId)
    },
    [nodeMap, setOpenFolders, setSearchQuery, setCurrentId],
  )

  useEffect(() => {
    refreshBookmarks()
  }, [refreshBookmarks])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keydown events from buttons with specific ids
      const target = e.target as HTMLElement
      if (
        target.id === "add-bookmark-button" ||
        target.id === "add-folder-button" ||
        target.id === "sort-trigger"
      ) {
        return
      }

      if (!currentId) return
      let currentIndex = visibleNodes.findIndex((v) => v.id === currentId)
      if (currentIndex === -1) {
        currentIndex = 0
        setCurrentId(visibleNodes[0]?.id ?? null)
        return
      }
      const currentLevel = visibleNodes[currentIndex].level
      const node = nodeMap.get(currentId)
      if (!node) return
      const isFolder = !!node.children
      const isOpen = openFolders.has(currentId)
      let newId: string | undefined
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          newId =
            visibleNodes[Math.min(currentIndex + 1, visibleNodes.length - 1)]
              ?.id
          break
        case "ArrowUp":
          e.preventDefault()
          newId = visibleNodes[Math.max(currentIndex - 1, 0)]?.id
          break
        case "ArrowRight":
          e.preventDefault()
          if (isFolder) {
            if (!isOpen) {
              toggleFolder(currentId)
            } else {
              const nextIndex = currentIndex + 1
              if (
                nextIndex < visibleNodes.length &&
                visibleNodes[nextIndex].level === currentLevel + 1
              ) {
                newId = visibleNodes[nextIndex].id
              }
            }
          }
          break
        case "ArrowLeft":
          e.preventDefault()
          if (isFolder && isOpen) {
            toggleFolder(currentId)
          } else {
            for (let j = currentIndex - 1; j >= 0; j--) {
              if (visibleNodes[j].level === currentLevel - 1) {
                newId = visibleNodes[j].id
                break
              }
            }
          }
          break
        case "Enter":
          e.preventDefault()
          if (isFolder) {
            toggleFolder(currentId)
          } else if (node.url) {
            if (e.shiftKey) {
              chrome.tabs.create({ url: node.url })
            } else {
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => {
                  if (tabs[0]?.id) {
                    const tabId = tabs[0].id
                    chrome.tabs.update(tabId, { url: node.url, active: true })
                    chrome.windows.update(tabs[0].windowId, { focused: true })
                    const onUpdated = (
                      updatedTabId: number,
                      changeInfo: { status?: string },
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      _tab: chrome.tabs.Tab,
                    ) => {
                      if (
                        updatedTabId === tabId &&
                        changeInfo.status === "complete"
                      ) {
                        chrome.tabs.onUpdated.removeListener(onUpdated)
                        chrome.scripting
                          .executeScript({
                            target: { tabId },
                            func: () => {
                              window.focus()
                              document.body.focus()
                            },
                          })
                          .catch((err) =>
                            console.log("Focus script failed:", err),
                          )
                      }
                    }
                    chrome.tabs.onUpdated.addListener(onUpdated)
                  }
                },
              )
            }
          }
          break
        default:
          return
      }
      if (newId && newId !== currentId) {
        setCurrentId(newId)
      }
    }
    const container = containerRef.current
    if (container) {
      container.addEventListener("keydown", handleKeyDown)
      return () => container.removeEventListener("keydown", handleKeyDown)
    }
  }, [visibleNodes, nodeMap, openFolders, toggleFolder, currentId])

  useEffect(() => {
    if (currentId && !visibleNodes.some((v) => v.id === currentId)) {
      const findVisibleAncestor = (id: string): string | null => {
        const node = nodeMap.get(id)
        if (!node || !node.parentId) return null
        if (visibleNodes.some((v) => v.id === node.parentId))
          return node.parentId
        return findVisibleAncestor(node.parentId)
      }
      const ancestor = findVisibleAncestor(currentId)
      setCurrentId(ancestor ?? visibleNodes[0]?.id ?? null)
    }
  }, [visibleNodes, currentId, nodeMap])

  // Sync focus to currentId
  useEffect(() => {
    if (currentId) {
      const element = document.getElementById(`node-${currentId}`)
      if (element) {
        if (shouldCenterFocus) {
          element.scrollIntoView() // Scroll the element into view
          element.focus({ preventScroll: true })
          setShouldCenterFocus(false)
        } else if (document.activeElement !== element) {
          element.focus()
        }
      }
    }
  }, [currentId, shouldCenterFocus])

  useEffect(() => {
    const handleBookmarkChange = () => {
      refreshBookmarks()
    }

    chrome.bookmarks.onCreated.addListener(handleBookmarkChange)
    chrome.bookmarks.onRemoved.addListener(handleBookmarkChange)
    chrome.bookmarks.onChanged.addListener(handleBookmarkChange)
    chrome.bookmarks.onMoved.addListener(handleBookmarkChange)
    chrome.bookmarks.onChildrenReordered.addListener(handleBookmarkChange)

    return () => {
      chrome.bookmarks.onCreated.removeListener(handleBookmarkChange)
      chrome.bookmarks.onRemoved.removeListener(handleBookmarkChange)
      chrome.bookmarks.onChanged.removeListener(handleBookmarkChange)
      chrome.bookmarks.onMoved.removeListener(handleBookmarkChange)
      chrome.bookmarks.onChildrenReordered.removeListener(handleBookmarkChange)
    }
  }, [refreshBookmarks])

  return (
    <div className={`App ${isDarkMode ? "dark" : "light"}`}>
      {/* Search */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className={styles.searchInput}
        />
        <SearchIcon />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className={styles.clearButton}
          >
            ×
          </button>
        )}
      </div>

      {/* Bookmarks Container */}
      <div
        ref={containerRef}
        role="tree"
        aria-activedescendant={currentId ? `bookmark-${currentId}` : undefined}
        className={styles.bookmarksContainer}
        onFocus={() => {
          if (searchQuery) return
          if (!currentId && visibleNodes.length > 0) {
            setCurrentId(visibleNodes[0].id)
          }
        }}
      >
        {/* Header */}
        <div className={styles.bookmarksHeader}>
          {searchQuery ? (
            <div className={styles.bookmarksHeaderTitle}>
              {t("searchResults")}
            </div>
          ) : (
            <div className={styles.bookmarksHeaderTitle}>
              {t("allBookmarks")}
            </div>
          )}
          <div className={styles.bookmarksHeaderCount}>
            {searchQuery
              ? searchResults.forQuery === searchQuery
                ? searchResults.nodes.length
                : "..."
              : totalCount}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actionsContainer}>
          {/* Buttons for adding new a bookmark and new folder */}
          <div className={styles.actions}>
            <button
              id="add-bookmark-button"
              type="button"
              title="Add Bookmark"
              className={styles.actionButton}
              onClick={handleAddBookmark}
            >
              <BookmarkIcon />
              <span>{t("addBookmark")}</span>
            </button>
            <button
              id="add-folder-button"
              type="button"
              title="Add Folder"
              className={styles.actionButton}
              onClick={handleAddFolder}
            >
              <FolderIcon />
              <span>{t("addFolder")}</span>
            </button>
          </div>

          {/* Sort dropdown menu */}
          <Select.Root
            value={sortType}
            onValueChange={(value) => setSortType(value as typeof sortType)}
          >
            <Select.Trigger
              id="sort-trigger"
              className={styles.sortTrigger}
              aria-label="Sort"
              title="Sort"
            >
              <Select.Value>
                {
                  sortTypeOptions.find((option) => option.value === sortType)
                    ?.label
                }
              </Select.Value>
              <Select.Icon className={styles.sortIcon}>
                <SortIcon />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                position="popper"
                align="start"
                className={styles.sortContent}
              >
                <Select.Viewport>
                  {sortTypeOptions.map((option) => (
                    <Select.Item
                      value={option.value}
                      className={styles.sortItem}
                    >
                      <div>{option.label}</div>
                      <div>
                        {option.value === sortType && (
                          <Select.ItemIndicator>
                            <CheckmarkIcon />
                          </Select.ItemIndicator>
                        )}
                      </div>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Bookmarks */}
        <div tabIndex={0} className={styles.bookmarksListContainer}>
          <div className={styles.bookmarksList}>
            {searchQuery ? (
              searchResults.forQuery === searchQuery ? (
                <BookmarkFlatList
                  nodes={searchResults.nodes}
                  searchQuery={searchQuery}
                  onRefresh={refreshBookmarks}
                  onOpenFolderInTree={handleOpenFolderInTree}
                />
              ) : (
                <div className={styles.searching}>{t("searching")}</div>
              )
            ) : (
              <BookmarkTree
                nodes={sortedBookmarks}
                onRefresh={refreshBookmarks}
                openFolders={openFolders}
                toggleFolder={toggleFolder}
                currentId={currentId}
                onSelect={setCurrentId}
                sortType={sortType}
              />
            )}
          </div>
        </div>
      </div>

      {/*
      // Dialogs for adding new bookmark and new folder
       */}
      {showNewBookmarkDialog && (
        <EditBookmarkDialog
          initialTitle={initialBookmarkData.title}
          initialUrl={initialBookmarkData.url}
          isCreateFolder={false}
          onRefresh={refreshBookmarks}
          onClose={() => setShowNewBookmarkDialog(false)}
        />
      )}
      {showNewFolderDialog && (
        <EditBookmarkDialog
          isCreateFolder={true}
          onRefresh={refreshBookmarks}
          onClose={() => setShowNewFolderDialog(false)}
        />
      )}
    </div>
  )
}

export default App
