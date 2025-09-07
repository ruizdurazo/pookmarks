import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import styles from "./EditBookmarkDialog.module.scss";

interface EditBookmarkDialogProps {
  node: chrome.bookmarks.BookmarkTreeNode;
  onSave: (
    id: string,
    changes: { title: string; url?: string },
    newParentId?: string
  ) => void;
  onClose: () => void;
}

const EditBookmarkDialog = ({
  node,
  onSave,
  onClose,
}: EditBookmarkDialogProps) => {
  const [title, setTitle] = useState(node.title);
  const [url, setUrl] = useState(node.url || "");
  const [selectedParentId, setSelectedParentId] = useState(node.parentId || "");
  const [folders, setFolders] = useState<
    { id: string; title: string; depth: number }[]
  >([]);
  const isFolder = !!node.children;
  const isValid = title.trim() !== "" && (isFolder || url.trim() !== "");

  useEffect(() => {
    chrome.bookmarks.getTree((tree) => {
      const folderList: { id: string; title: string; depth: number }[] = [];
      const traverse = (
        nodes: chrome.bookmarks.BookmarkTreeNode[],
        depth: number
      ) => {
        for (const n of nodes) {
          if (n.children) {
            folderList.push({ id: n.id, title: n.title, depth });
            traverse(n.children, depth + 1);
          }
        }
      };
      traverse(tree[0].children || [], 0);
      setFolders(folderList);
    });
  }, []);

  const handleSave = () => {
    if (!isValid) return;
    const changes = { title, url: isFolder ? undefined : url };
    if (selectedParentId !== node.parentId) {
      onSave(node.id, changes, selectedParentId);
    } else {
      onSave(node.id, changes);
    }
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          {/* Title */}
          <Dialog.Title className={styles.title}>
            Edit {isFolder ? "Folder" : "Bookmark"}
          </Dialog.Title>

          {/* Form */}
          <form
            id="edit-form"
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <label className={styles.label}>
              Title:
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.input}
              />
            </label>
            {!isFolder && (
              <label className={styles.label}>
                URL:
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={styles.input}
                />
              </label>
            )}
            <label className={styles.label}>
              Parent Folder:
              <Select.Root
                value={selectedParentId}
                onValueChange={setSelectedParentId}
              >
                <Select.Trigger
                  className={styles.selectTrigger}
                  aria-label="Parent folder"
                >
                  <Select.Value>
                    {selectedParentId
                      ? folders.find((folder) => folder.id === selectedParentId)
                          ?.title
                      : "Select folder"}
                  </Select.Value>
                  <Select.Icon className={styles.selectIcon}>▼</Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className={styles.selectContent}>
                    <Select.Viewport className={styles.selectViewport}>
                      {folders.map((folder) => (
                        <Select.Item
                          key={folder.id}
                          value={folder.id}
                          className={styles.selectItem}
                        >
                          <Select.ItemText>
                            {/* add whitespace character that won't get trimmed or replaced */}
                            {"\u00A0".repeat(folder.depth * 2)} {folder.title}
                          </Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </label>
          </form>

          {/* Buttons */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.button + " " + styles.secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-form"
              disabled={!isValid}
              className={styles.button}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default EditBookmarkDialog;
