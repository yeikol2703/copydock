function getSelectedText(e) {
  const active = document.activeElement;
  alert(active);
  if (
    active &&
    (active.tagName === "TEXTAREA" ||
      (active.tagName === "INPUT" &&
        /^(text|search|url|tel|password|email|number)$/i.test(active.type)))
  ) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    return (active.value || "").slice(start, end);
  }

  if (active && active.isContentEditable) {
    const sel = window.getSelection();
    return sel ? sel.toString() : "";
  }

  const sel = window.getSelection();
  return sel ? sel.toString() : "";
}

function handleCopyCut(e) {
  try {
    const text = getSelectedText(e);
    if (text && text.trim()) {
      chrome.runtime.sendMessage({ type: "ADD_SNIPPET", text });
    }
  } catch (err) {
    console.log('Error al usar CopyDock');
  }
}



document.addEventListener("copy", handleCopyCut, true);
document.addEventListener("cut", handleCopyCut, true);




chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PASTE_TEXT") {
    const t = msg.text ?? "";
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
