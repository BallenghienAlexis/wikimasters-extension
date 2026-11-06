// Service worker éphémère : aucun état en mémoire.
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('collection.html') });
});
