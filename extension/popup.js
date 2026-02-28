const API = "http://localhost:3000/api";

const $ = (id) => document.getElementById(id);

let currentItem = null;
let tabInfo = null;
let selectedType = "reading-list";

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabInfo = {
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.favIconUrl || "",
    };

    // Check if already saved
    const res = await fetch(`${API}/items/lookup?url=${encodeURIComponent(tabInfo.url)}`);
    const data = await res.json();

    $("title").value = data.found ? data.item.title : tabInfo.title;
    $("favicon").src = tabInfo.faviconUrl;

    if (data.found) {
      currentItem = data.item;
      $("tags").value = data.item.tags.map((t) => t.name).join(", ");
      setType(data.item.type || "reading-list");
      $("status-label").textContent = "Saved";
      $("status-label").classList.add("saved");
      $("actions-edit").hidden = false;
      $("actions-save").hidden = true;
    } else {
      $("tags").value = "";
      $("status-label").textContent = "Not saved";
      $("actions-save").hidden = false;
      $("actions-edit").hidden = true;
    }

    $("loading").hidden = true;
    $("form").hidden = false;
  } catch (err) {
    showError("Could not connect to app. Is it running on localhost:3000?");
  }
}

function parseTags(input) {
  return input
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function disableButtons() {
  for (const btn of document.querySelectorAll(".btn")) {
    btn.disabled = true;
  }
}

async function save() {
  disableButtons();
  try {
    await fetch(`${API}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: $("title").value.trim(),
        url: tabInfo.url,
        faviconUrl: tabInfo.faviconUrl,
        type: selectedType,
        tags: parseTags($("tags").value),
      }),
    });
    showDone("Saved!");
  } catch {
    showError("Failed to save");
  }
}

async function update() {
  disableButtons();
  try {
    await fetch(`${API}/items/${currentItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: $("title").value.trim(),
        faviconUrl: tabInfo.faviconUrl,
        type: selectedType,
        tagNames: parseTags($("tags").value),
      }),
    });
    showDone("Updated!");
  } catch {
    showError("Failed to update");
  }
}

async function remove() {
  disableButtons();
  try {
    await fetch(`${API}/items/${currentItem.id}`, { method: "DELETE" });
    showDone("Removed");
  } catch {
    showError("Failed to remove");
  }
}

function showDone(message) {
  $("form").hidden = true;
  $("loading").hidden = true;
  $("done-message").textContent = message;
  $("done").hidden = false;
  setTimeout(() => window.close(), 600);
}

function showError(message) {
  $("loading").hidden = true;
  $("error-message").textContent = message;
  $("error").hidden = false;
}

function setType(type) {
  selectedType = type;
  for (const btn of document.querySelectorAll(".toggle-btn")) {
    btn.classList.toggle("active", btn.dataset.value === type);
  }
}

// Event listeners
$("btn-save").addEventListener("click", save);
$("btn-update").addEventListener("click", update);
$("btn-remove").addEventListener("click", remove);

for (const btn of document.querySelectorAll(".toggle-btn")) {
  btn.addEventListener("click", () => setType(btn.dataset.value));
}

// Keyboard shortcut: Enter to save/update
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (currentItem) {
      update();
    } else {
      save();
    }
  }
});

init();
