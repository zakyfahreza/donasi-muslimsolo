/* Logika halaman Donasi — Requirement 3, 4, 9, 11. */
(function () {
  Utils.setHeader("#header", "");

  const cfg = window.APP_CONFIG || {};
  const id = Utils.getParam("id");

  const stepPay = document.getElementById("step-pay");
  const stepConfirm = document.getElementById("step-confirm");
  const stepSuccess = document.getElementById("step-success");

  const amount = document.getElementById("amount");
  const amount2 = document.getElementById("amount2");
  const amountErr = document.getElementById("amount-err");
  const amount2Err = document.getElementById("amount2-err");
  const payDetail = document.getElementById("pay-detail");
  const chips = document.getElementById("chips");
  const summary = document.getElementById("campaign-summary");

  let payment = null;
  let currentMethod = "Transfer";

  /* ---------- nominal helpers ---------- */
  function attachAmountMask(input) {
    input.addEventListener("input", function () {
      const val = Utils.parseAmount(input.value);
      input.value = val ? val.toLocaleString("id-ID") : "";
    });
  }
  attachAmountMask(amount);
  attachAmountMask(amount2);

  [50000, 100000, 150000, 250000, 500000].forEach(function (v) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = Utils.rupiah(v);
    b.addEventListener("click", function () {
      amount.value = v.toLocaleString("id-ID");
      amountErr.classList.add("hidden");
      chips.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
      b.classList.add("active");
    });
    chips.appendChild(b);
  });

  amount.addEventListener("input", function () {
    chips.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("active"); });
  });

  /* ---------- payment method selection ---------- */
  document.querySelectorAll('.method').forEach(function (el) {
    el.addEventListener("click", function () {
      document.querySelectorAll(".method").forEach(function (m) { m.classList.remove("selected"); });
      el.classList.add("selected");
      el.querySelector("input").checked = true;
      currentMethod = el.getAttribute("data-method");
      renderPayDetail();
    });
  });

  function renderPayDetail() {
    if (!payment) {
      payDetail.innerHTML = '<div class="state"><div class="spinner"></div>Memuat info pembayaran...</div>';
      return;
    }
    if (currentMethod === "Transfer") {
      payDetail.innerHTML =
        '<div class="pay-block">' +
        '<div class="pay-row"><span>Bank</span><b>' + Utils.esc(payment.bank_name || "-") + "</b></div>" +
        '<div class="pay-row"><span>No. Rekening</span><b id="rek">' + Utils.esc(payment.account_number || "-") + '</b></div>' +
        '<div class="pay-row"><span>Atas Nama</span><b>' + Utils.esc(payment.account_name || "-") + "</b></div>" +
        '<div class="center mt-12"><button class="copy-btn" id="copy-rek">Salin No. Rekening</button></div>' +
        "</div>";
      const copyBtn = document.getElementById("copy-rek");
      if (copyBtn) {
        copyBtn.addEventListener("click", function () {
          navigator.clipboard && navigator.clipboard.writeText(String(payment.account_number || ""));
          copyBtn.textContent = "Tersalin!";
          setTimeout(function () { copyBtn.textContent = "Salin No. Rekening"; }, 1500);
        });
      }
    } else {
      payDetail.innerHTML =
        '<div class="pay-block center">' +
        "<div>Scan QRIS berikut dengan aplikasi pembayaran Anda:</div>" +
        (payment.qris_image
          ? '<img class="qris-img" src="' + Utils.esc(Utils.driveImage(payment.qris_image)) + '" alt="QRIS" />' +
            '<button class="qris-download" id="dl-qris" type="button">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>' +
            'Unduh Gambar QRIS</button>'
          : '<div class="notice info" style="margin-top:10px">Gambar QRIS belum tersedia.</div>') +
        "</div>";
      const dlBtn = document.getElementById("dl-qris");
      if (dlBtn) dlBtn.addEventListener("click", function () { downloadQris(Utils.driveImage(payment.qris_image)); });
    }
  }

  async function downloadQris(url) {
    if (!url) return;
    const filename = "qris-" + (cfg.ORG_NAME || "donasi").replace(/[^a-zA-Z0-9]/g, "") + ".png";
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("fetch gagal");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      triggerDownload(objUrl, filename);
      setTimeout(function () { URL.revokeObjectURL(objUrl); }, 4000);
    } catch (e) {
      // Fallback: buka di tab baru bila tidak bisa di-fetch (mis. batasan CORS).
      window.open(url, "_blank", "noopener");
    }
  }

  function triggerDownload(href, filename) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ---------- navigation ---------- */
  function setStep(n) {
    const steps = document.querySelectorAll("#steps .stp");
    const bars = document.querySelectorAll("#steps .bar");
    steps.forEach(function (s) {
      const step = Number(s.getAttribute("data-step"));
      s.classList.toggle("active", step === n);
      s.classList.toggle("done", step < n);
    });
    bars.forEach(function (b, i) { b.classList.toggle("done", i < n - 1); });
  }

  function show(section, step) {
    [stepPay, stepConfirm, stepSuccess].forEach(function (s) { s.classList.add("hidden"); });
    section.classList.remove("hidden");
    if (step) setStep(step);
    window.scrollTo(0, 0);
  }

  document.getElementById("back").addEventListener("click", function (e) {
    e.preventDefault();
    if (!stepConfirm.classList.contains("hidden")) {
      show(stepPay, 1);
    } else {
      window.location.href = id ? "detail.html?id=" + encodeURIComponent(id) : "index.html";
    }
  });

  document.getElementById("to-confirm").addEventListener("click", function () {
    const val = Utils.parseAmount(amount.value);
    if (!val || val < 1) {
      amountErr.classList.remove("hidden");
      amount.focus();
      return;
    }
    amountErr.classList.add("hidden");
    amount2.value = val.toLocaleString("id-ID");
    document.getElementById("method2").value = currentMethod;
    show(stepConfirm, 2);
  });

  /* ---------- submit ---------- */
  document.getElementById("submit").addEventListener("click", submit);

  function showFieldError(elId, errId, msg) {
    const err = document.getElementById(errId);
    if (msg) { err.textContent = msg; err.classList.remove("hidden"); }
    else { err.classList.add("hidden"); }
  }

  async function submit() {
    const name = document.getElementById("name").value.trim();
    const val = Utils.parseAmount(amount2.value);
    const method = document.getElementById("method2").value;
    const note = document.getElementById("note").value.trim();
    const proofInput = document.getElementById("proof");
    const file = proofInput.files[0];
    const formErr = document.getElementById("form-err");
    formErr.classList.add("hidden");

    let valid = true;
    showFieldError("name", "name-err", name ? "" : "Nama wajib diisi.");
    if (!name) valid = false;
    showFieldError("amount2", "amount2-err", val >= 1 ? "" : "Nominal minimal Rp1.");
    if (val < 1) valid = false;

    if (!file) {
      showFieldError("proof", "proof-err", "Bukti pembayaran wajib diupload.");
      valid = false;
    } else if (cfg.ALLOWED_PROOF_TYPES.indexOf(file.type) === -1) {
      showFieldError("proof", "proof-err", "Format harus JPG atau PNG.");
      valid = false;
    } else if (file.size > cfg.MAX_PROOF_SIZE_MB * 1024 * 1024) {
      showFieldError("proof", "proof-err", "Ukuran maksimal " + cfg.MAX_PROOF_SIZE_MB + " MB.");
      valid = false;
    } else {
      showFieldError("proof", "proof-err", "");
    }

    if (!valid) return;

    const btn = document.getElementById("submit");
    btn.disabled = true;
    btn.textContent = "Mengirim...";

    try {
      const base64 = await Utils.fileToBase64(file);
      await API.submitDonation({
        campaign_id: id,
        name: name,
        amount: val,
        payment_method: method,
        note: note,
        proof_filename: file.name,
        proof_mime: file.type,
        proof_base64: base64,
      });
      show(stepSuccess, 3);
    } catch (e) {
      formErr.textContent = e.message || "Gagal mengirim konfirmasi. Coba lagi.";
      formErr.classList.remove("hidden");
      window.scrollTo(0, 0);
    } finally {
      btn.disabled = false;
      btn.textContent = "Kirim Konfirmasi";
    }
  }

  /* ---------- init ---------- */
  async function init() {
    if (!id) {
      summary.innerHTML = '<div class="notice err">Campaign tidak dipilih. <a href="index.html">Pilih donasi</a>.</div>';
      stepPay.classList.add("hidden");
      return;
    }
    renderPayDetail();
    try {
      const [campaign, pay] = await Promise.all([
        API.getCampaign(id).catch(function () { return null; }),
        API.getPayment(),
      ]);
      payment = pay || {};
      renderPayDetail();
      if (campaign) {
        summary.innerHTML =
          '<div class="notice info">Donasi untuk: <b>' + Utils.esc(campaign.title) + "</b></div>";
        if (String(campaign.status).toUpperCase() !== "ACTIVE") {
          summary.innerHTML =
            '<div class="notice err">Campaign ini sudah tidak menerima donasi.</div>';
          stepPay.classList.add("hidden");
        }
      }
    } catch (e) {
      payDetail.innerHTML = '<div class="notice err">' + Utils.esc(e.message || "Gagal memuat info pembayaran.") + "</div>";
    }
  }

  init();
})();
