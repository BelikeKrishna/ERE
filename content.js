// content.js

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "RUN_ONE_CLICK_DRAFT") {
    runOneClickDraft();
  }
});

function showToast(text, type = "info") {
  const existing = document.querySelector(".ai-draft-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `ai-draft-toast ai-draft-toast-${type}`;
  toast.textContent = text;
  document.body.appendChild(toast);

  if (type !== "loading") {
    setTimeout(() => toast.remove(), 4000);
  }
  return toast;
}

function getSubject() {
  const h2 = document.querySelector("h2.hP");
  return h2 ? h2.innerText.trim() : "";
}

function getLastEmailText() {
  const bodies = document.querySelectorAll("div.a3s");
  if (!bodies.length) return "";
  return bodies[bodies.length - 1].innerText.trim();
}

function findOpenComposeBox() {
  const boxes = document.querySelectorAll(
    'div[aria-label="Message Body"][contenteditable="true"], div[g_editable="true"][contenteditable="true"]'
  );
  for (const box of boxes) {
    const rect = box.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return box;
  }
  return null;
}

function findReplyButton() {
  const candidates = Array.from(document.querySelectorAll('div[role="button"][aria-label]'));
  // Prefer an exact "Reply" button over "Reply all" / "Forward".
  const exact = candidates.find((el) => el.getAttribute("aria-label") === "Reply");
  if (exact) return exact;
  return candidates.find((el) => el.getAttribute("aria-label")?.startsWith("Reply")) || null;
}

function waitForComposeBox(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const existing = findOpenComposeBox();
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const box = findOpenComposeBox();
      if (box) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(box);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

function insertDraft(composeBox, text) {
  composeBox.focus();
  composeBox.innerHTML = "";
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    composeBox.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) composeBox.appendChild(document.createElement("br"));
  });
  composeBox.dispatchEvent(new Event("input", { bubbles: true }));
}

async function runOneClickDraft() {
  const subject = getSubject();
  const threadText = getLastEmailText();

  if (!threadText) {
    showToast("Open an email first, then click the extension.", "error");
    return;
  }

  showToast("Drafting reply with ChatGPT…", "loading");

  let composeBox = findOpenComposeBox();
  if (!composeBox) {
    const replyBtn = findReplyButton();
    if (replyBtn) {
      replyBtn.click();
      composeBox = await waitForComposeBox();
    }
  }

  if (!composeBox) {
    showToast("Couldn't find or open the reply box. Click Reply manually and try again.", "error");
    return;
  }

  chrome.runtime.sendMessage(
    { type: "DRAFT_REPLY", payload: { threadText, subject } },
    (response) => {
      if (chrome.runtime.lastError) {
        showToast("Extension error. Try reloading Gmail.", "error");
        return;
      }
      if (!response || !response.ok) {
        showToast(response?.error || "Something went wrong.", "error");
        return;
      }
      insertDraft(composeBox, response.draft);
      showToast("Draft inserted — review before sending.", "success");
    }
  );
}
