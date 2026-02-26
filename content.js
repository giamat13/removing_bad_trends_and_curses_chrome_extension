let REPLACEMENTS = [];
let ALLOWLIST = [];

// placeholder ייחודי שלא יתנגש עם תוכן אמיתי
const PLACEHOLDER_PREFIX = "\x00ALLOW_";
const PLACEHOLDER_SUFFIX = "\x00";

const originalText = new WeakMap();

function loadReplacements() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_REPLACEMENTS" }, (response) => {
      if (response?.ok) {
        REPLACEMENTS = response.replacements.map(({ pattern, replacement, flags }) => {
          const compiled = new RegExp(pattern, flags);
          return [compiled, replacement];
        });
        ALLOWLIST = response.allowlist || [];
      }
      resolve();
    });
  });
}

function applyWithAllowlist(text) {
  if (ALLOWLIST.length === 0) {
    // אין allowlist, פשוט תחליף
    for (const [pattern, replacement] of REPLACEMENTS) {
      text = text.replaceAll(pattern, replacement);
    }
    return text;
  }

  // שלב 1: החלף מילים ב-allowlist ב-placeholder זמני
  const placeholderMap = {};
  ALLOWLIST.forEach((word, i) => {
    const placeholder = `${PLACEHOLDER_PREFIX}${i}${PLACEHOLDER_SUFFIX}`;
    // החלפה case-insensitive
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    text = text.replace(regex, (match) => {
      placeholderMap[placeholder] = match; // שמור את המקרה המקורי
      return placeholder;
    });
  });

  // שלב 2: הפעל את כל ה-block replacements
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replaceAll(pattern, replacement);
  }

  // שלב 3: החזר את מילות ה-allowlist המקוריות
  for (const [placeholder, original] of Object.entries(placeholderMap)) {
    text = text.replaceAll(placeholder, original);
  }

  return text;
}

function replaceInTextNode(node) {
  if (!originalText.has(node)) {
    originalText.set(node, node.textContent);
  }

  const text = applyWithAllowlist(originalText.get(node));
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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CATEGORIES_UPDATED") {
    loadReplacements().then(() => walkDOM(document.body));
  }
});

loadReplacements().then(() => {
  walkDOM(document.body);
  startObserver();
});