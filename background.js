// background.js

const MODEL = "gemini-2.0-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Toolbar icon click -> tell the content script on the active Gmail tab to run.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !tab.url || !tab.url.startsWith("https://mail.google.com/")) {
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "RUN_ONE_CLICK_DRAFT" });
});

// Content script asks us to call the Gemini API (keeps the fetch off the page's origin
// and the API key out of the page context).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DRAFT_REPLY") {
    handleDraftRequest(message.payload)
      .then((draft) => sendResponse({ ok: true, draft }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleDraftRequest({ threadText, subject }) {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) {
    throw new Error(
      "No Gemini API key set. Right-click the extension icon → Options, and add your key."
    );
  }

  const systemPrompt =
    "You draft email replies for a user reading their Gmail inbox. " +
    "You will be given the most recent email in a thread and must write ONLY the body of the reply, as plain text. " +
    "Do not include a subject line or bracketed placeholders. " +
    "Do not sign off with a name unless it's obvious from the thread; otherwise end with a generic closing like 'Best,' with no name. " +
    "Keep it concise and directly responsive to the email.";

  const userContent = `Subject: ${subject || "(no subject)"}\n\nEmail:\n${threadText}\n\nWrite the reply now.`;

  const response = await fetch(`${API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: 600 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    let message = `Gemini request failed (${response.status}).`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error?.message) message += ` ${parsed.error.message}`;
    } catch (_) {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("");
  if (!text) throw new Error("No reply text returned from Gemini.");
  return text.trim();
}
