// טוען את רשימת החסימות מ-background.js (שקורא מ-block.json)

let REPLACEMENTS = [];

function loadReplacements() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_REPLACEMENTS" }, (response) => {
      if (response?.ok) {
        REPLACEMENTS = response.replacements.map(({ pattern, replacement, flags }) => {
          const compiled = flags ? new RegExp(pattern, flags) : pattern;
          return [compiled, replacement];
        });
      }
      resolve();
    });
  });
}

function replaceInTextNode(node) {
  let text = node.textContent;
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replaceAll(pattern, replacement);
  }
  if (text !== node.textContent) {
    node.textContent = text;
  }
}

function nodeHasMatch(node) {
  const t = node.textContent;
  return REPLACEMENTS.some(([p]) =>
    typeof p === "string" ? t.includes(p) : p.test(t)
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
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          parent.isContentEditable ||
          parent.closest("[contenteditable]")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return nodeHasMatch(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
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
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          if (!parent) continue;
          const tag = parent.tagName;
          if (
            tag === "INPUT" || tag === "TEXTAREA" ||
            parent.isContentEditable ||
            parent.closest("[contenteditable]")
          ) continue;
          replaceInTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          walkDOM(node);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// הפעלה ראשית
loadReplacements().then(() => {
  walkDOM(document.body);
  startObserver();
});