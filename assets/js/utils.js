/* Helper umum yang dipakai di seluruh halaman. */
(function () {
  const Utils = {};

  /** Format angka ke Rupiah, mis. 150000 -> "Rp150.000". */
  Utils.rupiah = function (value) {
    const n = Number(value) || 0;
    return "Rp" + n.toLocaleString("id-ID");
  };

  /** Bersihkan input nominal ("Rp 150.000" / "150000") menjadi angka. */
  Utils.parseAmount = function (raw) {
    if (raw == null) return 0;
    const digits = String(raw).replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  };

  /** Persentase progres (0-100, dibulatkan, maksimal 100 untuk bar). */
  Utils.progress = function (collected, target) {
    const t = Number(target) || 0;
    if (t <= 0) return 0;
    return Math.round((Number(collected) || 0) / t * 100);
  };

  /** Ambil parameter query string. */
  Utils.getParam = function (key) {
    return new URLSearchParams(window.location.search).get(key);
  };

  /** Escape teks agar aman dimasukkan ke innerHTML. */
  Utils.esc = function (str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  };

  /** Label badge status campaign. */
  Utils.campaignBadge = function (status) {
    const s = String(status || "").toUpperCase();
    const map = {
      ACTIVE: ["active", "Aktif"],
      COMPLETED: ["completed", "Selesai"],
      CLOSED: ["closed", "Ditutup"],
    };
    const [cls, label] = map[s] || ["closed", s || "-"];
    return '<span class="badge ' + cls + '">' + Utils.esc(label) + "</span>";
  };

  /** Label badge status donasi. */
  Utils.donationBadge = function (status) {
    const s = String(status || "").toUpperCase();
    const map = {
      PENDING: ["pending", "Pending"],
      VERIFIED: ["verified", "Terverifikasi"],
      REJECTED: ["rejected", "Ditolak"],
    };
    const [cls, label] = map[s] || ["pending", s || "-"];
    return '<span class="badge ' + cls + '">' + Utils.esc(label) + "</span>";
  };

  /** Format tanggal ISO/Date ke "23 Jun 2026". */
  Utils.formatDate = function (value) {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  };

  /** Sisa hari menuju deadline. Mengembalikan teks siap tampil. */
  Utils.daysLeft = function (deadline) {
    if (!deadline) return "Tanpa batas";
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return "-";
    d.setHours(23, 59, 59, 999);
    const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return "Berakhir";
    if (diff === 0) return "Hari ini";
    return diff + " hari lagi";
  };

  /** Badge status campaign versi solid (untuk di atas gambar). */
  Utils.campaignBadgeSolid = function (status) {
    const s = String(status || "").toUpperCase();
    const map = { ACTIVE: ["active", "Aktif"], COMPLETED: ["completed", "Selesai"], CLOSED: ["closed", "Ditutup"] };
    const [cls, label] = map[s] || ["closed", s || "-"];
    return '<span class="badge solid ' + cls + '">' + Utils.esc(label) + "</span>";
  };

  /**
   * Konversi URL gambar Google Drive ke bentuk yang bisa di-embed di <img>.
   * Format lama "uc?export=view&id=..." sering diblokir Google sehingga
   * gambar tidak tampil. Kita ubah ke endpoint thumbnail yang andal.
   * URL non-Drive (path lokal, data URL) dikembalikan apa adanya.
   */
  Utils.driveImage = function (url) {
    if (!url) return "";
    const s = String(url);
    if (s.indexOf("drive.google.com") === -1) return s;
    const m = s.match(/[-\w]{25,}/); // ID file Drive biasanya >= 25 karakter
    const id = m ? m[0] : "";
    return id ? "https://lh3.googleusercontent.com/d/" + id + "=w1600" : s;
  };

  /** Baca file menjadi base64 (tanpa prefix data URL). */
  Utils.fileToBase64 = function (file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result);
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /** Render header brand standar. */
  Utils.renderHeader = function (rightHtml) {
    const cfg = window.APP_CONFIG || {};
    return (
      '<header class="app-header"><div class="container">' +
      '<a class="brand" href="index.html">' +
      '<img class="brand-logo" src="assets/img/logo.png" alt="' + Utils.esc(cfg.ORG_NAME || "MuslimSolo.id") + '" />' +
      "</a>" +
      (rightHtml || "") +
      "</div></header>"
    );
  };

  Utils.setHeader = function (selector, rightHtml) {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = Utils.renderHeader(rightHtml);
  };

  window.Utils = Utils;
})();
