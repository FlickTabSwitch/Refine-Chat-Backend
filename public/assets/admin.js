let savedToken = "";

document.getElementById("unlockBtn").addEventListener("click", () => {
  const token = document.getElementById("adminToken").value.trim();
  if (!token) return alert("Please enter admin token");
  savedToken = token;

  document.getElementById("adminLogin").style.display = "none";
  document.getElementById("adminContent").style.display = "block";
  fetchMarketers();
});

document.getElementById("marketerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const referralCode = document.getElementById("referralCode").value.trim();

  if (!name || !email || !referralCode) return alert("All fields are required.");

  try {
    await axios.post("/admin/marketers", { name, email, referralCode }, {
      headers: { "x-admin-token": savedToken }
    });
    e.target.reset();
    fetchMarketers();
  } catch (err) {
    alert(err.response?.data?.error || err.message);
  }
});

async function fetchMarketers() {
  const tableBody = document.getElementById("marketerTableBody");
  try {
    const res = await axios.get("/admin/marketers", {
      headers: { "x-admin-token": savedToken }
    });

    const marketers = res.data;
    tableBody.innerHTML = "";

    if (marketers.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No marketers yet.</td></tr>`;
      return;
    }

    marketers.forEach(m => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${m.name}</td>
        <td>${m.email}</td>
        <td>${m.referralCode}</td>
        <td>${m.referredUsers || 0}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" data-id="${m._id}">🗑️ Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Add delete handlers
    document.querySelectorAll("[data-id]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this marketer?")) return;
        try {
          await axios.delete(`/admin/marketers/${btn.dataset.id}`, {
            headers: { "x-admin-token": savedToken }
          });
          fetchMarketers();
        } catch (err) {
          alert(err.response?.data?.error || err.message);
        }
      });
    });
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5">❌ Error: ${err.response?.data?.error || err.message}</td></tr>`;
  }
}
