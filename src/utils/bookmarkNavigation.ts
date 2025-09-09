export const handleBookmarkClick = (
  event: React.MouseEvent,
  url: string | undefined,
) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id && url) {
      const tabId = tabs[0].id
      if (event.ctrlKey || event.metaKey) {
        chrome.tabs.create({ url })
      } else {
        chrome.tabs.update(tabId, { url, active: true })
        chrome.windows.update(tabs[0].windowId, { focused: true })
        interface TabChangeInfo {
          status?: string
        }
        const onUpdated = (
          updatedTabId: number,
          changeInfo: TabChangeInfo,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _tab: chrome.tabs.Tab,
        ) => {
          if (updatedTabId === tabId && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(onUpdated)
            chrome.scripting
              .executeScript({
                target: { tabId },
                func: () => {
                  window.focus()
                  document.body.focus()
                },
              })
              .catch((err) => console.log("Focus script failed:", err))
          }
        }
        chrome.tabs.onUpdated.addListener(onUpdated)
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  })
}
