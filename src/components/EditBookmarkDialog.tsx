import { useState, useEffect } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import * as Select from "@radix-ui/react-select"
import styles from "./EditBookmarkDialog.module.scss"
import ChevronDownIcon from "../assets/icons/chevron-down.svg?react"
import { useTranslation } from 'react-i18next';

interface EditBookmarkDialogProps {
  node?: chrome.bookmarks.BookmarkTreeNode
  onRefresh: () => void
  onClose: () => void
  initialTitle?: string
  initialUrl?: string
  initialParentId?: string
  isCreateFolder?: boolean
}

const EditBookmarkDialog = ({
  node,
  onRefresh,
  onClose,
  initialTitle,
  initialUrl,
  initialParentId,
  isCreateFolder,
}: EditBookmarkDialogProps) => {
  const { t } = useTranslation();
  const isCreate = !node
  const isFolder = isCreate ? (isCreateFolder ?? false) : !!node?.children
  const [title, setTitle] = useState(node?.title || initialTitle || "")
  const [url, setUrl] = useState(node?.url || initialUrl || "")
  const [selectedParentId, setSelectedParentId] = useState(
    node?.parentId || initialParentId || "",
  )
  const [folders, setFolders] = useState<
    { id: string; title: string; depth: number }[]
  >([])
  const isValid =
    title.trim() !== "" &&
    (isFolder || url.trim() !== "") &&
    (isCreate ? selectedParentId !== "" : true)

  useEffect(() => {
    chrome.bookmarks.getTree((tree) => {
      const folderList: { id: string; title: string; depth: number }[] = []
      const traverse = (
        nodes: chrome.bookmarks.BookmarkTreeNode[],
        depth: number,
      ) => {
        for (const n of nodes) {
          if (n.children) {
            folderList.push({ id: n.id, title: n.title, depth })
            traverse(n.children, depth + 1)
          }
        }
      }
      traverse(tree[0].children || [], 0)
      setFolders(folderList)
    })
  }, [])

  const handleSave = () => {
    if (!isValid) return

    if (isCreate) {
      const createOptions: { parentId: string; title: string; url?: string } = {
        parentId: selectedParentId,
        title,
      }
      if (!isFolder) {
        createOptions.url = url
      }
      chrome.bookmarks.create(createOptions, () => {
        onRefresh()
        onClose()
      })
    } else {
      const changes: { title: string; url?: string } = { title }
      if (!isFolder) {
        changes.url = url
      }
      const id = node!.id
      const performUpdate = () => {
        chrome.bookmarks.update(id, changes, () => {
          onRefresh()
        })
      }
      if (selectedParentId !== node!.parentId) {
        chrome.bookmarks.move(id, { parentId: selectedParentId }, performUpdate)
      } else {
        performUpdate()
      }
      onClose()
    }
  }

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          {/* Title */}
          <Dialog.Title className={styles.title}>
            {isCreate ? t(isFolder ? 'newFolder' : 'newBookmark') : t(isFolder ? 'editFolder' : 'editBookmark')}
          </Dialog.Title>
          <Dialog.Description className={styles.description}>
            {isCreate ? t(isFolder ? 'newFolderDescription' : 'newBookmarkDescription') : t(isFolder ? 'editFolderDescription' : 'editBookmarkDescription')}
          </Dialog.Description>
          {/* Form */}
          <form
            id="edit-form"
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault()
              handleSave()
            }}
          >
            <label className={styles.label}>
              {t('titleLabel')}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={styles.input}
              />
            </label>
            {!isFolder && (
              <label className={styles.label}>
                {t('urlLabel')}
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={styles.input}
                />
              </label>
            )}
            <label className={styles.label}>
              {t('parentFolderLabel')}
              <Select.Root
                value={selectedParentId}
                onValueChange={setSelectedParentId}
              >
                <Select.Trigger
                  className={styles.selectTrigger}
                  aria-label="Parent folder"
                >
                  <Select.Value placeholder="Select folder">
                    {selectedParentId
                      ? folders.find((folder) => folder.id === selectedParentId)
                          ?.title
                      : ""}
                  </Select.Value>
                  <Select.Icon className={styles.selectIcon}><ChevronDownIcon /></Select.Icon>
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
              {t('cancel')}
            </button>
            <button
              type="submit"
              form="edit-form"
              disabled={!isValid}
              className={styles.button}
            >
              {t('save')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default EditBookmarkDialog
