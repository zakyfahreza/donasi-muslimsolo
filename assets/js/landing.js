/* Logika halaman publik (Landing Page) — Requirement 1. */
(function () {
  Utils.setHeader("#header", '<a class="header-icon-link" href="admin.html" title="Login Admin" aria-label="Login Admin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg></a>');
  document.getElementById("year").textContent = new Date().getFullYear();

  const content = document.getElementById("content");

  if (API.isDemo()) {
    const hero = document.querySelector(".hero");
    if (hero) {
      const note = document.createElement("div");
      note.className = "notice info";
      note.style.marginTop = "0";
      note.innerHTML = "Mode demo aktif — menampilkan data contoh. Isi <b>API_URL</b> di config.js untuk data sebenarnya.";
      hero.parentNode.insertBefore(note, hero);
    }
  }

  function campaignCard(c) {
    const collected = Number(c.current_amount) || 0;
    const target = Number(c.target_amount) || 0;
    const pct = Utils.progress(collected, target);
    const isCompleted = String(c.status).toUpperCase() === "COMPLETED";
    const cover = c.image
      ? '<img src="' + Utils.esc(Utils.driveImage(c.image)) + '" alt="' + Utils.esc(c.title) + '" loading="lazy" />'
      : '<div class="ph"></div>';

    // Tombol aksi: sembunyikan untuk donasi yang sudah terpenuhi/selesai
    const actionBtn = isCompleted
      ? '<div class="cmp-fulfilled">✅ Donasi Terpenuhi</div>'
      : '<a class="btn btn-primary" href="detail.html?id=' + encodeURIComponent(c.id) + '">Lihat Detail Donasi</a>';

    return (
      '<article class="card cmp-card' + (isCompleted ? ' cmp-card--completed' : '') + '">' +
      '<div class="cmp-cover">' + cover +
      '<span class="cmp-pct">' + pct + "%</span>" +
      '<span class="cmp-status">' + Utils.campaignBadgeSolid(c.status) + "</span>" +
      "</div>" +
      '<div class="cmp-body">' +
      '<h3 class="cmp-title">' + Utils.esc(c.title) + "</h3>" +
      '<div class="progress"><span style="width:' + Math.min(pct, 100) + '%"></span></div>' +
      "<div>" +
      '<div class="collected-label">Terkumpul</div>' +
      '<div class="collected-amt">' + Utils.rupiah(collected) +
      " <small>/ " + Utils.rupiah(target) + "</small></div>" +
      "</div>" +
      '<div class="cmp-meta"><span>' + pct + "% tercapai</span><span>" + Utils.daysLeft(c.deadline) + "</span></div>" +
      actionBtn +
      "</div></article>"
    );
  }

  function renderError(message) {
    content.innerHTML =
      '<div class="state">' +
      '<div class="notice err">' + Utils.esc(message) + "</div>" +
      '<button class="btn btn-outline auto" id="retry">Coba Lagi</button>' +
      "</div>";
    const btn = document.getElementById("retry");
    if (btn) btn.addEventListener("click", load);
  }

  function lpjCard(l) {
    const cover = l.image
      ? '<img src="' + Utils.esc(Utils.driveImage(l.image)) + '" alt="' + Utils.esc(l.title) + '" loading="lazy" />'
      : '<div class="ph"></div>';
    const amount = Number(l.amount) || 0;
    return (
      '<a class="card cmp-card lpj-link" href="lpj-detail.html?id=' + encodeURIComponent(l.id) + '">' +
      '<div class="cmp-cover">' + cover + "</div>" +
      '<div class="cmp-body">' +
      '<div class="lpj-meta">' + Utils.formatDate(l.date) + "</div>" +
      '<h3 class="cmp-title">' + Utils.esc(l.title) + "</h3>" +
      '<div class="lpj-amount">' + Utils.rupiah(amount) + "</div>" +
      '<span class="btn btn-outline">Lihat Detail</span>' +
      "</div></a>"
    );
  }

  function renderLpj(el, items) {
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="state">Belum ada laporan pengadaan.</div>';
      return;
    }
    el.innerHTML = '<div class="grid cols-2">' + items.map(lpjCard).join("") + "</div>";
  }

  async function loadLpj() {
    const el = document.getElementById("lpj-content");
    if (!el) return;
    el.innerHTML = '<div class="state"><div class="spinner"></div>Memuat laporan...</div>';
    try {
      // Data cache tampil instan; onFresh memperbarui bila server mengirim data baru.
      const items = await API.getLpj(function (fresh) { renderLpj(el, fresh); });
      renderLpj(el, items);
    } catch (e) {
      el.innerHTML = '<div class="state"><div class="notice err">' + Utils.esc(e.message || "Gagal memuat laporan.") + "</div></div>";
    }
  }

  function renderCampaigns(campaigns) {
    // Tampilkan kampanye ACTIVE dan COMPLETED; sembunyikan yang CLOSED
    const visible = (campaigns || []).filter(function (c) {
      const s = String(c.status).toUpperCase();
      return s === "ACTIVE" || s === "COMPLETED";
    });
    if (visible.length === 0) {
      content.innerHTML = '<div class="state">Belum ada program donasi yang aktif saat ini. Silakan kembali lagi nanti.</div>';
      return;
    }
    content.innerHTML = '<div class="grid cols-2">' + visible.map(campaignCard).join("") + "</div>";
  }

  async function load() {
    content.innerHTML = '<div class="state"><div class="spinner"></div>Memuat program donasi...</div>';
    try {
      const campaigns = await API.getCampaigns(function (fresh) { renderCampaigns(fresh); });
      renderCampaigns(campaigns);
    } catch (e) {
      renderError(e.message || "Gagal memuat data. Periksa koneksi Anda.");
    }
  }

  load();
  loadLpj();
})();
