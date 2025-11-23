import React, { useEffect, useMemo, useState, useRef } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  // defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
  // type DropAnimation,
  MeasuringStrategy,
  type DragOverEvent,
  type Modifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
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
import { getBookmarkIcon } from "../utils/iconUtils"
import ArrowDownIcon from "../assets/icons/arrow-down.svg?react"
import ArrowRightIcon from "../assets/icons/arrow-right.svg?react"
import { useTranslation } from "react-i18next"
import styles from "./BookmarkTree.module.scss"
import {
  flattenTree,
  type FlattenedItem,
  getProjection,
  reorderTreeList,
} from "../utils/treeUtils"
import { createPortal } from "react-dom"

const INDENTATION_WIDTH = 20

interface BookmarkTreeProps {
  nodes: chrome.bookmarks.BookmarkTreeNode[]
  onRefresh: () => void
  openFolders: Set<string>
  toggleFolder: (id: string) => void
  currentId?: string | null
  onSelect?: (id: string | null) => void
  sortType?: "none" | "newest" | "oldest" | "a-z" | "z-a"
}

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
}

const snapToCursor: Modifier = ({
  transform,
  activatorEvent,
  draggingNodeRect,
}) => {
  if (draggingNodeRect && activatorEvent) {
    const activator = activatorEvent as unknown as {
      clientX?: number
      clientY?: number
      touches?: { clientX: number; clientY: number }[]
    }

    let clientX = 0
    let clientY = 0

    if (
      typeof activator.clientX === "number" &&
      typeof activator.clientY === "number"
    ) {
      clientX = activator.clientX
      clientY = activator.clientY
    } else if (
      activator.touches &&
      activator.touches.length > 0 &&
      activator.touches[0]
    ) {
      clientX = activator.touches[0].clientX
      clientY = activator.touches[0].clientY
    } else {
      return transform
    }

    const xOffset = 15
    const yOffset = 15

    const newX = clientX + transform.x + xOffset - draggingNodeRect.left
    const newY = clientY + transform.y + yOffset - draggingNodeRect.top

    return {
      ...transform,
      x: newX,
      y: newY,
    }
  }

  return transform
}

// const dropAnimationConfig: DropAnimation = {
//   sideEffects: defaultDropAnimationSideEffects({
//     styles: {
//       active: {
//         opacity: "0.5",
//       },
//     },
//   }),
// }

export default function BookmarkTree({
  nodes,
  onRefresh,
  openFolders,
  toggleFolder,
  currentId,
  onSelect,
  sortType,
}: BookmarkTreeProps) {
  const [items, setItems] = useState<FlattenedItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)

  const flattenedItems = useMemo(() => {
    return flattenTree(nodes, openFolders)
  }, [nodes, openFolders])

  useEffect(() => {
    setItems(flattenedItems)
  }, [flattenedItems])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {}),
  )

  const activeItem = activeId
    ? items.find((item) => item.id === activeId)
    : null

  const projected =
    activeId && overId && activeItem
      ? getProjection(items, activeId, overId, offsetLeft, INDENTATION_WIDTH)
      : null

  const sortedIds = useMemo(() => items.map(({ id }) => id), [items])

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
    setOverId(active.id as string)
    document.body.classList.add("is-dragging")
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x)
  }

  function handleDragCancel() {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
    document.body.classList.remove("is-dragging")
  }

  // Hover to expand logic
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastOverIdRef = useRef<string | null>(null)

  function handleDragOver({ over }: DragOverEvent) {
    setOverId((over?.id as string) ?? null)

    // Handle hover to expand
    if (over?.id) {
      if (lastOverIdRef.current !== over.id) {
        lastOverIdRef.current = over.id as string
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current)
        }
        hoverTimerRef.current = setTimeout(() => {
          const item = items.find((i) => i.id === over.id)
          // Only expand if it's a folder, collapsed, AND we are not dragging the folder itself
          if (item && item.isFolder && item.collapsed && item.id !== activeId) {
            toggleFolder(item.id)
          }
        }, 1000)
      }
    } else {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      lastOverIdRef.current = null
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    document.body.classList.remove("is-dragging")
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    lastOverIdRef.current = null

    const resetState = () => {
      setActiveId(null)
      setOverId(null)
      setOffsetLeft(0)
    }

    if (sortType !== "none") {
      resetState()
      return
    }

    if (projected && over) {
      const { depth, parentId } = projected

      const newItems = reorderTreeList(
        items,
        active.id as string,
        over.id as string,
        depth,
        parentId,
      )
      setItems(newItems)

      const activeItem = items.find(({ id }) => id === active.id)
      if (!activeItem) {
        resetState()
        return
      }

      const movedItemIndex = newItems.findIndex(({ id }) => id === active.id)

      // Determine the final parent ID
      let finalParentId = parentId ?? activeItem.parentId
      if (!finalParentId) {
        const rootItem = items.find((i) => i.depth === 0)
        finalParentId = rootItem?.parentId ?? "0"
      }

      // Calculate new index within the new parent
      let newIndex = 0
      for (let i = 0; i < movedItemIndex; i++) {
        if (newItems[i].parentId === finalParentId) {
          newIndex++
        }
      }

      if (
        finalParentId &&
        (activeItem.parentId !== finalParentId || activeItem.index !== newIndex)
      ) {
        let moveIndex = newIndex
        if (
          activeItem.parentId === finalParentId &&
          newIndex > activeItem.index
        ) {
          moveIndex++
        }

        chrome.bookmarks.move(
          active.id as string,
          { parentId: finalParentId, index: moveIndex },
          () => {
            onRefresh()
          },
        )
      }
    }

    resetState()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={measuring}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={sortedIds}
        strategy={verticalListSortingStrategy}
        disabled={sortType !== "none"}
      >
        <div className={styles.tree} role="tree">
          {items.map((item) => {
            // Calculate line indicator props
            let showDropIndicator: "top" | "bottom" | null = null
            let dropIndicatorDepth = item.depth

            if (
              activeId &&
              overId &&
              item.id === overId &&
              sortType === "none"
            ) {
              const activeIndex = items.findIndex((i) => i.id === activeId)
              const overIndex = items.findIndex((i) => i.id === overId)

              if (activeIndex < overIndex) {
                showDropIndicator = "bottom"
              } else {
                showDropIndicator = "top"
              }

              if (projected) {
                dropIndicatorDepth = projected.depth
              }
            }

            return (
              <SortableBookmarkNode
                key={item.id}
                item={item}
                depth={item.depth}
                indentationWidth={INDENTATION_WIDTH}
                onRefresh={onRefresh}
                openFolders={openFolders}
                toggleFolder={toggleFolder}
                currentId={currentId}
                onSelect={onSelect}
                sortType={sortType}
                showDropIndicator={showDropIndicator}
                dropIndicatorDepth={dropIndicatorDepth}
                isDraggingActive={!!activeId}
                // Pass `transform: null` to prevent Sortable's CSS transform from applying
                // We handle visual feedback via line indicator and overlay
              />
            )
          })}
        </div>
      </SortableContext>
      {createPortal(
        <DragOverlay
          dropAnimation={null}
          zIndex={1000}
          modifiers={[snapToCursor]}
        >
          {activeItem ? (
            <div className={styles.dragOverlay}>
              <SortableBookmarkNode
                item={activeItem}
                depth={0}
                indentationWidth={INDENTATION_WIDTH}
                onRefresh={() => {}}
                openFolders={openFolders}
                toggleFolder={() => {}}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}

interface SortableBookmarkNodeProps {
  item: FlattenedItem
  depth: number
  indentationWidth: number
  onRefresh: () => void
  openFolders: Set<string>
  toggleFolder: (id: string) => void
  currentId?: string | null
  onSelect?: (id: string | null) => void
  sortType?: "none" | "newest" | "oldest" | "a-z" | "z-a"
  isOverlay?: boolean
  showDropIndicator?: "top" | "bottom" | null
  dropIndicatorDepth?: number
  isDraggingActive?: boolean
}

function SortableBookmarkNode({
  item,
  depth,
  indentationWidth,
  onRefresh,
  openFolders,
  toggleFolder,
  currentId,
  onSelect,
  sortType,
  isOverlay,
  showDropIndicator,
  dropIndicatorDepth = 0,
  isDraggingActive,
}: SortableBookmarkNodeProps) {
  const { t } = useTranslation()
  const { isFolder, title, url, id, children } = item
  const isTopLevel = id === "1" || id === "2"
  const isFolderOpen = openFolders.has(id)

  const enableHover = !isDraggingActive || (isFolder && !isFolderOpen)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: isTopLevel || sortType !== "none",
  })

  // Disable transform for list items to prevent shuffling
  const style = {
    transform: isOverlay ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    "--indent": `${depth * indentationWidth}px`,
  } as React.CSSProperties

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const bookmarkCount = isFolder ? getBookmarkCount(item) : 0

  const toggleOpen = () => {
    onSelect?.(id)
    toggleFolder(id)
  }

  const handleRemove = () => {
    const removeFunction = isFolder
      ? chrome.bookmarks.removeTree
      : chrome.bookmarks.remove
    removeFunction(id, () => onRefresh())
  }

  const handleEdit = () => {
    setIsDialogOpen(true)
  }

  const openInNewTab = () => {
    if (url) chrome.tabs.create({ url })
  }

  const openInNewWindow = () => {
    if (url) chrome.windows.create({ url })
  }

  const handleCopyUrl = () => {
    if (url) navigator.clipboard.writeText(url)
  }

  const openInNewIncognitoWindow = () => {
    if (url) chrome.windows.create({ url, incognito: true })
  }

  const openInNewTabGroupLocal = () => {
    if (url) {
      chrome.tabs.create({ url }).then((tab) => {
        if (tab.id) {
          chrome.tabs.group({ tabIds: [tab.id] }).then((groupId) => {
            chrome.tabGroups.update(groupId, { title: title })
          })
        }
      })
    }
  }

  return (
    <button
      type="button"
      id={`node-${id}`}
      ref={setNodeRef}
      style={style}
      className={clsx(styles.node, isDragging && styles.dragging)}
      {...attributes}
      role="treeitem"
      aria-expanded={isFolder ? isFolderOpen : undefined}
      aria-selected={currentId === id}
      onFocus={() => onSelect?.(id)}
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className={clsx(
              styles.nodeContent,
              enableHover && styles.nodeContentHover,
            )}
            {...listeners}
            id={`bookmark-${id}`}
          >
            {isFolder ? (
              <div
                title={title}
                className={clsx(
                  styles.folder,
                  currentId === id && styles.highlight,
                )}
                onClick={toggleOpen}
              >
                <div className={styles.icon}>
                  {isFolderOpen ? <ArrowDownIcon /> : <ArrowRightIcon />}
                </div>
                <div className={styles.title}>{title}</div>
                <div className={styles.count}>{children?.length ?? 0}</div>
              </div>
            ) : (
              <div
                title={title}
                className={clsx(
                  styles.bookmark,
                  currentId === id && styles.highlight,
                )}
                onClick={(event) => {
                  onSelect?.(id)
                  if (url) {
                    handleBookmarkClick(event, url)
                  }
                  ;(event.currentTarget as HTMLElement).blur()
                }}
              >
                <div className={`${styles.icon} ${styles.bookmarkIcon}`}>
                  {getBookmarkIcon(url)}
                </div>
                <div className={styles.title}>{title}</div>
              </div>
            )}
          </div>
        </ContextMenu.Trigger>

        {showDropIndicator && (
          <div
            className={clsx(styles.dropIndicator, styles[showDropIndicator])}
            style={{
              left: `${dropIndicatorDepth * indentationWidth}px`,
            }}
          />
        )}

        {!isTopLevel && !isOverlay && (
          <ContextMenu.Portal>
            <ContextMenu.Content className={styles.contextMenu}>
              {isFolder ? (
                <>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={() => openAllInNewTabs(item)}
                  >
                    {t("openAll", { count: bookmarkCount })}
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={() => openAllInNewWindow(item)}
                  >
                    {t("openAllInNewWindow", { count: bookmarkCount })}
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={() => openAllInNewTabGroup(item)}
                  >
                    {t("openAllInNewTabGroup", { count: bookmarkCount })}
                  </ContextMenu.Item>
                  <ContextMenu.Separator
                    className={styles.contextMenuSeparator}
                  />
                </>
              ) : (
                <>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={openInNewTab}
                  >
                    {t("openInNewTab")}
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={openInNewWindow}
                  >
                    {t("openInNewWindow")}
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={openInNewTabGroupLocal}
                  >
                    {t("openInNewTabGroup")}
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={openInNewIncognitoWindow}
                  >
                    {t("openInNewIncognitoWindow")}
                  </ContextMenu.Item>
                  <ContextMenu.Separator
                    className={styles.contextMenuSeparator}
                  />
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={handleCopyUrl}
                  >
                    {t("copyUrl")}
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
                {isFolder ? t("rename") : t("edit")}
              </ContextMenu.Item>
              <ContextMenu.Separator className={styles.contextMenuSeparator} />
              <ContextMenu.Item
                className={styles.contextMenuItem}
                onSelect={handleRemove}
              >
                {t("delete")}
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        )}
      </ContextMenu.Root>

      {isDialogOpen && (
        <EditBookmarkDialog
          node={item}
          onRefresh={onRefresh}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </button>
  )
}
