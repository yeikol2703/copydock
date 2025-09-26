const KEY = "snippets";
const MAX_ITEMS = 100;

async function loadSnippets() {
  const { [KEY]: arr } = await chrome.storage.local.get(KEY);
  return Array.isArray(arr) ? arr : [];
}

async function saveSnippets(arr) {
  await chrome.storage.local.set({ [KEY]: arr });
}

async function addSnippet(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  const list = await loadSnippets();
  const existsIdx = list.findIndex((s) => s.text === trimmed);
  if (existsIdx !== -1) {
    const [existing] = list.splice(existsIdx, 1);
    existing.ts = Date.now();
    list.unshift(existing);
  } else {
    list.unshift({
      id: crypto.randomUUID(),
      text: trimmed,
      ts: Date.now(),
      pinned: false,
    });
    if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
  }
  await saveSnippets(list);
  updateContextMenu(list);
}

async function removeSnippet(id) {
  const list = (await loadSnippets()).filter((s) => s.id !== id);
  await saveSnippets(list);
  updateContextMenu(list);
}

async function togglePin(id) {
  const list = await loadSnippets();
  const idx = list.findIndex((s) => s.id === id);
  if (idx !== -1) {
    list[idx].pinned = !list[idx].pinned;
    list.sort((a, b) => b.pinned - a.pinned || b.ts - a.ts);
    await saveSnippets(list);
    updateContextMenu(list);
  }
}

async function pasteIntoActiveTab(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (chrome.scripting?.executeScript) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",        
      args: [text],
      func: (t) => {
        const el = document.activeElement;
        const isTextInput =
          el &&
          (el.tagName === "TEXTAREA" ||
            (el.tagName === "INPUT" &&
              /^(text|search|url|tel|password|email|number)$/i.test(el.type)) ||
          el.isContentEditable);

        if (!isTextInput) {
          navigator.clipboard?.writeText?.(t).catch(() => {});
          alert("⚠️ Enfoca un campo de texto. El contenido se copió al portapapeles.");
          return;
        }

        el.focus?.();

        if (typeof el.selectionStart === "number" && typeof el.selectionEnd === "number") {
          const start = el.selectionStart, end = el.selectionEnd;
          const val = ("value" in el ? el.value : el.textContent) || "";
          const next = val.slice(0, start) + t + val.slice(end);
          if ("value" in el) el.value = next; else el.textContent = next;
          const caret = start + t.length;
          el.setSelectionRange?.(caret, caret);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          try { document.execCommand("insertText", false, t); }
          catch { el.textContent = (el.textContent || "") + t; }
        }
      }
    });
  } else {
    chrome.tabs.sendMessage(tab.id, { type: "PASTE_TEXT", text });
  }
}

async function updateContextMenu(list) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "root",
      title: "Pegar desde CopyDock",
      contexts: ["editable"],
    });

    const top = (list || [])
      .slice()
      .sort((a, b) => b.pinned - a.pinned || b.ts - a.ts)
      .slice(0, 10);

    for (const s of top) {
      chrome.contextMenus.create({
        id: `paste:${s.id}`,
        parentId: "root",
        title:
          (s.pinned ? "📌 " : "") +
          (s.text.length > 40 ? s.text.slice(0, 37) + "…" : s.text),
        contexts: ["editable"],
      });
    }
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "ADD_SNIPPET") {
      await addSnippet(msg.text);
      sendResponse({ ok: true });
    } else if (msg.type === "GET_SNIPPETS") {
      const list = await loadSnippets();
      sendResponse({ ok: true, list });
    } else if (msg.type === "DELETE_SNIPPET") {
      await removeSnippet(msg.id);
      sendResponse({ ok: true });
    } else if (msg.type === "TOGGLE_PIN") {
      await togglePin(msg.id);
      sendResponse({ ok: true });
    } else if (msg.type === "PASTE_INTO_ACTIVE") {
      await pasteIntoActiveTab(msg.text);
      sendResponse({ ok: true });
    }
  })();
  return true;
});

(async () => {
  updateContextMenu(await loadSnippets());
})();

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (!info.menuItemId.startsWith("paste:")) return;
  const id = info.menuItemId.split(":")[1];
  const list = await loadSnippets();
  const item = list.find((s) => s.id === id);
  if (item) await pasteIntoActiveTab(item.text);
});
