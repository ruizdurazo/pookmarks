export function getBookmarkCount(
  node: chrome.bookmarks.BookmarkTreeNode,
): number {
  let count = 0

  function traverse(n: chrome.bookmarks.BookmarkTreeNode) {
    if (n.url) count++
    n.children?.forEach(traverse)
  }

  traverse(node)
  return count
}

function getAllUrls(node: chrome.bookmarks.BookmarkTreeNode): string[] {
  const urls: string[] = []

  function traverse(n: chrome.bookmarks.BookmarkTreeNode) {
    if (n.url) urls.push(n.url)
    n.children?.forEach(traverse)
  }

  traverse(node)
  return urls
}

export function openAllInNewTabs(node: chrome.bookmarks.BookmarkTreeNode) {
  const urls = getAllUrls(node)
  urls.forEach((url) => chrome.tabs.create({ url }))
}

export function openAllInNewWindow(node: chrome.bookmarks.BookmarkTreeNode) {
  const urls = getAllUrls(node)
  if (urls.length) chrome.windows.create({ url: urls })
}

export async function openAllInNewTabGroup(
  node: chrome.bookmarks.BookmarkTreeNode,
) {
  const urls = getAllUrls(node)
  const tabIds: number[] = []

  for (const url of urls) {
    const tab = await chrome.tabs.create({ url })
    if (tab.id) tabIds.push(tab.id)
  }

  if (tabIds.length) {
    await chrome.tabs.group({ tabIds: tabIds as [number, ...number[]] })
  }
}
