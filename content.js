function getSelectedText(e) {
  const active = document.activeElement;

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
    // Silencioso
  }
}

document.addEventListener("copy", handleCopyCut, true);
document.addEventListener("cut", handleCopyCut, true);
