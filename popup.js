const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const clearEl = document.getElementById("clear-all");

let items = [];

function render(filter = "") {
  const q = filter.trim().toLowerCase();
  listEl.innerHTML = "";

  const filtered = items
    .slice()
    .sort((a, b) => b.pinned - a.pinned || b.ts - a.ts)
    .filter((s) => !q || s.text.toLowerCase().includes(q));

  if (!filtered.length) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = q
      ? "Sin resultados."
      : "Todavía no hay copias guardadas.";
    listEl.appendChild(div);
    return;
  }

  for (const s of filtered) {
    const item = document.createElement("div");
    item.className = "item" + (s.pinned ? " pinned" : "");

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = s.text;

    const left = document.createElement("div");
    left.className = "text-wrapper";
    left.appendChild(text);

    const btns = document.createElement("div");
    btns.className = "actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "icon copy";
    copyBtn.title = "Copiar al portapapeles";
    copyBtn.setAttribute("aria-label", "Copiar al portapapeles");
    const copyImg = document.createElement("img");
    copyImg.src = "icons/copy.png";
    copyImg.width = 20;
    copyImg.height = 20;
    copyImg.alt = "";
    copyImg.decoding = "async";
    copyImg.draggable = false;
    copyBtn.appendChild(copyImg);
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(s.text);
      } catch (e) {
        console.log('No se pudo copiar:', e);
      }
      try {
        await send("PASTE_INTO_ACTIVE", { text: s.text }); 
      } catch (e) {
        console.log('No se pudo pegar:', e);
      }
    };

    const pinBtn = document.createElement("button");
    pinBtn.className = "icon pin";
    pinBtn.title = s.pinned ? "Quitar pin" : "Fijar arriba";
    pinBtn.setAttribute("aria-label", s.pinned ? "Quitar pin" : "Fijar arriba");
    const pinImg = document.createElement("img");
    pinImg.src = s.pinned ? "icons/pinned.png" : "icons/pin.png";
    pinImg.width = 20;
    pinImg.height = 20;
    pinImg.alt = "";
    pinImg.decoding = "async";
    pinImg.draggable = false;
    pinBtn.appendChild(pinImg);
    pinBtn.onclick = async () => {
      await send("TOGGLE_PIN", { id: s.id });
      await refresh();
    };

    const delBtn = document.createElement("button");
    delBtn.className = "icon delete";
    delBtn.title = "Eliminar";
    delBtn.setAttribute("aria-label", "Eliminar");
    const delImg = document.createElement("img");
    delImg.src = "icons/delete.png";
    delImg.width = 20;
    delImg.height = 20;
    delImg.alt = "";
    delImg.decoding = "async";
    delImg.draggable = false;
    delBtn.appendChild(delImg);
    delBtn.onclick = async () => {
      await send("DELETE_SNIPPET", { id: s.id });
      await refresh();
    };

    btns.append(pinBtn, copyBtn, delBtn);
    item.append(left, btns);
    listEl.appendChild(item);
  }
}

function send(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, resolve);
  });
}

async function refresh() {
  const resp = await send("GET_SNIPPETS");
  items = resp?.list || [];
  render(searchEl.value);
}

searchEl.addEventListener("input", () => render(searchEl.value));

clearEl.addEventListener("click", async () => {
  if (!confirm("¿Borrar todo el historial de copias?")) return;
  const resp = await send("GET_SNIPPETS");
  const list = resp?.list || [];
  for (const it of list) {
    await send("DELETE_SNIPPET", { id: it.id });
  }
  await refresh();
});

refresh();

const themeBtn = document.getElementById("theme");
const THEME_KEY = "theme"; // "light" | "dark"

function applyTheme(mode) {
  const m = mode === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", m);
}

async function initTheme() {
  try {
    const { [THEME_KEY]: saved } = await chrome.storage.local.get(THEME_KEY);
    const initial =
      saved ||
      (window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    applyTheme(initial);
  } catch {
    const fallback =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    applyTheme(fallback);
  }
}

themeBtn?.addEventListener("click", async () => {
  const current =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    await chrome.storage.local.set({ [THEME_KEY]: next });
  } catch {
    console.log('Error al usar CopyDock');
  }
});

initTheme();
