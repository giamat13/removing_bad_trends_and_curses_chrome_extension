async function init() {
  const { blockedCategories = {} } = await chrome.storage.sync.get("blockedCategories");

  const res = await fetch(chrome.runtime.getURL("block.json"));
  const data = await res.json();

  const categoryMap = {};
  for (const item of data.replacements) {
    const cat = item.category || "general";
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  }

  const container = document.getElementById("categories");

  for (const [cat, count] of Object.entries(categoryMap)) {
    const enabled = blockedCategories[cat] !== false;

    const div = document.createElement("div");
    div.className = "category" + (enabled ? " active" : "");

    div.innerHTML = `
      <div>
        <div class="category-name">${cat.replace(/_/g, " ")}</div>
        <div class="category-count">${count} ביטויים</div>
      </div>
      <label class="toggle">
        <input type="checkbox" ${enabled ? "checked" : ""}>
        <div class="toggle-track"></div>
        <div class="toggle-thumb"></div>
      </label>
    `;

    const checkbox = div.querySelector("input");
    checkbox.addEventListener("change", async () => {
      const { blockedCategories = {} } = await chrome.storage.sync.get("blockedCategories");
      blockedCategories[cat] = checkbox.checked;
      await chrome.storage.sync.set({ blockedCategories });
      div.classList.toggle("active", checkbox.checked);

      // שלח לכל הטאבים הפעילים — לא רק הנוכחי
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: "CATEGORIES_UPDATED" })
          .catch(() => {}); // מתעלם מטאבים שאין להם content script
      }
    });

    container.appendChild(div);
  }
}

init();