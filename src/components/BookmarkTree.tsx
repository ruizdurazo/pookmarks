import { useState } from 'react'
import styles from './BookmarkTree.module.scss'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface BookmarkTreeProps {
  nodes: chrome.bookmarks.BookmarkTreeNode[]
  onRefresh: () => void
}

const BookmarkTree = ({ nodes, onRefresh }: BookmarkTreeProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over.id) {
      const oldIndex = nodes.findIndex(node => node.id === active.id)
      const newIndex = nodes.findIndex(node => node.id === over.id)
      const newNodes = arrayMove(nodes, oldIndex, newIndex)
      // Persist to Chrome API
      chrome.bookmarks.move(active.id, { parentId: nodes[0].parentId, index: newIndex }, onRefresh)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={nodes.map(node => node.id)} strategy={verticalListSortingStrategy}>
        <ul className={styles.tree}>
          {nodes.map((node) => (
            <SortableBookmarkNode key={node.id} id={node.id} node={node} onRefresh={onRefresh} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

const SortableBookmarkNode = ({ id, node, onRefresh }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(node.title)
  const [editUrl, setEditUrl] = useState(node.url || '')
  const isFolder = !!node.children
  const toggleOpen = () => setIsOpen(!isOpen)

  const handleRemove = () => {
    const removeFunction = isFolder ? chrome.bookmarks.removeTree : chrome.bookmarks.remove
    removeFunction(node.id, () => onRefresh())
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = () => {
    chrome.bookmarks.update(node.id, {
      title: editTitle,
      url: isFolder ? undefined : editUrl
    }, () => {
      onRefresh()
      setIsEditing(false)
    })
  }

  const handleCancel = () => {
    setEditTitle(node.title)
    setEditUrl(node.url || '')
    setIsEditing(false)
  }

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners} className={styles.node}>
      {isEditing ? (
        <div>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          {!isFolder && (
            <input
              type="text"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
            />
          )}
          <button onClick={handleSave}>Save</button>
          <button onClick={handleCancel}>Cancel</button>
        </div>
      ) : (
        <>
          {isFolder ? (
            <div className={styles.folder} onClick={toggleOpen}>
              {isOpen ? '▼' : '▶'} {node.title}
            </div>
          ) : (
            <a href={node.url} className={styles.bookmark} target="_blank" rel="noopener noreferrer">
              {node.title}
            </a>
          )}
          <button onClick={handleEdit}>Edit</button>
          <button onClick={handleRemove} className={styles.removeButton}>Remove</button>
        </>
      )}
      {isFolder && isOpen && <BookmarkTree nodes={node.children} onRefresh={onRefresh} />}
    </li>
  )
}

export default BookmarkTree
