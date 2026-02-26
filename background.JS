function isLatin(str) {
  return /^[\x00-\x7F]+$/.test(str);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_REPLACEMENTS") {
    Promise.all([
      fetch(chrome.runtime.getURL("block.json")).then(r => r.json()),
      fetch(chrome.runtime.getURL("allow.json")).then(r => r.json()),
      chrome.storage.sync.get("blockedCategories")
    ]).then(([blockData, allowData, { blockedCategories = {} }]) => {
      const allowlist = (allowData.allowlist || []).map(({ pattern }) => pattern);

      const replacements = blockData.replacements
        .filter(({ category }) => {
          const cat = category || "general";
          return blockedCategories[cat] !== false;
        })
        .map(({ pattern, replacement, regex }) => {
          let finalPattern = pattern;
          let flags = "g";

          if (!regex && isLatin(pattern)) {
            finalPattern = `\\b${pattern}\\b`;
            flags = "gi";
          } else if (regex) {
            flags = "gi";
          }

          return { pattern: finalPattern, replacement, flags, isRegex: true };
        });

      sendResponse({ ok: true, replacements, allowlist });
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});