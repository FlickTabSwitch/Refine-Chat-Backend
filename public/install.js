const urlParams = new URLSearchParams(window.location.search);
const marketerId = urlParams.get("marketerId");

if (marketerId) {
  localStorage.setItem("marketerId_temp", marketerId);
}

window.location.href = "https://chrome.google.com/webstore/detail/dpkdogndnhfbkcjhieedajfinhcbgoem";
