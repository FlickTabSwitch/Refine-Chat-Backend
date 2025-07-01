const urlParams = new URLSearchParams(window.location.search);
const marketerId = urlParams.get("marketerId");

if (marketerId) {
  localStorage.setItem("marketerId_temp", marketerId);

  // ✅ Try to store it in chrome.storage.local directly (if extension is already installed)
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'storeMarketerId', marketerId }, () => {
      console.log("✅ marketerId sent to background script");
    });
  }
}

// ⏳ Wait for 2 seconds then redirect to Web Store
setTimeout(() => {
  window.location.href = "https://chrome.google.com/webstore/detail/dpkdogndnhfbkcjhieedajfinhcbgoem";
}, 2000);
