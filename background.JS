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
          return blockedCategories[cat] !== false;
        })
        .map(({ pattern, replacement, regex }) => {
          let finalPattern = pattern;
          let flags = "g";

          // אם זו מילה באנגלית ולא הגדרת regex ידנית
          if (!regex && isLatin(pattern)) {
            // הוספת \b מבטיחה שזה יחפש רק מילה שלמה (לא חלק מ-click)
            finalPattern = `\\b${pattern}\\b`;
            flags = "gi"; // i עבור אי-רגישות לאותיות גדולות/קטנות
          } else if (regex) {
            flags = "gi";
          }

          return { pattern: finalPattern, replacement, flags, isRegex: true };
        });
      sendResponse({ ok: true, replacements });
    }).catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});