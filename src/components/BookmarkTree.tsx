import { useState, useEffect } from "react";
import styles from "./BookmarkTree.module.scss";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as ContextMenu from "@radix-ui/react-context-menu";
import EditBookmarkDialog from "./EditBookmarkDialog";
import { handleBookmarkClick } from "../utils/bookmarkNavigation";

interface BookmarkTreeProps {
  nodes: chrome.bookmarks.BookmarkTreeNode[];
  onRefresh: () => void;
  level?: number;
}

const BookmarkTree = ({ nodes, onRefresh, level = 0 }: BookmarkTreeProps) => {
  const [localNodes, setLocalNodes] = useState(nodes);

  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const activeId = active.id.toString();
    const overId = over.id.toString();
    const oldIndex = localNodes.findIndex((node) => node.id === activeId);
    const overIndex = localNodes.findIndex((node) => node.id === overId);

    const isBelow = overIndex > oldIndex;
    const newIndex = isBelow ? overIndex + 1 : overIndex;

    if (oldIndex === overIndex) return;

    setLocalNodes(arrayMove(localNodes, oldIndex, newIndex));
    chrome.bookmarks.move(
      activeId,
      { parentId: localNodes[0].parentId, index: newIndex },
      onRefresh
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={localNodes.map((node) => node.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={styles.tree}>
          {localNodes.map((node) => (
            <SortableBookmarkNode
              key={node.id}
              id={node.id}
              node={node}
              onRefresh={onRefresh}
              level={level}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
};

const SortableBookmarkNode = ({
  id,
  node,
  onRefresh,
  level,
}: {
  id: string;
  node: chrome.bookmarks.BookmarkTreeNode;
  onRefresh: () => void;
  level: number;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      //
      id,
      transition: null,
      // transition: { duration: 150, easing: "ease-out" },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isFolder = !!node.children;
  const toggleOpen = () => setIsOpen(!isOpen);
  const isYouTubeVideo = node.url?.includes("youtube.com");

  const handleRemove = () => {
    const removeFunction = isFolder
      ? chrome.bookmarks.removeTree
      : chrome.bookmarks.remove;
    removeFunction(node.id, () => onRefresh());
  };

  const handleEdit = () => {
    setIsDialogOpen(true);
  };

  const openInNewTab = () => {
    chrome.tabs.create({ url: node.url });
  };

  const openInNewWindow = () => {
    chrome.windows.create({ url: node.url });
  };

  const onSave = (
    id: string,
    changes: { title: string; url?: string },
    newParentId?: string
  ) => {
    const performUpdate = () => chrome.bookmarks.update(id, changes, onRefresh);
    if (newParentId && newParentId !== node.parentId) {
      chrome.bookmarks.move(id, { parentId: newParentId }, performUpdate);
    } else {
      performUpdate();
    }
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes} className={styles.node}>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div className={styles.nodeContent} {...listeners}>
            <>
              {isFolder ? (
                <div
                  title={node.title}
                  className={styles.folder}
                  onClick={toggleOpen}
                  style={
                    { "--indent": `${level + 1}em` } as React.CSSProperties
                  }
                >
                  <div className={styles.icon}>{isOpen ? "▼" : "▶"}</div>
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
                    handleBookmarkClick(event, node.url);
                    (event.currentTarget as HTMLElement).blur(); // Release focus from extension
                  }}
                  className={styles.bookmark}
                >
                  <div className={styles.icon}>
                    {isYouTubeVideo ? "🎥" : "🔗"}
                  </div>
                  <div className={styles.title}>{node.title}</div>
                </div>
              )}
            </>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className={styles.contextMenu}>
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
            <ContextMenu.Separator className={styles.contextMenuSeparator} />
            <ContextMenu.Item
              className={styles.contextMenuItem}
              onSelect={handleEdit}
            >
              Edit
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
      </ContextMenu.Root>
      {isFolder && isOpen && node.children && (
        <BookmarkTree
          nodes={node.children}
          onRefresh={onRefresh}
          level={level + 1}
        />
      )}
      {isDialogOpen && (
        <EditBookmarkDialog
          node={node}
          onSave={onSave}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </li>
  );
};

export default BookmarkTree;
