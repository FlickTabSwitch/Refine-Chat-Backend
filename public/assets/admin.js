let savedToken = localStorage.getItem("admin-token") || "";

const loginBox = document.getElementById("adminLogin");
const adminPanel = document.getElementById("adminContent");
const unlockBtn = document.getElementById("unlockBtn");
const logoutBtn = document.getElementById("logoutBtn");
const marketerForm = document.getElementById("marketerForm");
const tableBody = document.getElementById("marketerTableBody");
const tokenInput = document.getElementById("adminToken");

if (!savedToken) {
  loginBox.style.display = "block";
  adminPanel.style.display = "none";
} else {
  verifyTokenAndFetch();
}

// 🔓 Unlock panel
unlockBtn.addEventListener("click", async () => {
  const input = tokenInput.value.trim();
  if (!input) return alert("Please enter admin token");

  savedToken = input;
  localStorage.setItem("admin-token", savedToken);
  await verifyTokenAndFetch();
});

// 🚪 Logout
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("admin-token");
  savedToken = "";
  tokenInput.value = ""; // clear token field
  loginBox.style.display = "block";
  adminPanel.style.display = "none";
});

// ✅ Validate token
async function verifyTokenAndFetch() {
  try {
    await fetchMarketers();
    loginBox.style.display = "none";
    adminPanel.style.display = "block";
  } catch (err) {
    alert("Invalid token. Try again.");
    localStorage.removeItem("admin-token");
    savedToken = "";
    tokenInput.value = "";
    loginBox.style.display = "block";
    adminPanel.style.display = "none";
  }
}

// ➕ Add marketer
marketerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const referralCode = document.getElementById("referralCode").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!name || !email || !referralCode) return alert("All fields are required.");

  try {
    await axios.post("/admin/marketers", { name, email, referralCode, phone }, {
      headers: { "x-admin-token": savedToken }
    });
    e.target.reset();
    fetchMarketers();
  } catch (err) {
    alert(err.response?.data?.error || "Failed to add marketer");
  }
});

// 📋 Fetch marketers
async function fetchMarketers() {
  const res = await axios.get("/admin/marketers", {
    headers: { "x-admin-token": savedToken }
  });

  const marketers = res.data;
  tableBody.innerHTML = "";

  if (marketers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No marketers yet.</td></tr>`;
    return;
  }

  marketers.forEach(m => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${m.name}</td>
      <td>${m.email}</td>
      <td>${m.referralCode}</td>
      <td>${m.phone || "-"}</td>
      <td>${m.referredUsers || 0}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger" data-id="${m._id}">🗑️ Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll("[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this marketer?")) return;
      try {
        await axios.delete(`/admin/marketers/${btn.dataset.id}`, {
          headers: { "x-admin-token": savedToken }
        });
        fetchMarketers();
      } catch (err) {
        alert("Failed to delete marketer");
      }
    });
  });
}
