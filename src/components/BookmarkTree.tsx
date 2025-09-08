import { useState, useEffect } from "react"
import styles from "./BookmarkTree.module.scss"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent } from "@dnd-kit/core"
import {
  arrayMove,
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import * as ContextMenu from "@radix-ui/react-context-menu"
import EditBookmarkDialog from "./EditBookmarkDialog"
import { handleBookmarkClick } from "../utils/bookmarkNavigation"
import { clsx } from "clsx"
import {
  getBookmarkCount,
  openAllInNewTabs,
  openAllInNewWindow,
  openAllInNewTabGroup,
} from "../utils/bookmarkUtils"
import ArrowDownIcon from "../assets/icons/arrow-down.svg?react"
import ArrowRightIcon from "../assets/icons/arrow-right.svg?react"
import YoutubeIcon from "../assets/icons/youtube.svg?react"
import LinkIcon from "../assets/icons/globe.svg?react"

interface BookmarkTreeProps {
  nodes: chrome.bookmarks.BookmarkTreeNode[]
  onRefresh: () => void
  level?: number
  openFolders: Set<string>
  toggleFolder: (id: string) => void
  currentId?: string | null
  sortType?: "none" | "newest" | "oldest" | "a-z" | "z-a"
}

const BookmarkTree = ({
  nodes,
  onRefresh,
  level = 0,
  openFolders,
  toggleFolder,
  currentId,
  sortType,
}: BookmarkTreeProps) => {
  const [localNodes, setLocalNodes] = useState(nodes)

  useEffect(() => {
    setLocalNodes(nodes)
  }, [nodes])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    const activeId = active.id.toString()
    const overId = over.id.toString()
    const oldIndex = localNodes.findIndex((node) => node.id === activeId)
    const overIndex = localNodes.findIndex((node) => node.id === overId)

    if (oldIndex === overIndex) return

    const isBelow = overIndex > oldIndex
    const destinationIndex = isBelow ? overIndex + 1 : overIndex

    setLocalNodes(arrayMove(localNodes, oldIndex, overIndex))
    chrome.bookmarks.move(
      activeId,
      { parentId: localNodes[0].parentId, index: destinationIndex },
      onRefresh,
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={localNodes.map((node) => node.id)}
        strategy={verticalListSortingStrategy}
        disabled={sortType !== "none"}
      >
        <ul className={styles.tree} role={level === 0 ? "tree" : "group"}>
          {localNodes.map((node) => (
            <SortableBookmarkNode
              key={node.id}
              id={node.id}
              node={node}
              onRefresh={onRefresh}
              level={level}
              openFolders={openFolders}
              toggleFolder={toggleFolder}
              currentId={currentId}
              sortType={sortType}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

const SortableBookmarkNode = ({
  id,
  node,
  onRefresh,
  level,
  openFolders,
  toggleFolder,
  currentId,
  sortType,
}: {
  id: string
  node: chrome.bookmarks.BookmarkTreeNode
  onRefresh: () => void
  level: number
  openFolders: Set<string>
  toggleFolder: (id: string) => void
  currentId?: string | null
  sortType?: "none" | "newest" | "oldest" | "a-z" | "z-a"
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      //
      id,
      transition: null,
      // transition: { duration: 150, easing: "ease-out" },
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const isFolder = !!node.children
  const isTopLevel = node.id === "1" || node.id === "2"
  const isOpen = openFolders.has(node.id)
  const toggleOpen = () => toggleFolder(node.id)
  const bookmarkCount = isFolder ? getBookmarkCount(node) : 0

  // Page detection for page-specific icons
  const isYouTubeVideo = node.url?.includes("youtube.com") ?? false
  // const isAmazonPage =
  //   (node.url?.includes("amazon.com") ||
  //     node.url?.includes("amazon.ca") ||
  //     node.url?.includes("amazon.co.uk") ||
  //     node.url?.includes("amazon.de")) ??
  //   false;
  // const isGitHubPage = node.url?.includes("github.com") ?? false;
  // const isDigitecGalaxusPage =
  //   (node.url?.includes("digitec.ch") ||
  //     node.url?.includes("galaxus.ch")) ??
  //   false;
  // const isInstagramPage = (node.url?.includes("instagram.com") || node.url?.includes(".instagram.com") ?? false;
  // const isXTwitterPage = (node.url?.includes("/twitter.com") || node.url?.includes(".twitter.com") || node.url?.includes("/x.com") || node.url?.includes(".x.com")) ?? false;

  const handleRemove = () => {
    const removeFunction = isFolder
      ? chrome.bookmarks.removeTree
      : chrome.bookmarks.remove
    removeFunction(node.id, () => onRefresh())
  }

  const handleEdit = () => {
    setIsDialogOpen(true)
  }

  const openInNewTab = () => {
    chrome.tabs.create({ url: node.url })
  }

  const openInNewWindow = () => {
    chrome.windows.create({ url: node.url })
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={styles.node}
      role="treeitem"
      aria-expanded={isFolder ? isOpen : undefined}
      aria-selected={currentId === node.id}
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className={styles.nodeContent}
            {...listeners}
            id={`bookmark-${node.id}`}
          >
            <>
              {isFolder ? (
                <div
                  title={node.title}
                  className={clsx(
                    styles.folder,
                    currentId === node.id && styles.highlight,
                  )}
                  onClick={toggleOpen}
                  style={
                    { "--indent": `${level + 1}em` } as React.CSSProperties
                  }
                >
                  <div className={styles.icon}>
                    {isOpen ? <ArrowDownIcon /> : <ArrowRightIcon />}
                  </div>
                  <div className={styles.title}>{node.title}</div>
                  <div className={styles.count}>{node.children?.length}</div>
                </div>
              ) : (
                <div
                  title={node.title}
                  style={
                    { "--indent": `${level + 1}em` } as React.CSSProperties
                  }
                  onClick={(event) => {
                    handleBookmarkClick(event, node.url)
                    ;(event.currentTarget as HTMLElement).blur() // Release focus from extension
                  }}
                  className={clsx(
                    styles.bookmark,
                    currentId === node.id && styles.highlight,
                  )}
                >
                  <div className={styles.icon}>
                    {isYouTubeVideo ? <YoutubeIcon /> : <LinkIcon />}
                  </div>
                  <div className={styles.title}>{node.title}</div>
                </div>
              )}
            </>
          </div>
        </ContextMenu.Trigger>

        {/* Context Menu */}
        {!isTopLevel && (
          <ContextMenu.Portal>
            <ContextMenu.Content className={styles.contextMenu}>
              {isFolder && (
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
                    onSelect={openInNewTab}
                  >
                    Open in New Tab
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={openInNewWindow}
                  >
                    Open in New Window
                  </ContextMenu.Item>
                  <ContextMenu.Separator
                    className={styles.contextMenuSeparator}
                  />
                </>
              )}

              <ContextMenu.Item
                className={styles.contextMenuItem}
                onSelect={handleEdit}
              >
                {isFolder ? "Rename" : "Edit"}
              </ContextMenu.Item>
              <ContextMenu.Separator className={styles.contextMenuSeparator} />
              <ContextMenu.Item
                className={styles.contextMenuItem}
                onSelect={handleRemove}
              >
                Delete
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        )}
      </ContextMenu.Root>

      {isFolder && isOpen && node.children && (
        <BookmarkTree
          nodes={node.children}
          onRefresh={onRefresh}
          level={level + 1}
          openFolders={openFolders}
          toggleFolder={toggleFolder}
          currentId={currentId}
          sortType={sortType}
        />
      )}
      {isDialogOpen && (
        <EditBookmarkDialog
          node={node}
          onRefresh={onRefresh}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </li>
  )
}

export default BookmarkTree
