let REPLACEMENTS = [];

// שמירת הטקסט המקורי של כל צומת
const originalText = new WeakMap();

function loadReplacements() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_REPLACEMENTS" }, (response) => {
      if (response?.ok) {
        REPLACEMENTS = response.replacements.map(({ pattern, replacement, flags }) => {
          // תמיד ליצור RegExp כדי לתמוך ב-\b
          const compiled = new RegExp(pattern, flags);
          return [compiled, replacement];
        });
      }
      resolve();
    });
  });
}

function replaceInTextNode(node) {
  // שמור את הטקסט המקורי אם עוד לא נשמר
  if (!originalText.has(node)) {
    originalText.set(node, node.textContent);
  }

  // התחל תמיד מהמקורי
  let text = originalText.get(node);
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replaceAll(pattern, replacement);
  }
  if (node.textContent !== text) {
    node.textContent = text;
  }
}

function nodeHasMatch(node) {
  const t = originalText.get(node) ?? node.textContent;
  return REPLACEMENTS.some(([p]) =>
    typeof p === "string" ? t.includes(p) : p.test(t)
  );
}

function isInteractive(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    parent.isContentEditable ||
    !!parent.closest("[contenteditable]")
  );
}

function walkDOM(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        if (isInteractive(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(replaceInTextNode);
}

function startObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        const node = mutation.target;
        if (!isInteractive(node)) {
          // טקסט השתנה מבחוץ — עדכן את המקורי
          originalText.set(node, node.textContent);
          replaceInTextNode(node);
        }
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (!isInteractive(node)) replaceInTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          walkDOM(node);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// האזנה לעדכון קטגוריות מה-popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CATEGORIES_UPDATED") {
    loadReplacements().then(() => walkDOM(document.body));
  }
});

loadReplacements().then(() => {
  walkDOM(document.body);
  startObserver();
});