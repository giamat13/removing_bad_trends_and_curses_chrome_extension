// בודק אם מחרוזת מכילה רק תווים לטיניים (אנגלית/מספרים)
function isLatin(str) {
  return /^[\x00-\x7F]+$/.test(str);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_REPLACEMENTS") {
    fetch(chrome.runtime.getURL("block.json"))
      .then(res => res.json())
      .then(data => {
        const replacements = data.replacements.map(({ pattern, replacement }) => {
          // אנגלית/מספרים — מוסיף gi אוטומטית
          const flags = isLatin(pattern) ? "gi" : "g";
          return { pattern, replacement, flags };
        });
        sendResponse({ ok: true, replacements });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});