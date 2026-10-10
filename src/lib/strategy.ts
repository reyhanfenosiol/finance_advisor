// Mesin "strategi Pareto": membaca data keuangan user dan menghasilkan daftar aksi
// berprioritas dengan timeline. Murni perhitungan — tidak ada akses jaringan.

export type StrategyInput = {
  today: Date;
  investments: { id: string; instrument_type: string; instrument_name: string; ownership: string }[];
  investmentTx: { investment_id: string; type: "buy" | "sell"; amount: number; transaction_date: string }[];
  valuations: { investment_id: string; valuation_date: string; current_value: number }[];
  cashTx: { type: "income" | "expense"; category: string; amount: number; transaction_date: string }[];
  hasEducationPlan: boolean;
  hasCryptoPlan: boolean;
  inflationPct: number | null;
};

export type Horizon = "minggu-ini" | "30-hari" | "3-bulan" | "6-12-bulan" | "rutin";

export const HORIZON_LABEL: Record<Horizon, string> = {
  "minggu-ini": "Minggu ini",
  "30-hari": "Dalam 30 hari",
  "3-bulan": "1–3 bulan",
  "6-12-bulan": "6–12 bulan",
  rutin: "Kebiasaan rutin",
};

export type Action = {
  id: string;
  horizon: Horizon;
  impact: 1 | 2 | 3 | 4 | 5;
  title: string;
  why: string;
  steps: string[];
  progress?: { current: number; target: number; label: string };
  link?: { href: string; label: string };
};

export type Holding = {
  id: string;
  name: string;
  type: string;
  ownership: string;
  invested: number;
  value: number;
  valuationDate: string | null;
  txCount: number;
};

export type StrategyResult = {
  holdings: Holding[];
  totalAssets: number;
  investedAssets: number; // di luar tabungan/deposito
  liquid: number;
  avgMonthlyExpense: number | null;
  expenseMonthsUsed: number;
  emergencyMonths: number | null;
  emergencyTarget: number | null;
  allocation: { type: string; value: number; pct: number }[];
  topType: { type: string; pct: number } | null;
  incomeMonthsLast6: number;
  savingsRate: number | null;
  expensePareto: { category: string; amount: number; pct: number; cumPct: number }[];
  actions: Action[];
};

export const TYPE_LABEL: Record<string, string> = {
  saham: "Saham",
  reksadana: "Reksa dana",
  obligasi: "Obligasi/SBN",
  emas: "Emas",
  crypto: "Crypto",
  deposito: "Deposito",
  tabungan: "Tabungan",
  p2p_lending: "P2P lending",
  properti: "Properti",
  lainnya: "Lainnya",
};

const LIQUID_TYPES = new Set(["tabungan", "deposito"]);
const EMERGENCY_MONTHS = 6;
const CONCENTRATION_LIMIT = 50; // % dari aset investasi
const CONCENTRATION_TARGET = 30;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rp(v: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Math.round(v)
  );
}

function roundTo(v: number, step: number) {
  return Math.ceil(v / step) * step;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function buildStrategy(input: StrategyInput): StrategyResult {
  const { today } = input;

  // ---------- Kepemilikan ----------
  const holdings: Holding[] = input.investments.map((inv) => {
    const txs = input.investmentTx.filter((t) => t.investment_id === inv.id);
    const invested = txs.reduce((s, t) => s + (t.type === "buy" ? 1 : -1) * Number(t.amount), 0);
    const latest = input.valuations
      .filter((v) => v.investment_id === inv.id)
      .sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];
    return {
      id: inv.id,
      name: inv.instrument_name,
      type: inv.instrument_type,
      ownership: inv.ownership,
      invested,
      value: latest ? Number(latest.current_value) : Math.max(0, invested),
      valuationDate: latest?.valuation_date ?? null,
      txCount: txs.length,
    };
  });

  const totalAssets = holdings.reduce((s, h) => s + h.value, 0);
  const liquid = holdings.filter((h) => LIQUID_TYPES.has(h.type)).reduce((s, h) => s + h.value, 0);
  const investedAssets = totalAssets - liquid;

  const byType = new Map<string, number>();
  for (const h of holdings) {
    if (LIQUID_TYPES.has(h.type) || h.value <= 0) continue;
    byType.set(h.type, (byType.get(h.type) ?? 0) + h.value);
  }
  const allocation = [...byType.entries()]
    .map(([type, value]) => ({ type, value, pct: investedAssets > 0 ? (value / investedAssets) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
  const topType = allocation[0] ? { type: allocation[0].type, pct: allocation[0].pct } : null;

  // ---------- Cashflow ----------
  const months = new Map<string, { inc: number; exp: number }>();
  for (const t of input.cashTx) {
    const k = t.transaction_date.slice(0, 7);
    const m = months.get(k) ?? { inc: 0, exp: 0 };
    if (t.type === "income") m.inc += Number(t.amount);
    else m.exp += Number(t.amount);
    months.set(k, m);
  }
  const currentKey = monthKey(today);
  const last12: string[] = [];
  const last6: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const k = monthKey(new Date(today.getFullYear(), today.getMonth() - i, 1));
    last12.push(k);
    if (i <= 6) last6.push(k);
  }
  // Rata-rata pengeluaran dari 6 bulan terakhir yang punya data (bukan bulan berjalan). Bulan yang
  // totalnya < 50% bulan tertinggi dianggap pencatatannya bolong dan tidak dipakai.
  const recentExpenseMonths = [...months.entries()]
    .filter(([k, m]) => k !== currentKey && m.exp > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6);
  const maxExpense = Math.max(0, ...recentExpenseMonths.map(([, m]) => m.exp));
  const expenseMonths = recentExpenseMonths.filter(([, m]) => m.exp >= maxExpense * 0.5);
  const avgMonthlyExpense =
    expenseMonths.length > 0 ? expenseMonths.reduce((s, [, m]) => s + m.exp, 0) / expenseMonths.length : null;
  const incomeMonthsLast6 = last6.filter((k) => (months.get(k)?.inc ?? 0) > 0).length;
  const bothMonths = last12.filter((k) => (months.get(k)?.inc ?? 0) > 0 && (months.get(k)?.exp ?? 0) > 0);
  const savingsRate =
    bothMonths.length >= 3
      ? bothMonths.reduce((s, k) => s + (months.get(k)!.inc - months.get(k)!.exp), 0) /
        bothMonths.reduce((s, k) => s + months.get(k)!.inc, 0)
      : null;
  const emptyMonthsLast6 = last6.filter((k) => !months.has(k)).length;

  const emergencyTarget = avgMonthlyExpense != null ? roundTo(avgMonthlyExpense * EMERGENCY_MONTHS, 500_000) : null;
  const emergencyMonths = avgMonthlyExpense ? liquid / avgMonthlyExpense : null;

  // Pareto pengeluaran 3 bulan penuh terakhir yang punya data.
  const recentExpenseKeys = new Set(expenseMonths.slice(0, 3).map(([k]) => k));
  const catTotals = new Map<string, number>();
  for (const t of input.cashTx) {
    if (t.type !== "expense" || !recentExpenseKeys.has(t.transaction_date.slice(0, 7))) continue;
    catTotals.set(t.category, (catTotals.get(t.category) ?? 0) + Number(t.amount));
  }
  const catSum = [...catTotals.values()].reduce((s, v) => s + v, 0);
  let cum = 0;
  const expensePareto = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => {
      cum += amount;
      return { category, amount, pct: (amount / catSum) * 100, cumPct: (cum / catSum) * 100 };
    });

  // ---------- Aksi ----------
  const actions: Action[] = [];

  if (incomeMonthsLast6 < 3) {
    actions.push({
      id: "catat-pemasukan",
      horizon: "minggu-ini",
      impact: 5,
      title: "Catat semua pemasukan (gaji, bonus, sampingan)",
      why: `Dalam 6 bulan terakhir hanya ${incomeMonthsLast6} bulan yang punya catatan pemasukan. Tanpa itu, rasio tabungan — angka paling menentukan kesehatan keuangan — tidak bisa diukur, dan semua target (dana darurat, investasi, pendidikan) hanya tebakan.`,
      steps: [
        "Input gaji bulan ini dan 2 bulan terakhir di menu Input & Tabel Transaksi.",
        "Pasang pengingat di tanggal gajian untuk langsung mencatat pemasukan.",
        "Target: rasio tabungan (pemasukan − pengeluaran) ÷ pemasukan minimal 20%.",
      ],
      link: { href: "/transaksi", label: "Buka Input Transaksi" },
    });
  }

  const staleDays = 45;
  const staleHoldings = holdings.filter(
    (h) => !LIQUID_TYPES.has(h.type) && h.value > 0 && h.valuationDate && daysBetween(today, new Date(h.valuationDate)) > staleDays
  );
  const noValuation = holdings.filter((h) => !h.valuationDate && h.invested > 0);
  const zeroValue = holdings.filter((h) => h.valuationDate && h.value === 0 && h.invested > 0);
  const suspiciousModal = holdings.filter(
    (h) => h.txCount <= 2 && h.invested > 0 && h.value / h.invested > 2 && !LIQUID_TYPES.has(h.type)
  );
  const emptyHoldings = holdings.filter((h) => h.txCount === 0 && !h.valuationDate);
  if (staleHoldings.length + noValuation.length + zeroValue.length + suspiciousModal.length > 0) {
    const steps: string[] = [];
    if (zeroValue.length)
      steps.push(
        `${zeroValue.map((h) => h.name).join(", ")}: nilai tercatat Rp0 padahal modal ${rp(
          zeroValue.reduce((s, h) => s + h.invested, 0)
        )}. Bila sudah dijual, catat transaksi jual agar untung/rugi benar; bila masih ada, isi valuasi terbaru.`
      );
    if (suspiciousModal.length)
      steps.push(
        `${suspiciousModal.map((h) => h.name).join(", ")}: nilai lebih dari 2× modal dengan hanya 1–2 transaksi beli — kemungkinan ada pembelian/cicilan yang belum dicatat, sehingga return terlihat terlalu besar.`
      );
    if (noValuation.length) steps.push(`Isi valuasi pertama untuk: ${noValuation.map((h) => h.name).join(", ")}.`);
    if (staleHoldings.length)
      steps.push(
        `Perbarui valuasi ${staleHoldings.length} instrumen (paling lama diperbarui ${
          staleHoldings.map((h) => h.valuationDate!).sort()[0]
        }). Cukup sebulan sekali, misalnya tiap tanggal gajian.`
      );
    if (emptyHoldings.length)
      steps.push(`Hapus atau isi instrumen kosong: ${emptyHoldings.map((h) => h.name).join(", ")}.`);
    actions.push({
      id: "rapikan-data",
      horizon: "minggu-ini",
      impact: 4,
      title: "Rapikan data investasi supaya angkanya bisa dipercaya",
      why: "Dashboard, rekomendasi, dan AI advisor membaca data ini. Modal yang tidak lengkap membuat return terlihat jauh lebih besar dari sebenarnya, sehingga keputusan bisa keliru.",
      steps,
      link: { href: "/investasi", label: "Buka Input & Tabel Investasi" },
    });
  }

  if (emergencyTarget != null && emergencyMonths != null && emergencyMonths < EMERGENCY_MONTHS) {
    const gap = emergencyTarget - liquid;
    const steps = [
      `Target dana darurat: ${EMERGENCY_MONTHS}× pengeluaran rata-rata (${rp(avgMonthlyExpense!)}) = ${rp(
        emergencyTarget
      )}. Kurang ${rp(gap)}.`,
      "Simpan di 1 rekening terpisah + reksa dana pasar uang (bisa dicairkan 1–2 hari kerja), bukan di emas atau saham.",
      `Isi bertahap ±${rp(roundTo(gap / 6, 100_000))}/bulan selama 6 bulan, dari setoran yang selama ini masuk ke instrumen lain.`,
    ];
    if (topType && topType.type === "emas" && topType.pct > CONCENTRATION_LIMIT) {
      steps.push(
        `Jalan pintas yang sekaligus mengurangi konsentrasi emas: jual sebagian emas digital (selisih jual-beli lebih kecil dari emas fisik) senilai ±${rp(
          roundTo(gap, 500_000)
        )} lalu pindahkan ke dana darurat.`
      );
    }
    actions.push({
      id: "dana-darurat",
      horizon: "30-hari",
      impact: 5,
      title: "Lengkapi dana darurat 6 bulan pengeluaran",
      why: `Dana likuid (tabungan/deposito) sekarang ${rp(liquid)} ≈ ${emergencyMonths.toFixed(
        1
      )} bulan pengeluaran. Tanpa bantalan ini, satu kejadian mendadak (sakit, kehilangan pekerjaan) memaksa menjual investasi di harga buruk atau berutang.`,
      steps,
      progress: { current: liquid, target: emergencyTarget, label: "Dana darurat" },
    });
  }

  const smallAccounts = holdings.filter((h) => h.type === "tabungan" && h.value < 1_000_000);
  if (smallAccounts.length >= 3) {
    actions.push({
      id: "konsolidasi-rekening",
      horizon: "30-hari",
      impact: 2,
      title: `Sederhanakan ${holdings.filter((h) => h.type === "tabungan").length} rekening tabungan menjadi 3`,
      why: `${smallAccounts.length} rekening saldonya di bawah Rp1 juta (${smallAccounts
        .map((h) => h.name)
        .join(", ")}). Terlalu banyak rekening menyulitkan kontrol dan sering kena biaya admin.`,
      steps: [
        "Rekening 1 — operasional: gaji masuk, bayar tagihan & kebutuhan bulanan.",
        "Rekening 2 — dana darurat: tidak punya kartu debit / tidak dipakai belanja.",
        "Rekening 3 — tujuan (pendidikan, liburan, dll.).",
        "Kosongkan & tutup sisanya, atau biarkan tanpa saldo bila gratis biaya admin.",
      ],
    });
  }

  if (topType && topType.pct > CONCENTRATION_LIMIT) {
    const topValue = allocation[0].value;
    const newMoneyNeeded = topValue / (CONCENTRATION_TARGET / 100) - investedAssets;
    actions.push({
      id: "kurangi-konsentrasi",
      horizon: "3-bulan",
      impact: 4,
      title: `Kurangi ketergantungan pada ${TYPE_LABEL[topType.type] ?? topType.type} (${topType.pct.toFixed(0)}% dari investasi)`,
      why: `${TYPE_LABEL[topType.type] ?? topType.type} senilai ${rp(topValue)} mendominasi portofolio. Bila harganya turun 20%, total aset Anda ikut turun ±${rp(
        topValue * 0.2
      )}. Emas bagus sebagai pelindung nilai, tapi tidak menghasilkan dividen/kupon dan selisih jual-belinya besar.`,
      steps: [
        `Hentikan dulu pembelian ${TYPE_LABEL[topType.type]?.toLowerCase() ?? topType.type} baru (kecuali cicilan yang sudah berjalan).`,
        "Arahkan setoran investasi baru ke reksa dana indeks saham dan reksa dana pendapatan tetap/SBN.",
        `Target porsi ${TYPE_LABEL[topType.type]?.toLowerCase() ?? topType.type} ±${CONCENTRATION_TARGET}%. Lewat setoran baru saja dibutuhkan ±${rp(
          Math.max(0, newMoneyNeeded)
        )} — jadi kombinasikan dengan memindahkan sebagian secara bertahap saat harganya sedang tinggi.`,
        "Jangan jual emas fisik untuk dipindahkan; mulai dari emas digital agar biaya pindahnya kecil.",
      ],
    });
  }

  actions.push({
    id: "proteksi",
    horizon: "30-hari",
    impact: 4,
    title: "Pastikan proteksi dasar sebelum menambah investasi",
    why: holdings.some((h) => h.ownership === "keluarga")
      ? "Anda punya aset keluarga dan rencana untuk anak. Satu risiko besar tanpa proteksi bisa menghapus hasil investasi bertahun-tahun."
      : "Satu risiko besar tanpa proteksi bisa menghapus hasil investasi bertahun-tahun.",
    steps: [
      "Cek BPJS Kesehatan aktif untuk semua anggota keluarga (iuran tidak menunggak).",
      "Bila ada yang bergantung pada penghasilan Anda: asuransi jiwa berjangka (term life), uang pertanggungan ±10× pengeluaran tahunan. Hindari unit link.",
      "Simpan daftar rekening, investasi, dan polis di satu dokumen yang diketahui pasangan/keluarga.",
    ],
  });

  actions.push({
    id: "otomatisasi",
    horizon: "30-hari",
    impact: 4,
    title: "Otomatiskan: sisihkan di awal, bukan dari sisa",
    why: "Investasi yang dilakukan manual mudah terlewat — terlihat dari data yang bolong beberapa bulan. Autodebit di tanggal gajian memastikan rencana berjalan tanpa perlu disiplin setiap bulan.",
    steps: [
      "Tanggal gajian → autodebit ke rekening dana darurat (sampai target tercapai).",
      "Setelah dana darurat penuh, alihkan autodebit itu ke reksa dana indeks + pendapatan tetap (fitur autodebit di Bibit/IPOT).",
      "Patokan awal: 50% kebutuhan, 30% keinginan, minimal 20% tabungan & investasi.",
    ],
  });

  if (expensePareto.length >= 3 && avgMonthlyExpense) {
    const top = expensePareto.filter((c, i) => i < 3 || c.cumPct - c.pct < 80).slice(0, 5);
    const topShare = top[top.length - 1].cumPct;
    const flexible = top.filter((c) => !/kost|sewa|cicilan|listrik|wifi|internet|pdam|air/i.test(c.category));
    const saving = flexible.reduce((s, c) => s + c.amount, 0) / Math.max(1, recentExpenseKeys.size) * 0.15;
    actions.push({
      id: "pareto-pengeluaran",
      horizon: "3-bulan",
      impact: 3,
      title: `Fokus hemat di ${top.length} kategori yang menyerap ${topShare.toFixed(0)}% pengeluaran`,
      why: `Pengeluaran rata-rata ${rp(avgMonthlyExpense)}/bulan. Kategori terbesar: ${top
        .map((c) => `${c.category} (${c.pct.toFixed(0)}%)`)
        .join(", ")}. Memangkas kategori kecil tidak berdampak; fokus ke yang besar.`,
      steps: [
        ...(flexible.length
          ? [
              `Kurangi 15% dari ${flexible.map((c) => c.category).join(", ")} → hemat ±${rp(
                roundTo(saving, 10_000)
              )}/bulan, langsung pindahkan ke dana darurat.`,
            ]
          : []),
        "Biaya tetap (kost, wifi, listrik): bandingkan harga sekali setahun, misalnya paket wifi atau kost yang lebih dekat kantor (hemat bensin juga).",
        "Pasang batas belanja per minggu untuk makan & belanja harian.",
      ],
      link: { href: "/dashboard/cashflow", label: "Lihat Dashboard Cashflow" },
    });
  }

  if (emptyMonthsLast6 >= 2) {
    actions.push({
      id: "konsisten-catat",
      horizon: "rutin",
      impact: 3,
      title: "Catat pengeluaran setiap hari (cukup 2 menit)",
      why: `${emptyMonthsLast6} dari 6 bulan terakhir tidak ada catatan sama sekali. Pengeluaran yang tidak tercatat adalah pengeluaran yang tidak bisa dikendalikan.`,
      steps: [
        "Catat sebelum tidur, atau langsung setelah bayar.",
        "Akhir bulan: bandingkan total dengan mutasi rekening untuk menangkap yang terlewat.",
      ],
      link: { href: "/transaksi", label: "Buka Input Transaksi" },
    });
  }

  if (!input.hasEducationPlan) {
    actions.push({
      id: "rencana-pendidikan",
      horizon: "3-bulan",
      impact: 3,
      title: "Tetapkan rencana dana pendidikan anak",
      why: "Biaya pendidikan naik ±10%/tahun. Semakin lama ditunda, semakin besar setoran bulanannya — menunda 3 tahun bisa menaikkan setoran 40–60%.",
      steps: [
        "Isi tanggal lahir anak dan jenis sekolah incaran di halaman Dana Pendidikan Anak.",
        "Mulai dengan setoran untuk jenjang terdekat (TK/SD) di reksa dana pasar uang/SBN.",
        "Gunakan rekening/akun terpisah khusus pendidikan.",
      ],
      link: { href: "/investasi/pendidikan-anak", label: "Buka Dana Pendidikan Anak" },
    });
  }

  actions.push({
    id: "crypto-terakhir",
    horizon: "6-12-bulan",
    impact: 2,
    title: "Crypto dan aset spekulatif paling akhir, maksimal 5–10%",
    why: "Crypto hanya masuk akal setelah dana darurat penuh, proteksi ada, dan investasi inti berjalan rutin. Sebelum itu, risikonya lebih besar dari manfaatnya.",
    steps: [
      "Mulai DCA crypto (mis. Rp500 ribu/bulan) hanya setelah langkah-langkah di atas selesai.",
      "Batasi total crypto maksimal 5–10% dari aset investasi.",
    ],
    link: { href: "/investasi/crypto-plan", label: "Buka Rencana Crypto" },
  });

  actions.push({
    id: "review-rutin",
    horizon: "rutin",
    impact: 3,
    title: "Ritual keuangan: 15 menit sebulan, 1 jam setahun",
    why: "Rencana yang tidak ditinjau akan melenceng diam-diam.",
    steps: [
      "Bulanan (tanggal gajian): catat pemasukan, perbarui valuasi investasi, cek halaman ini.",
      "Per 3 bulan: cek porsi aset, apakah sudah mendekati target.",
      "Tahunan: rebalancing, naikkan setoran ±10% mengikuti kenaikan gaji, perbarui rencana pendidikan.",
    ],
  });

  // Prioritas: dampak terbesar dulu, lalu yang paling cepat dikerjakan.
  const horizonOrder: Horizon[] = ["minggu-ini", "30-hari", "3-bulan", "6-12-bulan", "rutin"];
  actions.sort((a, b) => b.impact - a.impact || horizonOrder.indexOf(a.horizon) - horizonOrder.indexOf(b.horizon));

  return {
    holdings,
    totalAssets,
    investedAssets,
    liquid,
    avgMonthlyExpense,
    expenseMonthsUsed: expenseMonths.length,
    emergencyMonths,
    emergencyTarget,
    allocation,
    topType,
    incomeMonthsLast6,
    savingsRate,
    expensePareto,
    actions,
  };
}
