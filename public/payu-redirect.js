// public/js/payu-redirect.js or wherever your static assets are
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  for (const [key, value] of urlParams.entries()) {
    const input = document.querySelector(`input[name="${key}"]`);
    if (input) input.value = value;
  }
  document.getElementById('payuForm').submit();
});
