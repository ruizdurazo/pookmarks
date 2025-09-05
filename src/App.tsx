import { useState, useEffect } from 'react'
import './App.css'
import BookmarkTree from './components/BookmarkTree.tsx'

function App() {
  const [bookmarks, setBookmarks] = useState<chrome.bookmarks.BookmarkTreeNode[]>([])
  const [displayedBookmarks, setDisplayedBookmarks] = useState<chrome.bookmarks.BookmarkTreeNode[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [newBookmarkTitle, setNewBookmarkTitle] = useState('')
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('')
  const [newFolderTitle, setNewFolderTitle] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    refreshBookmarks()
  }, [])

  useEffect(() => {
    if (searchQuery === '') {
      setDisplayedBookmarks(bookmarks)
    } else {
      const filtered = filterBookmarks(bookmarks, searchQuery)
      setDisplayedBookmarks(filtered)
    }
  }, [bookmarks, searchQuery])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDarkMode(mediaQuery.matches)
    const handleChange = (e) => setIsDarkMode(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const refreshBookmarks = () => {
    chrome.bookmarks.getTree((tree) => {
      setBookmarks(tree)
    })
  }

  const filterBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[], query: string): chrome.bookmarks.BookmarkTreeNode[] => {
    return nodes.map(node => ({ ...node })).filter(node => {
      const matches = node.title.toLowerCase().includes(query.toLowerCase()) || (node.url && node.url.toLowerCase().includes(query.toLowerCase()))
      if (node.children) {
        node.children = filterBookmarks(node.children, query)
        return matches || node.children.length > 0
      }
      return matches
    })
  }

  const handleAddBookmark = () => {
    if (newBookmarkTitle && newBookmarkUrl) {
      chrome.bookmarks.create({
        parentId: '1',
        title: newBookmarkTitle,
        url: newBookmarkUrl
      }, () => {
        refreshBookmarks()
        setNewBookmarkTitle('')
        setNewBookmarkUrl('')
      })
    }
  }

  const handleAddFolder = () => {
    if (newFolderTitle) {
      chrome.bookmarks.create({
        parentId: '1',
        title: newFolderTitle
      }, () => {
        refreshBookmarks()
        setNewFolderTitle('')
      })
    }
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  return (
    <div className={`App ${isDarkMode ? 'dark' : 'light'}`}>
      <h1>Pookmarks</h1>
      <button onClick={toggleDarkMode}>Toggle {isDarkMode ? 'Light' : 'Dark'} Mode</button>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search bookmarks or folders"
      />
      <div>
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
      </div>
      <div>
        <h2>Add Folder</h2>
        <input
          type="text"
          value={newFolderTitle}
          onChange={(e) => setNewFolderTitle(e.target.value)}
          placeholder="Folder Title"
        />
        <button onClick={handleAddFolder}>Add Folder</button>
      </div>
      <BookmarkTree nodes={displayedBookmarks} onRefresh={refreshBookmarks} />
    </div>
  )
}

export default App
