# Technical overview

This document describes how the repository is wired for a Chrome MV3 side-panel extension, how bookmark data flows through the UI, and how **search** and **drag-and-drop** are implemented.

## Project setup

### Tooling and build


| Piece                       | Role                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vite** (`vite.config.ts`) | Bundles the extension; React plugin, SVG-as-component (`vite-plugin-svgr`), copies `manifest.json` into `dist` (`vite-plugin-static-copy`). |
| **TypeScript**              | `tsc -b` runs before `vite build` (see `package.json` `build` script).                                                                      |
| **SCSS**                    | Global styles in `src/global.scss`; component styles as `*.module.scss`.                                                                    |
| **ESLint**                  | `npm run lint`.                                                                                                                             |


### Extension entries (Rollup multi-entry)

The Vite build declares two inputs:

- `**sidepanel`** — HTML shell `sidepanel.html` loads `src/main.tsx`, which mounts React (`createRoot`) and wraps the app with `I18nextProvider` and `StrictMode`.
- `**background`** — `src/background.ts` compiles to `background.js` with a fixed filename (no content hash), matching `manifest.json`.

The side panel UI is the primary surface; there is no separate options page in the current manifest.

### Manifest (MV3)

`manifest.json` (copied to `dist`) defines:

- `**side_panel.default_path**` — loads the built side panel HTML.
- `**background.service_worker**` — module service worker for commands and side-panel behavior.
- **Permissions** — `bookmarks`, `sidePanel`, `tabs`, `tabGroups`, `scripting`, `activeTab`, `windows`, `storage` (e.g. bookmarks API, opening tabs from bookmarks, `chrome.storage.local` for persisted UI state like sort mode).
- `**commands`** — keyboard shortcut `open-pookmarks` (Shift+Alt+P) handled in the background script.
- `**host_permissions`** — `http(s)://*/*` for tab/scripting flows when navigating or focusing tabs.

The background script (`src/background.ts`) sets `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on install and opens the side panel when the command fires.

### Runtime dependencies (UI)

- **React 19** — app shell and components.
- **Radix UI** — `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-select` for accessible menus, dialogs, and the sort dropdown.
- **@dnd-kit** — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@dnd-kit/modifiers` for tree drag-and-drop.
- **i18next / react-i18next** — translations from `src/locales/*/translation.json`, initialized in `src/i18n.ts` with browser language detection.

### Bookmark data source

All authoritative state comes from `**chrome.bookmarks`**.

- Initial load and refresh: `chrome.bookmarks.getTree()`; the app keeps the top-level children of the root node in React state (`App.tsx`).
- Live updates: listeners on `onCreated`, `onRemoved`, `onChanged`, `onMoved`, and `onChildrenReordered` all trigger the same refresh callback so external changes stay in sync.

The UI never maintains a private server; persistence is the browser’s bookmark store (and optional Chrome sync).

---

## Search

### State and debouncing

In `App.tsx`:

- `**searchQuery`** — controlled input in the search bar.
- `**searchResults**` — `{ nodes, forQuery }` so the list can show a stable result set that matches the query that finished debouncing, while the input may still be mid-typing.

When `searchQuery` is non-empty, an effect schedules work after **300 ms** (`setTimeout`). If the query changes before that, the timer is cleared (standard debounce). Empty query clears results immediately.

### Matching logic

Search builds `**allFlatNodes`** once per bookmark tree: a depth-first traversal that pushes every node into a single array (from the unsorted `bookmarks` tree, not the sorted copy).

Filtering is case-insensitive substring match on:

- `node.title`, and  
- `node.url` when present (folders typically have no URL).

There is no separate full-text index; complexity is linear in the number of nodes for each debounced search.

### Sort order in results

If `**sortType`** is not `"none"`, the matched nodes are sorted with the same comparator used for the tree (`getSortFunc`), so search results respect the user’s sort preference (e.g. A–Z, newest).

### UI routing: tree vs flat list

- `**searchQuery` empty** — renders `**BookmarkTree`** with `sortedBookmarks` (tree optionally sorted per folder).
- `**searchQuery` non-empty** — renders `**BookmarkFlatList`** once `searchResults.forQuery === searchQuery` (otherwise a short “searching” placeholder).

### Flat list behavior (`BookmarkFlatList.tsx`)

- **Highlighting** — `highlightText` splits text on a regex built from the query and wraps matches in a styled `<span>`.
- **Folders** — clicking a folder calls `**onOpenFolderInTree(node.id)`** (`handleOpenFolderInTree` in `App.tsx`): clears the search field, rebuilds `**openFolders`** so every ancestor of that node is expanded, sets keyboard focus to that node, and scrolls it into view using `nodeMap` for parent chain resolution.

Bookmarks use shared navigation helpers (`handleBookmarkClick` from `bookmarkNavigation.ts`) for opening URLs.

---

## Drag-and-drop

Drag-and-drop applies only to the **tree view** (`BookmarkTree.tsx`), not to search results. It uses **@dnd-kit** with a `**DndContext`** wrapping a `**SortableContext`** whose items are the flattened visible rows.

### Flattened tree model (`src/utils/treeUtils.ts`)

`flattenTree` turns the hierarchical `nodes` plus `**openFolders**` into a `**FlattenedItem[]**`:

- Each row carries `**depth**`, `**parentId**`, `**index**` among siblings, `**isFolder**` (derived from absence of `url`), and `**collapsed**`.
- Only nodes under expanded folders appear; collapsing removes descendants from the list.

`BookmarkTree` keeps local `**items**` state initialized from `flattenTree` and resets when `flattenedItems` (derived from props) changes.

### Sensors and collision detection

- `**PointerSensor**` with **5 px** activation distance — avoids accidental drags when clicking.
- `**KeyboardSensor`** — accessibility / keyboard sorting support from dnd-kit.
- `**collisionDetection: closestCenter`** — picks the row under the pointer.
- **Droppable measuring** — `MeasuringStrategy.Always` so layout during drag stays consistent.

Horizontal movement during drag updates `**offsetLeft`** from `delta.x` in `onDragMove`; that value feeds **depth projection** in custom-order mode (below).

### Two behavioral modes (critical)

Behavior splits on `**sortType`** passed from `App.tsx`:

#### 1. Custom order (`sortType === "none"`)

This is the **nested list** UX: reorder and reparent by vertical position and horizontal indent.

- `**getProjection`** combines:
  - vertical target (`activeId`, `overId`) via `arrayMove` from `@dnd-kit/sortable` to simulate reordering in the flat list, and  
  - horizontal `**dragOffset`** converted to a **depth** using `INDENTATION_WIDTH` (20 px steps).
- Depth is clamped using `**getMaxDepth`** / `**getMinDepth`** from neighbor rows so you cannot nest under invalid positions.
- `**reorderTreeList**` applies the projected depth and parent to produce an optimistic `**newItems**` array (including moving descendant rows for folder drags).
- On drop, `**chrome.bookmarks.move**` is called with:
  - `**parentId**` — resolved from projected depth (root uses Chrome’s logical parent for top-level groups), and  
  - `**index**` — computed by counting siblings with the same `parentId` before the inserted row, with an adjustment when moving downward within the same parent (off-by-one fix).

Top-level system folders with ids `**"1"**` and `**"2"**` are **not sortable** (`useSortable({ disabled: isTopLevel })`) so the bookmark bar / “Other bookmarks” roots cannot be dragged.

#### 2. Sorted modes (`sortType !== "none"`)

When the tree is sorted by title or date, **indentation-based reparenting is disabled** (`projected` is not used).

- `**getSortedModeTargetFolder`** interprets the hovered row:
  - Hovering a **folder** row → drop target is that folder.  
  - Hovering a **bookmark** row → drop target is **that bookmark’s parent folder** (move into the same folder as that bookmark).
- `**chrome.bookmarks.move`** is called with `**{ parentId: targetFolder.id }`** only (Chrome assigns index).
- Invalid moves are rejected in UI logic: e.g. moving a folder into itself or a descendant uses `**isStrictDescendantOfFolder**`, and dropping onto the current parent is skipped.

Visual feedback: folders that are valid drop targets get a `**showFolderDropTarget**` highlight while dragging.

### Overlay and visual polish

- `**DragOverlay**` rendered with `**createPortal(..., document.body)**` so the ghost sits above the panel.
- Custom `**snapToCursor**` modifier adjusts transform so the overlay follows the pointer with a small offset.
- Drop indicators (top/bottom line at projected depth) use `**projected**` and active/over indices in custom-order mode.
- **Hover-to-expand**: while dragging, hovering a **collapsed** folder for **1 second** calls `**toggleFolder`** so items can be dropped deeper without pre-opening folders.

### Post-move refresh

Every successful `chrome.bookmarks.move` callback invokes `**onRefresh()`** (from `App`), which re-fetches the tree from Chrome. Local `**items**` then realign with `useEffect` syncing from `flattenedItems`.

---

## Related files (quick map)


| Area                                       | Files                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| App shell, search, sort, keyboard tree nav | `src/App.tsx`, `App.module.scss`                                       |
| Tree + DnD                                 | `src/components/BookmarkTree.tsx`, `BookmarkTree.module.scss`          |
| Search results list                        | `src/components/BookmarkFlatList.tsx`                                  |
| Flatten / projection / reorder helpers     | `src/utils/treeUtils.ts`                                               |
| Bookmark open / tab behavior               | `src/utils/bookmarkNavigation.ts`                                      |
| Folder “open all” helpers                  | `src/utils/bookmarkUtils.ts`                                           |
| Extension bootstrap                        | `manifest.json`, `src/background.ts`, `sidepanel.html`, `src/main.tsx` |
| Build                                      | `vite.config.ts`, `package.json`                                       |


---

