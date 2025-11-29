import { arrayMove } from "@dnd-kit/sortable"

export interface FlattenedItem extends chrome.bookmarks.BookmarkTreeNode {
  parentId?: string
  depth: number
  index: number
  isFolder: boolean
  collapsed?: boolean
}

export function flattenTree(
  items: chrome.bookmarks.BookmarkTreeNode[],
  openFolders: Set<string>,
  depth = 0,
  parentId?: string,
): FlattenedItem[] {
  return items.reduce<FlattenedItem[]>((acc, item, index) => {
    // Chrome bookmark folders usually don't have a URL, or we can check children property existence if populated
    // However, API types say children is optional.
    const hasChildren = !item.url
    
    const flattenedItem: FlattenedItem = {
      ...item,
      parentId: parentId ?? item.parentId,
      depth,
      index,
      isFolder: hasChildren,
      collapsed: hasChildren && !openFolders.has(item.id),
    }

    acc.push(flattenedItem)

    if (hasChildren && openFolders.has(item.id) && item.children) {
      acc.push(...flattenTree(item.children, openFolders, depth + 1, item.id))
    }

    return acc
  }, [])
}

export function findItem(items: FlattenedItem[], itemId: string) {
  return items.find(({ id }) => id === itemId)
}

export function getDragDepth(offset: number, indentationWidth: number) {
  return Math.round(offset / indentationWidth)
}

export function getProjection(
  items: FlattenedItem[],
  activeId: string,
  overId: string,
  dragOffset: number,
  indentationWidth: number,
) {
  const overItemIndex = items.findIndex(({ id }) => id === overId)
  const activeItemIndex = items.findIndex(({ id }) => id === activeId)
  const activeItem = items[activeItemIndex]
  const newItems = arrayMove(items, activeItemIndex, overItemIndex)
  
  const dragDepth = getDragDepth(dragOffset, indentationWidth)
  const projectedDepth = activeItem.depth + dragDepth
  const maxDepth = getMaxDepth({
    previousItem: newItems[overItemIndex - 1],
  })
  const minDepth = getMinDepth({ nextItem: newItems[overItemIndex + 1] })
  let depth = projectedDepth

  if (depth >= maxDepth) {
    depth = maxDepth
  } else if (depth < minDepth) {
    depth = minDepth
  }

  return { depth, maxDepth, minDepth, parentId: getParentIdAtDepth(depth, newItems, overItemIndex) }
}

function getMaxDepth({ previousItem }: { previousItem: FlattenedItem }) {
  if (previousItem) {
    return previousItem.isFolder && !previousItem.collapsed ? previousItem.depth + 1 : previousItem.depth
  }
  return 0
}

function getMinDepth({ nextItem }: { nextItem: FlattenedItem }) {
  if (nextItem) {
    return nextItem.depth
  }
  return 0
}

function getParentIdAtDepth(
  depth: number,
  newItems: FlattenedItem[],
  overItemIndex: number,
) {
  // If moving to root level (depth 0)
  if (depth === 0) return undefined

  // Look backwards from the overItem to find the parent at (depth - 1)
  for (let i = overItemIndex - 1; i >= 0; i--) {
    const item = newItems[i]
    // We found a folder at the parent depth
    if (item.depth === depth - 1 && item.isFolder) {
        return item.id
    }
  }
  return undefined
}

// New function to reorder the tree list
export function reorderTreeList(
  items: FlattenedItem[],
  activeId: string,
  overId: string,
  newDepth: number,
  newParentId: string | undefined,
): FlattenedItem[] {
  const activeIndex = items.findIndex((i) => i.id === activeId)
  const overIndex = items.findIndex((i) => i.id === overId)

  if (activeIndex === -1 || overIndex === -1) return items

  const activeItem = items[activeIndex]
  const depthDiff = newDepth - activeItem.depth

  // Find the active item and all its descendants
  const movingItems: FlattenedItem[] = []

  // Include active item
  movingItems.push({
    ...activeItem,
    depth: newDepth,
    parentId: newParentId,
  })

  let i = activeIndex + 1
  while (i < items.length && items[i].depth > activeItem.depth) {
    movingItems.push({
      ...items[i],
      depth: items[i].depth + depthDiff,
    })
    i++
  }

  // Construct new list
  const newItems = [...items]

  if (activeId === overId) {
    newItems.splice(activeIndex, movingItems.length, ...movingItems)
    return newItems
  }

  // Remove the moving block
  newItems.splice(activeIndex, movingItems.length)

  // Find new insertion index
  const newOverIndex = newItems.findIndex((i) => i.id === overId)

  let insertIndex = newOverIndex
  if (activeIndex < overIndex) {
    insertIndex = newOverIndex + 1
  }

  newItems.splice(insertIndex, 0, ...movingItems)

  return newItems
}
