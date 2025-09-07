# Bookmarks Manager

A fast, private, custom Chrome Side Panel Extension for managing your bookmarks.

Looks like (and works like) a file explorer from a code editor, but for your bookmarks.

It's a wrapper around the Chrome Extension API, so it edits your bookmarks in the same way as if you were using the Chrome bookmarks manager. The result is that the extension is private and local, it doesn't log your usage or data to any other servers. However, you can still sync your bookmarks across devices using Chrome's built-in sync feature.

## Tech Stack

- React
- TypeScript
- Chrome Extension API
- Vite

## Features

- [x] View all bookmarks (nested tree structure of folders and bookmarks like a file explorer)
- [x] Add a bookmark
- [x] Add a folder
- [x] Remove a bookmark
- [x] Remove a folder
- [x] Edit a bookmark
- [x] Edit a folder
- [x] Search for a bookmark or folder by title or url
- [x] Drag and drop to reorder bookmarks or folders in the tree structure
- [x] Light mode and dark mode
- [x] Sort bookmarks by title, date added, or both
- [x] Add keyboard navigation

## TODO

- [x] Improve editing bookmark dialog styles (light/dark themes)
  - [x] Fix select dropdown styling (light/dark themes)
  - [x] Fix height of select dropdown in edit bookmark dialog
- [ ] Add icons
- [ ] When clicking on a folder in the search results, clear the search input and open the folder in the tree structure
- [ ] Make top part sticky, or only bottom part with overflow scroll
- [ ] Add new bookmark action button (pre-fill url and title based on current tab, leave folder blank)
- [ ] Add new folder action button (completely empty form)
- [ ] Prevent editing top level folders (Bookmarks Bar and Other Bookmarks)
- [ ] Update context menu options for folders
    - [ ] Hide "Open in New Tab", "Open in New Window"
    - [ ] Rename "Edit" to "Rename"
    - [ ] Add "Open All (<count>)", "Open All (<count>) in New Window", "Open All (<count>) in New Tab Group"
- [ ] Fix drag and drop glitch (when dropping a bookmark into a position lower down on the list, it first gets inserted one item lower than intended, then quickly resolves to move to the correct position)
- [ ] Optional: make drag and drop between folders possible
