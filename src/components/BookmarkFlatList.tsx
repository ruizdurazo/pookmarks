import styles from "./BookmarkFlatList.module.scss";
import * as ContextMenu from "@radix-ui/react-context-menu";
import EditBookmarkDialog from "./EditBookmarkDialog";
import { useState } from "react";
import { handleBookmarkClick } from "../utils/bookmarkNavigation";

interface BookmarkFlatListProps {
  nodes: chrome.bookmarks.BookmarkTreeNode[];
  searchQuery: string;
  onRefresh: () => void;
}

const BookmarkFlatList = ({
  nodes,
  searchQuery,
  onRefresh,
}: BookmarkFlatListProps) => {
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => regex.test(part) ? <span key={i} className={styles.highlight}>{part}</span> : part);
  };

  const [editingNode, setEditingNode] = useState<chrome.bookmarks.BookmarkTreeNode | null>(null);

  const onSave = (
    id: string,
    changes: { title: string; url?: string },
    newParentId?: string
  ) => {
    const performUpdate = () => chrome.bookmarks.update(id, changes, onRefresh);
    if (newParentId && newParentId !== editingNode?.parentId) {
      chrome.bookmarks.move(id, { parentId: newParentId }, performUpdate);
    } else {
      performUpdate();
    }
  };
 
  return (
    <>
      <ul className={styles.list}>
        {nodes.map((node) => (
          <li key={node.id} className={styles.item}>
            <ContextMenu.Root>
              <ContextMenu.Trigger asChild>
                {node.children ? (
                  <div className={styles.folder}>
                    <div className={styles.icon}>📁</div>
                    <div className={styles.title}>{highlightText(node.title, searchQuery)}</div>
                  </div>
                ) : (
                  <div
                    onClick={(event) => {
                      handleBookmarkClick(event, node.url);
                      (event.currentTarget as HTMLElement).blur(); // Release focus from extension
                    }}
                    className={styles.bookmark}
                  >
                    <div className={styles.icon}>{node.url?.includes("youtube.com") ? "🎥" : "🔗"}</div>
                    <div className={styles.title}>{highlightText(node.title, searchQuery)}</div>
                  </div>
                )}
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className={styles.contextMenu}>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={() => {
                      if (node.url) chrome.tabs.create({ url: node.url });
                    }}
                  >
                    Open in New Tab
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={() => {
                      if (node.url) chrome.windows.create({ url: node.url });
                    }}
                  >
                    Open in New Window
                  </ContextMenu.Item>
                  <ContextMenu.Separator className={styles.contextMenuSeparator} />
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={() => setEditingNode(node)}
                  >
                    Edit
                  </ContextMenu.Item>
                  <ContextMenu.Separator className={styles.contextMenuSeparator} />
                  <ContextMenu.Item
                    className={styles.contextMenuItem}
                    onSelect={() => {
                      const isFolder = !!node.children;
                      const removeFunction = isFolder ? chrome.bookmarks.removeTree : chrome.bookmarks.remove;
                      removeFunction(node.id, () => onRefresh());
                    }}
                  >
                    Delete
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
          </li>
        ))}
      </ul>

      {/* Edit Bookmark Dialog */}
      {editingNode && (
        <EditBookmarkDialog
          node={editingNode!}
          onSave={onSave}
          onClose={() => setEditingNode(null)}
        />
      )}
    </>
  );
};

export default BookmarkFlatList;
