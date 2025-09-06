import BookmarkTree from "./components/BookmarkTree.tsx";
import BookmarkFlatList from "./components/BookmarkFlatList.tsx";
import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./App.module.scss";

function App() {
  const [bookmarks, setBookmarks] = useState<
    chrome.bookmarks.BookmarkTreeNode[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    nodes: chrome.bookmarks.BookmarkTreeNode[];
    forQuery: string;
  }>({ nodes: [], forQuery: "" });

  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.style.setProperty("--bookmark-color", "#fff");
      root.style.setProperty("--bookmark-bg-color", "#222");
      root.style.setProperty("--bookmark-tree-bg-color", "#444");
      root.style.setProperty("--bookmark-highlight-color", "#0000ff80");
    } else {
      root.style.setProperty("--bookmark-color", "#000");
      root.style.setProperty("--bookmark-bg-color", "#eee");
      root.style.setProperty("--bookmark-tree-bg-color", "#fff");
      root.style.setProperty("--bookmark-highlight-color", "#ffff0080");
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

  useEffect(() => {
    refreshBookmarks();
  }, []);

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
      setSearchResults({ nodes, forQuery: searchQuery });
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, allFlatNodes]);

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

  const refreshBookmarks = () => {
    chrome.bookmarks.getTree((tree) => {
      setBookmarks(tree[0]?.children || []);
    });
  };

  return (
    <div className={`App ${isDarkMode ? "dark" : "light"}`}>
      {/* <div>
        <button onClick={toggleDarkMode}>
          Toggle {isDarkMode ? "Light" : "Dark"} Mode
        </button>
      </div> */}

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

      {/* <div>
        <h2>Add Bookmark</h2>
        <input
          type="text"
          value={newBookmarkTitle}
          onChange={(e) => setNewBookmarkTitle(e.target.value)}
          placeholder="Bookmark Title"
        />
        <input
          type="text"
          value={newBookmarkUrl}
          onChange={(e) => setNewBookmarkUrl(e.target.value)}
          placeholder="Bookmark URL"
        />
        <button onClick={handleAddBookmark}>Add Bookmark</button>
      </div> */}

      {/* <div>
        <h2>Add Folder</h2>
        <input
          type="text"
          value={newFolderTitle}
          onChange={(e) => setNewFolderTitle(e.target.value)}
          placeholder="Folder Title"
        />
        <button onClick={handleAddFolder}>Add Folder</button>
      </div> */}

      {/* Bookmarks */}
      <div className={styles.bookmarksContainer}>
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
          <BookmarkTree nodes={bookmarks} onRefresh={refreshBookmarks} />
        )}
      </div>
    </div>
  );
}

export default App;
