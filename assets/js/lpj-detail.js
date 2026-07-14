/* Logika halaman Detail LPJ Pengadaan. */
(function () {
  Utils.setHeader("#header", '<a class="header-link" href="index.html">Lihat Situs</a>');
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const content = document.getElementById("content");
  const id = Utils.getParam("id");

  function renderDetail(l) {
    const amount = Number(l.amount) || 0;
    const cover = l.image
      ? '<div class="cmp-cover"><img src="' + Utils.esc(Utils.driveImage(l.image)) + '" alt="' + Utils.esc(l.title) + '" /></div>'
      : "";

    content.innerHTML =
      '<article class="card">' + cover +
      '<div class="card-pad">' +
      '<div class="lpj-meta">' + Utils.formatDate(l.date) + "</div>" +
      '<h1 class="page-title" style="margin:6px 0 12px">' + Utils.esc(l.title) + "</h1>" +
      '<div class="lpj-amount">' + Utils.rupiah(amount) + "</div>" +
      "</div></article>" +
      '<div class="section-label">Rincian / Keterangan</div>' +
      '<div class="card card-pad"><p class="desc">' + Utils.esc(l.description || "-") + "</p></div>" +
      '<div id="related"></div>';

    // Tampilkan program terkait (opsional) bila ada.
    if (l.campaign_id) {
      API.getCampaign(l.campaign_id).then(function (c) {
        if (!c) return;
        const rel = document.getElementById("related");
        if (!rel) return;
        rel.innerHTML =
          '<div class="section-label">Program Terkait</div>' +
          '<a class="card card-pad lpj-related" href="detail.html?id=' + encodeURIComponent(c.id) + '">' +
          '<span class="lpj-related-title">' + Utils.esc(c.title) + "</span>" +
          '<span class="lpj-related-arrow">&rarr;</span></a>';
      }).catch(function () { /* abaikan bila program tidak ditemukan */ });
    }
  }

  function renderMessage(msg) {
    content.innerHTML = '<div class="state">' + Utils.esc(msg) + '<div class="mt-12"><a class="btn btn-outline auto" href="index.html">Kembali ke Beranda</a></div></div>';
  }

  async function load() {
    if (!id) {
      renderMessage("Silakan pilih laporan dari halaman beranda terlebih dahulu.");
      return;
    }
    try {
      const l = await API.getLpjItem(id, function (fresh) { if (fresh) renderDetail(fresh); });
      if (!l) {
        renderMessage("Laporan tidak ditemukan.");
        return;
      }
      renderDetail(l);
    } catch (e) {
      if (e.code === "NOT_FOUND") {
        renderMessage("Laporan tidak ditemukan.");
      } else {
        content.innerHTML =
          '<div class="state"><div class="notice err">' + Utils.esc(e.message || "Gagal memuat detail.") + "</div>" +
          '<button class="btn btn-outline auto" id="retry">Coba Lagi</button></div>';
        const b = document.getElementById("retry");
        if (b) b.addEventListener("click", load);
      }
    }
  }

  load();
})();
