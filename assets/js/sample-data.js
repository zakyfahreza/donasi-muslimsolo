/**
 * Data contoh (DEMO) untuk pratinjau tampilan tanpa backend.
 *
 * Mode demo otomatis aktif saat API_URL di config.js masih placeholder
 * ("GANTI_...") ATAU saat membuka halaman dengan ?demo=1.
 * Setelah API_URL diisi dengan URL Apps Script asli, mode demo mati
 * dan data diambil dari Google Spreadsheet.
 */
window.SAMPLE_DATA = {
  campaigns: [
    {
      id: "1",
      title: "Pengadaan Server Hosting Website muslimsolo.id (1 Tahun)",
      slug: "server-hosting-muslimsolo-2026",
      description:
        "Website MuslimSolo.id membutuhkan perpanjangan server hosting agar tetap online " +
        "dan dapat diakses jamaah selama 1 tahun ke depan. Server ini menyimpan seluruh " +
        "konten kajian, jadwal kegiatan, serta layanan donasi.\n\n" +
        "Mari bersama-sama menjaga dakwah digital tetap berjalan. Setiap kontribusi Anda " +
        "insyaAllah menjadi amal jariyah yang terus mengalir.",
      target_amount: 550000,
      current_amount: 150000,
      deadline: "2026-08-31",
      status: "ACTIVE",
      image: "assets/img/campaign-server.svg",
      fund_usage:
        "Rincian kebutuhan:\n" +
        "- Sewa server/hosting 1 tahun: Rp480.000\n" +
        "- Perpanjangan domain muslimsolo.id: Rp50.000\n" +
        "- Sertifikat SSL & biaya administrasi: Rp20.000\n" +
        "Total kebutuhan: Rp550.000",
    },
  ],

  payment: {
    bank_name: "BCA",
    account_number: "1234567890",
    account_name: "Kemuslimahan Masjid Al-Ikhlas",
    qris_image: "assets/img/qris-sample.svg",
  },

  // Akun admin contoh untuk pratinjau tab "Akun" (mode demo).
  admins: [{ username: "admin" }],

  // Donasi contoh untuk pratinjau dashboard admin (login demo: admin / demo).
  donations: [
    {
      id: "DON-DEMO-1",
      campaign_id: "1",
      name: "Ahmad Fauzi",
      amount: 100000,
      payment_method: "Transfer",
      proof_image: "assets/img/bukti-transfer.svg",
      status: "PENDING",
      created_at: new Date().toISOString(),
      note: "Semoga bermanfaat untuk dakwah.",
    },
    {
      id: "DON-DEMO-2",
      campaign_id: "1",
      name: "Siti Aisyah",
      amount: 50000,
      payment_method: "QRIS",
      proof_image: "assets/img/bukti-qris.svg",
      status: "PENDING",
      created_at: new Date().toISOString(),
      note: "",
    },
  ],

  // LPJ Pengadaan contoh (laporan pertanggungjawaban penggunaan dana).
  lpj: [
    {
      id: "1",
      title: "Pembelian Domain & SSL muslimsolo.id",
      campaign_id: "1",
      date: "2026-06-20",
      amount: 70000,
      description:
        "Pembelian perpanjangan domain muslimsolo.id selama 1 tahun beserta sertifikat SSL " +
        "untuk mengamankan akses website. Bukti pembayaran terlampir.",
      image: "assets/img/bukti-transfer.svg",
      created_at: new Date().toISOString(),
    },
    {
      id: "2",
      title: "Perpanjangan Server Hosting (6 Bulan)",
      campaign_id: "1",
      date: "2026-06-24",
      amount: 240000,
      description:
        "Pembayaran perpanjangan layanan server hosting untuk 6 bulan pertama melalui " +
        "penyedia Domainesia. Dana digunakan agar website tetap online dan dapat diakses " +
        "jamaah tanpa gangguan. Nota dan bukti transaksi terlampir sebagai bentuk " +
        "transparansi penggunaan dana donasi.",
      image: "assets/img/campaign-server.svg",
      created_at: new Date().toISOString(),
    },
  ],
};
