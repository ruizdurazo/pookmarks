import BookmarkTree from "./components/BookmarkTree.tsx";
import BookmarkFlatList from "./components/BookmarkFlatList.tsx";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import styles from "./App.module.scss";
import * as Select from "@radix-ui/react-select";

function App() {
  const [bookmarks, setBookmarks] = useState<
    chrome.bookmarks.BookmarkTreeNode[]
  >([]);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const toggleFolder = useCallback((id: string) => {
    setOpenFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    nodes: chrome.bookmarks.BookmarkTreeNode[];
    forQuery: string;
  }>({ nodes: [], forQuery: "" });

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sortType, setSortType] = useState<
    "none" | "newest" | "oldest" | "a-z" | "z-a"
  >("none");

  const sortTypeOptions = [
    { value: "none", label: "Unsorted" },
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "a-z", label: "A-Z" },
    { value: "z-a", label: "Z-A" },
  ];

  const getSortFunc = useCallback(
    (sortType: string) =>
      (
        a: chrome.bookmarks.BookmarkTreeNode,
        b: chrome.bookmarks.BookmarkTreeNode
      ) => {
        if (sortType === "a-z") return a.title.localeCompare(b.title);
        if (sortType === "z-a") return b.title.localeCompare(a.title);
        if (sortType === "newest")
          return (b.dateAdded ?? 0) - (a.dateAdded ?? 0);
        if (sortType === "oldest")
          return (a.dateAdded ?? 0) - (b.dateAdded ?? 0);
        return 0;
      },
    []
  );

  const sortedBookmarks = useMemo(() => {
    if (sortType === "none") return bookmarks;

    const sortFunc = getSortFunc(sortType);

    const sortRecursive = (
      nodes: chrome.bookmarks.BookmarkTreeNode[]
    ): chrome.bookmarks.BookmarkTreeNode[] => {
      const sorted = [...nodes].sort(sortFunc);
      return sorted.map((node) => ({
        ...node,
        children: node.children ? sortRecursive(node.children) : undefined,
      }));
    };

    return sortRecursive(bookmarks);
  }, [bookmarks, sortType, getSortFunc]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
    const traverse = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      nodes.forEach((node) => {
        map.set(node.id, node);
        if (node.children) traverse(node.children);
      });
    };
    traverse(sortedBookmarks);
    return map;
  }, [sortedBookmarks]);

  const visibleNodes = useMemo(() => {
    const result: { id: string; level: number }[] = [];
    const traverse = (
      nodes: chrome.bookmarks.BookmarkTreeNode[],
      level: number
    ) => {
      nodes.forEach((node) => {
        result.push({ id: node.id, level });
        if (node.children && openFolders.has(node.id)) {
          traverse(node.children, level + 1);
        }
      });
    };
    traverse(sortedBookmarks, 0);
    return result;
  }, [sortedBookmarks, openFolders]);

  // const [lastFocusedId, setLastFocusedId] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      // Dark mode
      root.style.setProperty("--bg-color", "#222");
      root.style.setProperty("--border-color", "#555");
      root.style.setProperty("--input-border-color", "#444");
      root.style.setProperty("--input-focus-border-color", "#666");
      root.style.setProperty("--bookmark-color", "#fff");
      root.style.setProperty("--bookmark-bg-color", "#444");
      root.style.setProperty("--bookmark-tree-bg-color", "#282828");
      root.style.setProperty("--bookmark-highlight-color", "#0000ff80");
      root.style.setProperty("--action-color", "#000000");
      root.style.setProperty("--action-bg-color", "#ffffff");
      root.style.setProperty("--action-bg-hover-color", "#fafafa");
      root.style.setProperty("--secondary-action-color", "#ccc");
      root.style.setProperty("--secondary-action-bg-color", "transparent");
      root.style.setProperty("--secondary-action-bg-hover-color", "#333");
      root.style.setProperty("--dialog-bg-color", "#222");
    } else {
      // Light mode
      root.style.setProperty("--bg-color", "#fafafa");
      root.style.setProperty("--border-color", "#ddd");
      root.style.setProperty("--input-border-color", "#ddd");
      root.style.setProperty("--input-focus-border-color", "#aaa");
      root.style.setProperty("--bookmark-color", "#000");
      root.style.setProperty("--bookmark-bg-color", "#eee");
      root.style.setProperty("--bookmark-tree-bg-color", "#fff");
      root.style.setProperty("--bookmark-highlight-color", "#ffff0080");
      root.style.setProperty("--action-color", "#ffffff");
      root.style.setProperty("--action-bg-color", "#000000");
      root.style.setProperty("--action-bg-hover-color", "#111111");
      root.style.setProperty("--secondary-action-color", "#333");
      root.style.setProperty("--secondary-action-bg-color", "transparent");
      root.style.setProperty("--secondary-action-bg-hover-color", "#fafafa");
      root.style.setProperty("--dialog-bg-color", "#fff");
    }
  }, [isDarkMode]);

  const filterBookmarks = useCallback(
    (
      nodes: chrome.bookmarks.BookmarkTreeNode[],
      query: string
    ): chrome.bookmarks.BookmarkTreeNode[] => {
      return nodes
        .map((node) => ({ ...node }))
        .filter((node) => {
          const matches =
            node.title.toLowerCase().includes(query.toLowerCase()) ||
            (node.url && node.url.toLowerCase().includes(query.toLowerCase()));
          if (node.children) {
            node.children = filterBookmarks(node.children, query);
            return matches || node.children.length > 0;
          }
          return matches;
        });
    },
    []
  );

  const allFlatNodes = useMemo(() => {
    const results: chrome.bookmarks.BookmarkTreeNode[] = [];
    const traverse = (currentNodes: chrome.bookmarks.BookmarkTreeNode[]) => {
      for (const node of currentNodes) {
        results.push(node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(bookmarks);
    return results;
  }, [bookmarks]);

  const totalCount = allFlatNodes.length;

  useEffect(() => {
    if (searchQuery === "") {
      setSearchResults({ nodes: [], forQuery: "" });
      return;
    }

    const handler = setTimeout(() => {
      const lowerQuery = searchQuery.toLowerCase();
      const nodes = allFlatNodes.filter(
        (node) =>
          node.title.toLowerCase().includes(lowerQuery) ||
          (node.url && node.url.toLowerCase().includes(lowerQuery))
      );

      let sortedNodes = nodes;
      if (sortType !== "none") {
        sortedNodes = [...nodes].sort(getSortFunc(sortType));
      }

      setSearchResults({ nodes: sortedNodes, forQuery: searchQuery });
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, allFlatNodes, sortType, getSortFunc]);

  useEffect(() => {
    const isIncognito = chrome.extension.inIncognitoContext;
    if (isIncognito) {
      setIsDarkMode(true);
    } else {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      setIsDarkMode(mediaQuery.matches);
      const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, []);

  const refreshBookmarks = useCallback(() => {
    chrome.bookmarks.getTree((tree) => {
      setBookmarks(tree[0]?.children || []);
    });
  }, []);

  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentId) return;
      let currentIndex = visibleNodes.findIndex((v) => v.id === currentId);
      if (currentIndex === -1) {
        currentIndex = 0;
        setCurrentId(visibleNodes[0]?.id ?? null);
        return;
      }
      const currentLevel = visibleNodes[currentIndex].level;
      const node = nodeMap.get(currentId);
      if (!node) return;
      const isFolder = !!node.children;
      const isOpen = openFolders.has(currentId);
      let newId: string | undefined;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          newId =
            visibleNodes[Math.min(currentIndex + 1, visibleNodes.length - 1)]
              ?.id;
          break;
        case "ArrowUp":
          e.preventDefault();
          newId = visibleNodes[Math.max(currentIndex - 1, 0)]?.id;
          break;
        case "ArrowRight":
          e.preventDefault();
          if (isFolder) {
            if (!isOpen) {
              toggleFolder(currentId);
            } else {
              const nextIndex = currentIndex + 1;
              if (
                nextIndex < visibleNodes.length &&
                visibleNodes[nextIndex].level === currentLevel + 1
              ) {
                newId = visibleNodes[nextIndex].id;
              }
            }
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (isFolder && isOpen) {
            toggleFolder(currentId);
          } else {
            for (let j = currentIndex - 1; j >= 0; j--) {
              if (visibleNodes[j].level === currentLevel - 1) {
                newId = visibleNodes[j].id;
                break;
              }
            }
          }
          break;
        case "Enter":
          e.preventDefault();
          if (isFolder) {
            toggleFolder(currentId);
          } else if (node.url) {
            if (e.shiftKey) {
              chrome.tabs.create({ url: node.url });
            } else {
              chrome.tabs.query(
                { active: true, currentWindow: true },
                (tabs) => {
                  if (tabs[0]?.id) {
                    const tabId = tabs[0].id;
                    chrome.tabs.update(tabId, { url: node.url, active: true });
                    chrome.windows.update(tabs[0].windowId, { focused: true });
                    const onUpdated = (
                      updatedTabId: number,
                      changeInfo: { status?: string },
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      _tab: chrome.tabs.Tab
                    ) => {
                      if (
                        updatedTabId === tabId &&
                        changeInfo.status === "complete"
                      ) {
                        chrome.tabs.onUpdated.removeListener(onUpdated);
                        chrome.scripting
                          .executeScript({
                            target: { tabId },
                            func: () => {
                              window.focus();
                              document.body.focus();
                            },
                          })
                          .catch((err) =>
                            console.log("Focus script failed:", err)
                          );
                      }
                    };
                    chrome.tabs.onUpdated.addListener(onUpdated);
                  }
                }
              );
            }
          }
          break;
        default:
          return;
      }
      if (newId && newId !== currentId) {
        setCurrentId(newId);
      }
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
      return () => container.removeEventListener("keydown", handleKeyDown);
    }
  }, [visibleNodes, nodeMap, openFolders, toggleFolder, currentId]);

  useEffect(() => {
    if (currentId && !visibleNodes.some((v) => v.id === currentId)) {
      const findVisibleAncestor = (id: string): string | null => {
        const node = nodeMap.get(id);
        if (!node || !node.parentId) return null;
        if (visibleNodes.some((v) => v.id === node.parentId))
          return node.parentId;
        return findVisibleAncestor(node.parentId);
      };
      const ancestor = findVisibleAncestor(currentId);
      setCurrentId(ancestor ?? visibleNodes[0]?.id ?? null);
    }
  }, [visibleNodes, currentId, nodeMap]);

  useEffect(() => {
    const handleBookmarkChange = () => {
      refreshBookmarks();
    };

    chrome.bookmarks.onCreated.addListener(handleBookmarkChange);
    chrome.bookmarks.onRemoved.addListener(handleBookmarkChange);
    chrome.bookmarks.onChanged.addListener(handleBookmarkChange);
    chrome.bookmarks.onMoved.addListener(handleBookmarkChange);
    chrome.bookmarks.onChildrenReordered.addListener(handleBookmarkChange);

    return () => {
      chrome.bookmarks.onCreated.removeListener(handleBookmarkChange);
      chrome.bookmarks.onRemoved.removeListener(handleBookmarkChange);
      chrome.bookmarks.onChanged.removeListener(handleBookmarkChange);
      chrome.bookmarks.onMoved.removeListener(handleBookmarkChange);
      chrome.bookmarks.onChildrenReordered.removeListener(handleBookmarkChange);
    };
  }, [refreshBookmarks]);

  return (
    <div className={`App ${isDarkMode ? "dark" : "light"}`}>
      {/* <div>
        <button onClick={toggleDarkMode}>
          Toggle {isDarkMode ? "Light" : "Dark"} Mode
        </button>
      </div> */}

      {/* Search */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search"
          className={styles.searchInput}
        />
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
        tabIndex={0}
        onFocus={() => {
          if (searchQuery) return;
          if (!currentId && visibleNodes.length > 0) {
            setCurrentId(visibleNodes[0].id);
          }
        }}
      >
        {/* Header */}
        <div className={styles.bookmarksHeader}>
          {searchQuery ? (
            <div className={styles.bookmarksHeaderTitle}>Search Results</div>
          ) : (
            <div className={styles.bookmarksHeaderTitle}>All Bookmarks</div>
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
            {/* <button type="button" className={styles.actionButton} onClick={handleAddBookmark}>+ Bookmark</button> */}
            {/* <button type="button" className={styles.actionButton} onClick={handleAddFolder}>+ Folder</button> */}
          </div>

          {/* Sort dropdown menu */}
          <Select.Root
            value={sortType}
            onValueChange={(value) => setSortType(value as typeof sortType)}
          >
            <Select.Trigger className={styles.sortTrigger}>
              <Select.Value placeholder="Sort">
                {
                  sortTypeOptions.find((option) => option.value === sortType)
                    ?.label
                }
              </Select.Value>
              <Select.Icon className={styles.sortIcon}>▼</Select.Icon>
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
                          <Select.ItemIndicator>✓</Select.ItemIndicator>
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
        {searchQuery ? (
          searchResults.forQuery === searchQuery ? (
            <BookmarkFlatList
              nodes={searchResults.nodes}
              searchQuery={searchQuery}
              onRefresh={refreshBookmarks}
            />
          ) : (
            <div className={styles.searching}>Searching...</div>
          )
        ) : (
          <BookmarkTree
            nodes={sortedBookmarks}
            onRefresh={refreshBookmarks}
            openFolders={openFolders}
            toggleFolder={toggleFolder}
            currentId={currentId}
            sortType={sortType}
          />
        )}
      </div>
    </div>
  );
}

export default App;
