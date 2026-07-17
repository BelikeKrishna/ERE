const input = document.getElementById("apiKey");
const status = document.getElementById("status");
const saveBtn = document.getElementById("save");

chrome.storage.local.get("apiKey", ({ apiKey }) => {
  if (apiKey) input.value = apiKey;
});

saveBtn.addEventListener("click", () => {
  const value = input.value.trim();
  if (!value) {
    status.textContent = "Enter a key first.";
    status.style.color = "#c62828";
    return;
  }
  chrome.storage.local.set({ apiKey: value }, () => {
    status.textContent = "Saved.";
    status.style.color = "#2e7d32";
  });
});
