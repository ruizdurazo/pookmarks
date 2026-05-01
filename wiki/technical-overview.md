# Technical overview

This document describes how the repository is wired for a Chrome MV3 side-panel extension, how bookmark data flows through the UI, and how **search**, **drag-and-drop**, and **bookmark URL preview** (hover card) are implemented.

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

## Bookmark URL preview (hover card)

Hovering a **bookmark** (not a folder) for about **two seconds** opens a floating card near the cursor with optional title, description, Open Graph image, site name, and URL. Previews apply to bookmarks in both the **tree** and **search results**.

### Why the background service worker fetches the page

The UI (`BookmarkFlatList`, `BookmarkTree`) calls `**requestBookmarkPreview(url)**` in `src/utils/bookmarkPreview.ts`, which sends a **`chrome.runtime.sendMessage`** with type **`bookmark-preview:get`** and the bookmark URL.

The **service worker** (`src/background.ts`) handles that message, performs **`fetch(url)`**, parses HTML, and returns **`BookmarkPreviewMetadata`** (`url`, `finalUrl`, optional `title`, `description`, `image`, `siteName`). Fetching from the background avoids doing cross-origin document requests from the side-panel page itself and relies on **`host_permissions`** for `http://*/*` and `https://*/*`.

### Background fetch behavior

- **Protocols** — Only **`http:`** and **`https:`** URLs are accepted (`normalizePreviewUrl` throws otherwise).
- **Timeout** — **`AbortController`** aborts after **8 seconds** (`PREVIEW_FETCH_TIMEOUT_MS`).
- **Request** — `fetch` uses `accept: text/html,application/xhtml+xml`, **`redirect: "follow"`**, and reads **`response.text()`** capped at the first **500,000** characters (`MAX_HTML_CHARS`).
- **Non-HTML** — If `Content-Type` is not treated as HTML (see `isHtmlContent`), the worker returns minimal metadata (`url`, **`finalUrl`** after redirects) with no parsed fields.
- **Cache** — Successful lookups are stored in an in-memory **`Map`** keyed by normalized URL string, with **24-hour** TTL (`PREVIEW_CACHE_TTL_MS`).

### Metadata extraction (`extractPreviewMetadata`)

HTML is parsed with **regex-based** helpers (not a full DOM parser):

- **`<meta>` tags** — Scanned for `property`, `name`, or `itemprop` plus `content`; keys are lowercased for lookup.
- **Title** — Prefer **`og:title`** / **`twitter:title`**, else **`<title>...</title>`** with tags stripped and entities decoded.
- **Description** — **`og:description`**, **`twitter:description`**, or **`description`**.
- **Image** — **`og:image`**, **`twitter:image`**, or **`twitter:image:src`**, resolved with **`new URL(image, baseUrl)`** and restricted to **http/https**.
- **Site name** — **`og:site_name`** or **`application-name`**.

Responses use **`sendResponse`** from **`chrome.runtime.onMessage`**; the listener returns **`true`** so the async `getBookmarkPreview` chain can respond later.

### Hook and UI (`useBookmarkPreview`, `BookmarkPreviewCard`)

`src/hooks/useBookmarkPreview.ts` owns hover timing and positioning:

- **Delay** — **`HOVER_DELAY_MS = 2000`**: the preview does not show until the pointer has rested on the bookmark row for two seconds (timer resets when re-entering or when URL/disabled changes).
- **Touch** — **`pointerType === "touch"`** is ignored so previews stay pointer/desktop-oriented.
- **Dismiss** — Leaving the row, **`pointercancel`**, or **`mousedown`/`pointerdown`** on the trigger hides the card (avoids fighting clicks and drag).
- **Stale responses** — A monotonic **`requestId`** ignores async results if the user moved away before the fetch completed.
- **Portal** — When visible, **`BookmarkPreviewCard`** is rendered with **`createPortal(..., document.body)`** so it stacks above the side panel.
- **Position** — **`getPreviewPositionFromPointer`** clamps horizontal center near the cursor (**300 px** card width, margins), chooses **`placement`** `"above"` vs `"below"` from viewport space vs **`ESTIMATED_CARD_HEIGHT`**, and stores **`left`/`top`** for absolute positioning.

`BookmarkPreviewCard` (`src/components/BookmarkPreview.tsx`) roles:

- **`loading`** — Shows **`fallbackTitle`** (bookmark title from the tree/list) and translated **`previewLoading`**.
- **`error`** — **`previewUnavailable`** plus **`finalUrl`** / URL display.
- **`ready`** — Optional og image (**`referrerPolicy="no-referrer"`**), site name, title, description, display URL.

### Where triggers are attached

- **`BookmarkTree`** — Only **bookmark** rows spread **`previewTriggerProps`** on the inner bookmark row (`disabled` when **`isOverlay`**, **`isDraggingActive`**, or **`isDragging`** so previews do not fight drag-and-drop).
- **`BookmarkFlatList`** — **`BookmarkFlatListBookmarkButton`** wraps bookmark-only buttons with **`previewTriggerProps`** on an outer **`div`**; folders only navigate into the tree and have no preview hook.

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
| Hover URL preview                          | `src/hooks/useBookmarkPreview.ts`, `src/components/BookmarkPreview.tsx`, `src/utils/bookmarkPreview.ts`, `src/background.ts` (message handler + fetch) |
| Extension bootstrap                        | `manifest.json`, `src/background.ts`, `sidepanel.html`, `src/main.tsx` |
| Build                                      | `vite.config.ts`, `package.json`                                       |


---

