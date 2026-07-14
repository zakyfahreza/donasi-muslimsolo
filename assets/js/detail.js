/* Logika halaman Detail Donasi — Requirement 2 & 9. */
(function () {
  Utils.setHeader("#header", '<a class="header-link" href="admin.html">Admin</a>');

  const content = document.getElementById("content");
  const cta = document.getElementById("cta");
  const id = Utils.getParam("id");

  function renderDetail(c) {
    const collected = Number(c.current_amount) || 0;
    const target = Number(c.target_amount) || 0;
    const pct = Utils.progress(collected, target);
    const status = String(c.status || "").toUpperCase();
    const isOpen = status === "ACTIVE";

    const cover = c.image
      ? '<img src="' + Utils.esc(Utils.driveImage(c.image)) + '" alt="' + Utils.esc(c.title) + '" />'
      : '<div class="ph"></div>';

    content.innerHTML =
      '<article class="card">' +
      '<div class="cmp-cover">' + cover +
      '<span class="cmp-status">' + Utils.campaignBadgeSolid(c.status) + "</span></div>" +
      '<div class="card-pad">' +
      '<h1 class="page-title" style="margin:0 0 14px">' + Utils.esc(c.title) + "</h1>" +
      '<div class="progress"><span style="width:' + Math.min(pct, 100) + '%"></span></div>' +
      '<div style="margin:12px 0 16px">' +
      '<div class="collected-label">Terkumpul</div>' +
      '<div class="collected-amt" style="font-size:22px">' + Utils.rupiah(collected) +
      ' <small>dari ' + Utils.rupiah(target) + "</small></div></div>" +
      '<div class="stat-strip">' +
      '<div class="ss"><div class="n">' + pct + '%</div><div class="l">Tercapai</div></div>' +
      '<div class="ss"><div class="n">' + Utils.daysLeft(c.deadline) + '</div><div class="l">Sisa waktu</div></div>' +
      '<div class="ss"><div class="n">' + Utils.formatDate(c.deadline) + '</div><div class="l">Batas akhir</div></div>' +
      "</div></div></article>" +
      '<div class="section-label">Deskripsi Kebutuhan</div>' +
      '<div class="card card-pad"><p class="desc">' + Utils.esc(c.description || "-") + "</p></div>" +
      (c.fund_usage
        ? '<div class="section-label">Informasi Penggunaan Dana</div>' +
          '<div class="card card-pad"><p class="desc">' + Utils.esc(c.fund_usage) + "</p></div>"
        : "") +
      '<div class="cta-spacer"></div>';

    if (isOpen) {
      cta.innerHTML =
        '<div class="sticky-cta"><div class="container">' +
        '<div class="sc-info"><div class="collected-label">Terkumpul ' + pct + '%</div>' +
        '<div class="collected-amt">' + Utils.rupiah(collected) + "</div></div>" +
        '<a class="btn btn-primary" href="donasi.html?id=' + encodeURIComponent(c.id) + '">Donasi Sekarang</a>' +
        "</div></div>";
    } else {
      cta.innerHTML =
        '<div class="sticky-cta"><div class="container">' +
        '<button class="btn btn-ghost" disabled>Donasi ' +
        (status === "COMPLETED" ? "Telah Selesai" : "Ditutup") +
        "</button></div></div>";
    }
  }

  function renderMessage(msg) {
    content.innerHTML = '<div class="state">' + Utils.esc(msg) + '<div class="mt-12"><a class="btn btn-outline auto" href="index.html">Kembali ke Daftar Donasi</a></div></div>';
  }

  async function load() {
    if (!id) {
      renderMessage("Silakan pilih campaign dari halaman daftar donasi terlebih dahulu.");
      return;
    }
    try {
      const c = await API.getCampaign(id, function (fresh) { if (fresh) renderDetail(fresh); });
      if (!c) {
        renderMessage("Campaign tidak ditemukan.");
        return;
      }
      renderDetail(c);
    } catch (e) {
      if (e.code === "NOT_FOUND") {
        renderMessage("Campaign tidak ditemukan.");
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
