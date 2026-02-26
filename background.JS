function isLatin(str) {
  return /^[\x00-\x7F]+$/.test(str);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_REPLACEMENTS") {
    Promise.all([
      fetch(chrome.runtime.getURL("block.json")).then(r => r.json()),
      chrome.storage.sync.get("blockedCategories")
    ]).then(([data, { blockedCategories = {} }]) => {
      const replacements = data.replacements
        .filter(({ category }) => {
          const cat = category || "general";
          return blockedCategories[cat] !== false; // ברירת מחדל: מופעל
        })
        .map(({ pattern, replacement, regex }) => {
          const flags = regex ? "g" : isLatin(pattern) ? "gi" : "g";
          return { pattern, replacement, flags };
        });
      sendResponse({ ok: true, replacements });
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});