// מחליף את המספר הגרוע (66+1) ב-6* בכל טקסט בדף
// גם כשהוא חלק ממספר גדול יותר

const BAD_NUMBER = String(66 + 1);
const REPLACEMENT = "6*";

function replaceInTextNode(node) {
  node.textContent = node.textContent.replaceAll(BAD_NUMBER, REPLACEMENT);
}

function walkDOM(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // מדלג על תגיות script ו-style
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        // רק צמתים שמכילים את המספר
        if (node.textContent.includes(BAD_NUMBER)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  nodes.forEach(replaceInTextNode);
}

// הפעל על הדף הנוכחי
walkDOM(document.body);

// עקוב אחרי שינויים דינמיים (SPA, תוכן שנטען אחרי)
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        replaceInTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        walkDOM(node);
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
