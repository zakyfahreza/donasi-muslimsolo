/* Admin Console — verifikasi donasi, kelola program, kelola akun admin. */
(function () {
  Utils.setHeader("#header", '<a class="header-link" href="index.html">Lihat Situs</a>');

  const SESSION_KEY = "ms_admin_session";
  const $ = function (id) { return document.getElementById(id); };

  const loginView = $("login-view");
  const appView = $("app-view");
  const bottomNav = $("bottom-nav");
  const loginErr = $("login-err");

  function getSession() { return sessionStorage.getItem(SESSION_KEY); }
  function setSession(t) { sessionStorage.setItem(SESSION_KEY, t); }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

  function showLogin() {
    appView.classList.add("hidden");
    bottomNav.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
  function showApp() {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    bottomNav.classList.remove("hidden");
  }
  function onAuthError(e) {
    if (e && e.code === "AUTH") { clearSession(); showLogin(); return true; }
    return false;
  }

  /* ============================ Login ============================ */
  $("login-btn").addEventListener("click", doLogin);
  $("password").addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });

  async function doLogin() {
    const username = $("username").value.trim();
    const password = $("password").value;
    loginErr.classList.add("hidden");
    if (!username || !password) {
      loginErr.textContent = "Username dan password wajib diisi.";
      loginErr.classList.remove("hidden");
      return;
    }
    const btn = $("login-btn");
    btn.disabled = true; btn.textContent = "Memproses...";
    try {
      const res = await API.login(username, password);
      setSession(res.session);
      $("password").value = "";
      showApp();
      switchTab("verify");
    } catch (e) {
      loginErr.textContent = e.message || "Login gagal.";
      loginErr.classList.remove("hidden");
    } finally {
      btn.disabled = false; btn.textContent = "Masuk";
    }
  }

  /* ========================= Tab navigation ========================= */
  const tabs = { verify: $("tab-verify"), program: $("tab-program"), lpj: $("tab-lpj"), account: $("tab-account") };
  const loaders = { verify: loadDashboard, program: loadCampaigns, lpj: loadLpj, account: loadAdmins };

  function switchTab(name) {
    Object.keys(tabs).forEach(function (k) { tabs[k].classList.toggle("hidden", k !== name); });
    bottomNav.querySelectorAll(".nav-item[data-tab]").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    window.scrollTo(0, 0);
    if (loaders[name]) loaders[name]();
  }

  bottomNav.querySelectorAll(".nav-item[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); });
  });
  $("nav-logout").addEventListener("click", function () { clearSession(); showLogin(); });
  $("refresh-btn").addEventListener("click", loadDashboard);
  $("add-campaign").addEventListener("click", function () { openCampaignForm(null); });
  $("add-lpj").addEventListener("click", function () { openLpjForm(null); });
  $("add-admin").addEventListener("click", function () { openAdminForm(null); });

  /* ============================ Modal ============================ */
  const modal = $("modal");
  const modalTitle = $("modal-title");
  const modalBody = $("modal-body");

  function openModal(title, bodyHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modal.classList.remove("hidden");
  }
  function closeModal() { modal.classList.add("hidden"); modalBody.innerHTML = ""; }
  $("modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

  /* ======================= Tab: Verifikasi ======================= */
  const statIcons = {
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
  };
  function statCard(label, value, cls, icon) {
    return '<div class="stat' + (cls ? " " + cls : "") + '">' +
      '<div class="stat-ico">' + (statIcons[icon] || "") + "</div>" +
      '<div class="stat-text"><div class="label">' + label + '</div><div class="value">' + value + "</div></div></div>";
  }
  function renderStats(s) {
    $("stats").innerHTML =
      statCard("Total Terverifikasi", Utils.rupiah(s.verifiedAmount || 0), "accent", "money") +
      statCard("Campaign Aktif", s.activeCampaigns || 0, "info", "folder") +
      statCard("Donasi Pending", s.pendingCount || 0, "warn", "clock") +
      statCard("Donasi Terverifikasi", s.verifiedCount || 0, "ok", "check");
  }

  function donationRow(d) {
    const proof = d.proof_image
      ? '<a href="' + Utils.esc(Utils.driveImage(d.proof_image)) + '" target="_blank" rel="noopener"><img class="don-proof" src="' + Utils.esc(Utils.driveImage(d.proof_image)) + '" alt="Bukti pembayaran" /></a>'
      : '<div class="notice info">Tidak ada bukti.</div>';
    return (
      '<div class="don-row" data-id="' + Utils.esc(d.id) + '">' +
      '<div class="don-head"><div><div class="don-name">' + Utils.esc(d.name) + "</div>" +
      '<div class="don-meta">' + Utils.esc(d.payment_method) + " &#183; " + Utils.formatDate(d.created_at) +
      (d.campaign_title ? " &#183; " + Utils.esc(d.campaign_title) : "") + "</div></div>" +
      '<div class="don-amount">' + Utils.rupiah(d.amount) + "</div></div>" +
      (d.note ? '<div class="don-meta mt-12">Catatan: ' + Utils.esc(d.note) + "</div>" : "") +
      proof +
      '<div class="btn-row"><button class="btn btn-primary act-verify">Terima Donasi</button>' +
      '<button class="btn btn-danger act-reject">Tolak Donasi</button></div></div>'
    );
  }

  async function act(row, id, type) {
    const buttons = row.querySelectorAll("button");
    buttons.forEach(function (b) { b.disabled = true; });
    try {
      if (type === "verify") await API.verifyDonation(getSession(), id);
      else await API.rejectDonation(getSession(), id);
      row.style.transition = "opacity .2s"; row.style.opacity = "0";
      setTimeout(loadDashboard, 200);
    } catch (e) {
      if (onAuthError(e)) return;
      alert(e.message || "Aksi gagal.");
      buttons.forEach(function (b) { b.disabled = false; });
    }
  }

  async function loadDashboard() {
    if (!getSession()) { showLogin(); return; }
    $("stats").innerHTML = "";
    $("pending-list").innerHTML = '<div class="state"><div class="spinner"></div>Memuat data...</div>';
    try {
      const data = await API.getAdminData(getSession());
      renderStats(data.stats || {});
      const pending = data.pending || [];
      const list = $("pending-list");
      if (pending.length === 0) {
        list.innerHTML = '<div class="state">Tidak ada donasi yang menunggu verifikasi.</div>';
      } else {
        list.innerHTML = pending.map(donationRow).join("");
        list.querySelectorAll(".don-row").forEach(function (row) {
          const id = row.getAttribute("data-id");
          row.querySelector(".act-verify").addEventListener("click", function () { act(row, id, "verify"); });
          row.querySelector(".act-reject").addEventListener("click", function () { act(row, id, "reject"); });
        });
      }
    } catch (e) {
      if (onAuthError(e)) return;
      $("pending-list").innerHTML =
        '<div class="state"><div class="notice err">' + Utils.esc(e.message || "Gagal memuat data.") + "</div>" +
        '<button class="btn btn-outline auto" id="retry">Coba Lagi</button></div>';
      const b = $("retry"); if (b) b.addEventListener("click", loadDashboard);
    }
  }

  /* ===================== Tab: Program Donasi ===================== */
  const editIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const trashIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>';

  function campaignListRow(c) {
    const collected = Number(c.current_amount) || 0;
    const target = Number(c.target_amount) || 0;
    const thumb = c.image
      ? '<img class="lr-thumb" src="' + Utils.esc(Utils.driveImage(c.image)) + '" alt="" />'
      : '<div class="lr-thumb"></div>';
    return (
      '<div class="list-row" data-id="' + Utils.esc(c.id) + '">' +
      thumb +
      '<div class="lr-main">' +
      '<p class="lr-title">' + Utils.esc(c.title) + "</p>" +
      '<div class="lr-sub">' + Utils.campaignBadge(c.status) + " &nbsp; " +
      Utils.rupiah(collected) + " / " + Utils.rupiah(target) + "</div></div>" +
      '<div class="lr-actions">' +
      '<button class="icon-btn act-edit" title="Edit">' + editIcon + "</button>" +
      '<button class="icon-btn danger act-del" title="Hapus">' + trashIcon + "</button>" +
      "</div></div>"
    );
  }

  async function loadCampaigns() {
    if (!getSession()) { showLogin(); return; }
    const list = $("campaign-list");
    list.innerHTML = '<div class="state"><div class="spinner"></div>Memuat program...</div>';
    try {
      const campaigns = await API.listCampaignsAdmin(getSession());
      if (!campaigns || campaigns.length === 0) {
        list.innerHTML = '<div class="state">Belum ada program. Klik "+ Tambah" untuk membuat.</div>';
        return;
      }
      list.innerHTML = campaigns.map(campaignListRow).join("");
      list.querySelectorAll(".list-row").forEach(function (row) {
        const id = row.getAttribute("data-id");
        const c = campaigns.filter(function (x) { return String(x.id) === String(id); })[0];
        row.querySelector(".act-edit").addEventListener("click", function () { openCampaignForm(c); });
        row.querySelector(".act-del").addEventListener("click", function () { confirmDeleteCampaign(c); });
      });
    } catch (e) {
      if (onAuthError(e)) return;
      list.innerHTML = '<div class="state"><div class="notice err">' + Utils.esc(e.message || "Gagal memuat program.") + "</div></div>";
    }
  }

  function openCampaignForm(c) {
    const isEdit = !!c;
    c = c || {};
    const v = function (x) { return x == null ? "" : Utils.esc(x); };
    const hasDeadline = !!(c.deadline && String(c.deadline).trim());
    const hasImage = !!(c.image && String(c.image).trim());
    openModal(isEdit ? "Edit Program" : "Tambah Program",
      '<div class="notice err hidden" id="cf-err"></div>' +
      '<div class="field"><label>Judul Program</label><input id="cf-title" class="input" value="' + v(c.title) + '" /></div>' +
      '<div class="field"><label>Deskripsi Kebutuhan</label><textarea id="cf-desc" class="textarea">' + v(c.description) + '</textarea></div>' +
      '<div class="field"><label>Target Dana</label><div class="input-prefix"><span>Rp</span><input id="cf-target" type="text" inputmode="numeric" value="' + (c.target_amount ? Number(c.target_amount).toLocaleString("id-ID") : "") + '" /></div></div>' +
      '<div class="field"><label>Deadline</label>' +
        '<label class="check-row"><input id="cf-no-deadline" type="checkbox"' + (hasDeadline ? "" : " checked") + ' /> <span>Tanpa deadline (jangka waktu tidak terbatas)</span></label>' +
        '<input id="cf-deadline" class="input mt-12" type="date" value="' + v(toDateInput(c.deadline)) + '"' + (hasDeadline ? "" : " disabled") + ' /></div>' +
      '<div class="field"><label>Status</label><select id="cf-status" class="select">' +
        opt("ACTIVE", "Aktif", c.status) + opt("COMPLETED", "Selesai", c.status) + opt("CLOSED", "Ditutup", c.status) +
      '</select></div>' +
      '<div class="field"><label>Gambar Banner</label>' +
        '<div class="banner-preview' + (hasImage ? "" : " hidden") + '" id="cf-image-preview-wrap"><img id="cf-image-preview" src="' + (hasImage ? Utils.esc(Utils.driveImage(c.image)) : "") + '" alt="Pratinjau banner" /></div>' +
        '<input id="cf-image-file" class="input" type="file" accept="image/jpeg,image/png,image/webp" />' +
        '<small class="hint">Rekomendasi rasio 16:9 (landscape), mis. 1920 × 1080 px. Maks. ' + (cfgBanner().max) + ' MB.</small></div>' +
      '<div class="field"><label>Informasi Penggunaan Dana (opsional)</label><textarea id="cf-usage" class="textarea">' + v(c.fund_usage) + '</textarea></div>' +
      '<button class="btn btn-primary" id="cf-save">' + (isEdit ? "Simpan Perubahan" : "Tambah Program") + "</button>"
    );

    // Toggle date input berdasarkan checkbox "tanpa deadline".
    const noDeadline = $("cf-no-deadline");
    const deadlineInput = $("cf-deadline");
    noDeadline.addEventListener("change", function () {
      deadlineInput.disabled = noDeadline.checked;
      if (noDeadline.checked) deadlineInput.value = "";
    });

    // Pratinjau gambar banner yang dipilih.
    const imageFile = $("cf-image-file");
    imageFile.addEventListener("change", function () {
      const f = imageFile.files[0];
      const wrap = $("cf-image-preview-wrap");
      const img = $("cf-image-preview");
      if (f) {
        img.src = URL.createObjectURL(f);
        wrap.classList.remove("hidden");
      }
    });

    $("cf-save").addEventListener("click", async function () {
      const err = $("cf-err");
      err.classList.add("hidden");
      const payload = {
        id: c.id,
        title: $("cf-title").value.trim(),
        description: $("cf-desc").value.trim(),
        target_amount: Utils.parseAmount($("cf-target").value),
        deadline: noDeadline.checked ? "" : deadlineInput.value,
        status: $("cf-status").value,
        image: hasImage ? String(c.image).trim() : "",
        fund_usage: $("cf-usage").value.trim(),
      };
      if (!payload.title) { err.textContent = "Judul wajib diisi."; err.classList.remove("hidden"); return; }
      if (!(payload.target_amount >= 1)) { err.textContent = "Target dana minimal Rp1."; err.classList.remove("hidden"); return; }

      // Validasi & lampirkan gambar banner baru bila ada.
      const file = imageFile.files[0];
      if (file) {
        const banner = cfgBanner();
        if (banner.types.indexOf(file.type) === -1) {
          err.textContent = "Gambar banner harus JPG, PNG, atau WEBP."; err.classList.remove("hidden"); return;
        }
        if (file.size > banner.max * 1024 * 1024) {
          err.textContent = "Ukuran gambar banner maksimal " + banner.max + " MB."; err.classList.remove("hidden"); return;
        }
      }

      const btn = $("cf-save"); btn.disabled = true; btn.textContent = "Menyimpan...";
      try {
        if (file) {
          payload.image_base64 = await Utils.fileToBase64(file);
          payload.image_mime = file.type;
          payload.image_filename = file.name;
        }
        if (isEdit) await API.updateCampaign(getSession(), payload);
        else await API.addCampaign(getSession(), payload);
        closeModal();
        loadCampaigns();
      } catch (ex) {
        if (onAuthError(ex)) return;
        err.textContent = ex.message || "Gagal menyimpan."; err.classList.remove("hidden");
        btn.disabled = false; btn.textContent = isEdit ? "Simpan Perubahan" : "Tambah Program";
      }
    });
  }

  function confirmDeleteCampaign(c) {
    openModal("Hapus Program",
      '<p>Yakin ingin menghapus program <b>' + Utils.esc(c.title) + "</b>? Tindakan ini tidak dapat dibatalkan.</p>" +
      '<div class="notice err hidden" id="dc-err"></div>' +
      '<div class="btn-row mt-12"><button class="btn btn-ghost" id="dc-cancel">Batal</button>' +
      '<button class="btn btn-danger" id="dc-ok">Hapus</button></div>'
    );
    $("dc-cancel").addEventListener("click", closeModal);
    $("dc-ok").addEventListener("click", async function () {
      const btn = $("dc-ok"); btn.disabled = true; btn.textContent = "Menghapus...";
      try {
        await API.deleteCampaign(getSession(), c.id);
        closeModal();
        loadCampaigns();
      } catch (ex) {
        if (onAuthError(ex)) return;
        const err = $("dc-err"); err.textContent = ex.message || "Gagal menghapus."; err.classList.remove("hidden");
        btn.disabled = false; btn.textContent = "Hapus";
      }
    });
  }

  /* ====================== Tab: LPJ Pengadaan ====================== */
  function lpjListRow(l) {
    const amount = Number(l.amount) || 0;
    const thumb = l.image
      ? '<img class="lr-thumb" src="' + Utils.esc(Utils.driveImage(l.image)) + '" alt="" />'
      : '<div class="lr-thumb"></div>';
    return (
      '<div class="list-row" data-id="' + Utils.esc(l.id) + '">' +
      thumb +
      '<div class="lr-main">' +
      '<p class="lr-title">' + Utils.esc(l.title) + "</p>" +
      '<div class="lr-sub">' + Utils.formatDate(l.date) + " &nbsp; " + Utils.rupiah(amount) + "</div></div>" +
      '<div class="lr-actions">' +
      '<button class="icon-btn act-edit" title="Edit">' + editIcon + "</button>" +
      '<button class="icon-btn danger act-del" title="Hapus">' + trashIcon + "</button>" +
      "</div></div>"
    );
  }

  async function loadLpj() {
    if (!getSession()) { showLogin(); return; }
    const list = $("lpj-list");
    list.innerHTML = '<div class="state"><div class="spinner"></div>Memuat laporan...</div>';
    try {
      const items = await API.listLpjAdmin(getSession());
      if (!items || items.length === 0) {
        list.innerHTML = '<div class="state">Belum ada LPJ. Klik "+ Tambah" untuk membuat.</div>';
        return;
      }
      list.innerHTML = items.map(lpjListRow).join("");
      list.querySelectorAll(".list-row").forEach(function (row) {
        const id = row.getAttribute("data-id");
        const l = items.filter(function (x) { return String(x.id) === String(id); })[0];
        row.querySelector(".act-edit").addEventListener("click", function () { openLpjForm(l); });
        row.querySelector(".act-del").addEventListener("click", function () { confirmDeleteLpj(l); });
      });
    } catch (e) {
      if (onAuthError(e)) return;
      list.innerHTML = '<div class="state"><div class="notice err">' + Utils.esc(e.message || "Gagal memuat laporan.") + "</div></div>";
    }
  }

  async function openLpjForm(l) {
    const isEdit = !!l;
    l = l || {};

    // Ambil daftar program untuk opsi keterkaitan (opsional, jangan gagalkan form).
    let campaigns = [];
    try { campaigns = await API.listCampaignsAdmin(getSession()) || []; }
    catch (e) { if (onAuthError(e)) return; }

    const v = function (x) { return x == null ? "" : Utils.esc(x); };
    const hasImage = !!(l.image && String(l.image).trim());
    const campaignOptions = '<option value="">— Tidak terkait program —</option>' +
      campaigns.map(function (c) {
        return '<option value="' + Utils.esc(c.id) + '"' +
          (String(l.campaign_id) === String(c.id) ? " selected" : "") + ">" + Utils.esc(c.title) + "</option>";
      }).join("");

    openModal(isEdit ? "Edit LPJ Pengadaan" : "Tambah LPJ Pengadaan",
      '<div class="notice err hidden" id="lf-err"></div>' +
      '<div class="field"><label>Judul Pengadaan</label><input id="lf-title" class="input" value="' + v(l.title) + '" /></div>' +
      '<div class="field"><label>Program Terkait (opsional)</label><select id="lf-campaign" class="select">' + campaignOptions + '</select></div>' +
      '<div class="field"><label>Tanggal Pengadaan</label><input id="lf-date" class="input" type="date" value="' + v(toDateInput(l.date)) + '" /></div>' +
      '<div class="field"><label>Nominal Dana Terpakai</label><div class="input-prefix"><span>Rp</span><input id="lf-amount" type="text" inputmode="numeric" value="' + (l.amount ? Number(l.amount).toLocaleString("id-ID") : "") + '" /></div></div>' +
      '<div class="field"><label>Rincian / Keterangan</label><textarea id="lf-desc" class="textarea">' + v(l.description) + '</textarea></div>' +
      '<div class="field"><label>Bukti / Nota (opsional)</label>' +
        '<div class="banner-preview' + (hasImage ? "" : " hidden") + '" id="lf-image-preview-wrap"><img id="lf-image-preview" src="' + (hasImage ? v(Utils.driveImage(l.image)) : "") + '" alt="Pratinjau bukti" /></div>' +
        '<input id="lf-image-file" class="input" type="file" accept="image/jpeg,image/png,image/webp" />' +
        '<small class="hint">Foto nota/bukti pengadaan. Maks. ' + cfgBanner().max + ' MB.</small></div>' +
      '<button class="btn btn-primary" id="lf-save">' + (isEdit ? "Simpan Perubahan" : "Tambah LPJ") + "</button>"
    );

    const imageFile = $("lf-image-file");
    imageFile.addEventListener("change", function () {
      const f = imageFile.files[0];
      if (f) {
        $("lf-image-preview").src = URL.createObjectURL(f);
        $("lf-image-preview-wrap").classList.remove("hidden");
      }
    });

    $("lf-save").addEventListener("click", async function () {
      const err = $("lf-err");
      err.classList.add("hidden");
      const payload = {
        id: l.id,
        title: $("lf-title").value.trim(),
        campaign_id: $("lf-campaign").value,
        date: $("lf-date").value,
        amount: Utils.parseAmount($("lf-amount").value),
        description: $("lf-desc").value.trim(),
        image: hasImage ? String(l.image).trim() : "",
      };
      if (!payload.title) { err.textContent = "Judul pengadaan wajib diisi."; err.classList.remove("hidden"); return; }

      const file = imageFile.files[0];
      if (file) {
        const banner = cfgBanner();
        if (banner.types.indexOf(file.type) === -1) {
          err.textContent = "Bukti harus JPG, PNG, atau WEBP."; err.classList.remove("hidden"); return;
        }
        if (file.size > banner.max * 1024 * 1024) {
          err.textContent = "Ukuran bukti maksimal " + banner.max + " MB."; err.classList.remove("hidden"); return;
        }
      }

      const btn = $("lf-save"); btn.disabled = true; btn.textContent = "Menyimpan...";
      try {
        if (file) {
          payload.image_base64 = await Utils.fileToBase64(file);
          payload.image_mime = file.type;
          payload.image_filename = file.name;
        }
        if (isEdit) await API.updateLpj(getSession(), payload);
        else await API.addLpj(getSession(), payload);
        closeModal();
        loadLpj();
      } catch (ex) {
        if (onAuthError(ex)) return;
        err.textContent = ex.message || "Gagal menyimpan."; err.classList.remove("hidden");
        btn.disabled = false; btn.textContent = isEdit ? "Simpan Perubahan" : "Tambah LPJ";
      }
    });
  }

  function confirmDeleteLpj(l) {
    openModal("Hapus LPJ",
      '<p>Yakin ingin menghapus laporan <b>' + Utils.esc(l.title) + "</b>? Tindakan ini tidak dapat dibatalkan.</p>" +
      '<div class="notice err hidden" id="dl-err"></div>' +
      '<div class="btn-row mt-12"><button class="btn btn-ghost" id="dl-cancel">Batal</button>' +
      '<button class="btn btn-danger" id="dl-ok">Hapus</button></div>'
    );
    $("dl-cancel").addEventListener("click", closeModal);
    $("dl-ok").addEventListener("click", async function () {
      const btn = $("dl-ok"); btn.disabled = true; btn.textContent = "Menghapus...";
      try {
        await API.deleteLpj(getSession(), l.id);
        closeModal();
        loadLpj();
      } catch (ex) {
        if (onAuthError(ex)) return;
        const err = $("dl-err"); err.textContent = ex.message || "Gagal menghapus."; err.classList.remove("hidden");
        btn.disabled = false; btn.textContent = "Hapus";
      }
    });
  }

  /* ====================== Tab: Akun Admin ====================== */
  const keyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m10.85 12.15 7.15-7.15M18 5l2 2M15 8l2 2"/></svg>';

  function adminListRow(a) {
    return (
      '<div class="list-row" data-user="' + Utils.esc(a.username) + '">' +
      '<div class="lr-thumb" style="display:grid;place-items:center;color:var(--primary-dark);font-weight:800;font-size:20px">' +
      Utils.esc(String(a.username).charAt(0).toUpperCase()) + "</div>" +
      '<div class="lr-main"><p class="lr-title">' + Utils.esc(a.username) + "</p>" +
      '<div class="lr-sub">Administrator</div></div>' +
      '<div class="lr-actions">' +
      '<button class="icon-btn act-pass" title="Ubah Password">' + keyIcon + "</button>" +
      '<button class="icon-btn danger act-del" title="Hapus">' + trashIcon + "</button>" +
      "</div></div>"
    );
  }

  async function loadAdmins() {
    if (!getSession()) { showLogin(); return; }
    const list = $("admin-list");
    list.innerHTML = '<div class="state"><div class="spinner"></div>Memuat akun...</div>';
    try {
      const admins = await API.listAdmins(getSession());
      list.innerHTML = (admins || []).map(adminListRow).join("") ||
        '<div class="state">Belum ada akun admin.</div>';
      list.querySelectorAll(".list-row").forEach(function (row) {
        const user = row.getAttribute("data-user");
        row.querySelector(".act-pass").addEventListener("click", function () { openAdminForm({ username: user }); });
        row.querySelector(".act-del").addEventListener("click", function () { confirmDeleteAdmin(user, admins.length); });
      });
    } catch (e) {
      if (onAuthError(e)) return;
      list.innerHTML = '<div class="state"><div class="notice err">' + Utils.esc(e.message || "Gagal memuat akun.") + "</div></div>";
    }
  }

  function openAdminForm(a) {
    const isEdit = !!a;
    a = a || {};
    openModal(isEdit ? "Ubah Password" : "Tambah Admin",
      '<div class="notice err hidden" id="af-err"></div>' +
      '<div class="field"><label>Username</label><input id="af-user" class="input" value="' + Utils.esc(a.username || "") + '" ' + (isEdit ? "readonly" : "") + ' /></div>' +
      '<div class="field"><label>' + (isEdit ? "Password Baru" : "Password") + '</label><input id="af-pass" class="input" type="password" autocomplete="new-password" /></div>' +
      '<button class="btn btn-primary" id="af-save">' + (isEdit ? "Simpan Password" : "Tambah Admin") + "</button>"
    );
    $("af-save").addEventListener("click", async function () {
      const err = $("af-err"); err.classList.add("hidden");
      const username = $("af-user").value.trim();
      const password = $("af-pass").value;
      if (!username) { err.textContent = "Username wajib diisi."; err.classList.remove("hidden"); return; }
      if (!password || password.length < 6) { err.textContent = "Password minimal 6 karakter."; err.classList.remove("hidden"); return; }
      const btn = $("af-save"); btn.disabled = true; btn.textContent = "Menyimpan...";
      try {
        if (isEdit) await API.setAdminPassword(getSession(), username, password);
        else await API.addAdmin(getSession(), username, password);
        closeModal();
        loadAdmins();
      } catch (ex) {
        if (onAuthError(ex)) return;
        err.textContent = ex.message || "Gagal menyimpan."; err.classList.remove("hidden");
        btn.disabled = false; btn.textContent = isEdit ? "Simpan Password" : "Tambah Admin";
      }
    });
  }

  function confirmDeleteAdmin(username, total) {
    if (total <= 1) { alert("Tidak dapat menghapus admin terakhir."); return; }
    openModal("Hapus Admin",
      '<p>Hapus akun admin <b>' + Utils.esc(username) + "</b>?</p>" +
      '<div class="notice err hidden" id="da-err"></div>' +
      '<div class="btn-row mt-12"><button class="btn btn-ghost" id="da-cancel">Batal</button>' +
      '<button class="btn btn-danger" id="da-ok">Hapus</button></div>'
    );
    $("da-cancel").addEventListener("click", closeModal);
    $("da-ok").addEventListener("click", async function () {
      const btn = $("da-ok"); btn.disabled = true; btn.textContent = "Menghapus...";
      try {
        await API.deleteAdmin(getSession(), username);
        closeModal();
        loadAdmins();
      } catch (ex) {
        if (onAuthError(ex)) return;
        const err = $("da-err"); err.textContent = ex.message || "Gagal menghapus."; err.classList.remove("hidden");
        btn.disabled = false; btn.textContent = "Hapus";
      }
    });
  }

  /* ============================ Helpers ============================ */
  function cfgBanner() {
    const cfg = window.APP_CONFIG || {};
    return {
      max: cfg.MAX_BANNER_SIZE_MB || 5,
      types: cfg.ALLOWED_BANNER_TYPES || ["image/jpeg", "image/png", "image/webp"],
    };
  }
  function opt(value, label, current) {
    return '<option value="' + value + '"' + (String(current).toUpperCase() === value ? " selected" : "") + ">" + label + "</option>";
  }
  function toDateInput(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d).slice(0, 10);
    return dt.toISOString().slice(0, 10);
  }

  /* ============================== Init ============================== */
  if (getSession()) { showApp(); switchTab("verify"); }
  else { showLogin(); }
})();
