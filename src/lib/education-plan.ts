// Perhitungan rencana dana pendidikan anak. Murni perhitungan — dipakai di client component.

export type StageKey = "tk" | "sd" | "smp" | "sma" | "kuliah";
export type Tier = "negeri" | "menengah" | "premium";

export type StageCost = {
  tier: Tier | "custom";
  entry_fee: number; // uang pangkal / uang gedung / IPI
  monthly_fee: number; // SPP per bulan (kuliah: UKT per semester ÷ 6)
  yearly_other: number; // buku, seragam, kegiatan, laptop, dll. per tahun
};

export type ChildInfo = { name: string; birth_date: string };

export type EducationPlanInput = {
  children: ChildInfo[];
  costs: Record<StageKey, StageCost>;
  education_inflation_pct: number;
  fund_full_school: boolean;
  investment_ids: string[];
};

export const STAGES: {
  key: StageKey;
  label: string;
  entryAge: number;
  years: number;
  phase: 1 | 2;
}[] = [
  { key: "tk", label: "TK", entryAge: 5, years: 2, phase: 1 },
  { key: "sd", label: "SD", entryAge: 7, years: 6, phase: 1 },
  { key: "smp", label: "SMP", entryAge: 13, years: 3, phase: 1 },
  { key: "sma", label: "SMA", entryAge: 16, years: 3, phase: 2 },
  { key: "kuliah", label: "Kuliah (S1)", entryAge: 19, years: 4, phase: 2 },
];

export const TIER_LABEL: Record<StageKey, Record<Tier, string>> = {
  tk: { negeri: "Negeri", menengah: "Swasta menengah", premium: "Swasta premium" },
  sd: { negeri: "Negeri", menengah: "Swasta menengah", premium: "Swasta premium" },
  smp: { negeri: "Negeri", menengah: "Swasta menengah", premium: "Swasta premium" },
  sma: { negeri: "Negeri", menengah: "Swasta menengah", premium: "Swasta premium" },
  kuliah: { negeri: "PTN (UKT)", menengah: "PTS menengah", premium: "PTS / kampus favorit" },
};

// Perkiraan biaya hari ini (2026) di kota besar. Sangat bervariasi antar sekolah dan kota —
// pengguna diminta menyesuaikan dengan sekolah incaran.
export const TIER_PRESETS: Record<StageKey, Record<Tier, Omit<StageCost, "tier">>> = {
  tk: {
    negeri: { entry_fee: 1_000_000, monthly_fee: 250_000, yearly_other: 1_500_000 },
    menengah: { entry_fee: 7_500_000, monthly_fee: 900_000, yearly_other: 3_000_000 },
    premium: { entry_fee: 30_000_000, monthly_fee: 3_000_000, yearly_other: 10_000_000 },
  },
  sd: {
    negeri: { entry_fee: 0, monthly_fee: 0, yearly_other: 2_500_000 },
    menengah: { entry_fee: 15_000_000, monthly_fee: 1_200_000, yearly_other: 4_000_000 },
    premium: { entry_fee: 60_000_000, monthly_fee: 4_000_000, yearly_other: 15_000_000 },
  },
  smp: {
    negeri: { entry_fee: 0, monthly_fee: 0, yearly_other: 3_000_000 },
    menengah: { entry_fee: 18_000_000, monthly_fee: 1_500_000, yearly_other: 5_000_000 },
    premium: { entry_fee: 70_000_000, monthly_fee: 4_500_000, yearly_other: 18_000_000 },
  },
  sma: {
    negeri: { entry_fee: 0, monthly_fee: 0, yearly_other: 3_500_000 },
    menengah: { entry_fee: 22_000_000, monthly_fee: 1_800_000, yearly_other: 6_000_000 },
    premium: { entry_fee: 80_000_000, monthly_fee: 5_000_000, yearly_other: 20_000_000 },
  },
  kuliah: {
    negeri: { entry_fee: 5_000_000, monthly_fee: 1_250_000, yearly_other: 8_000_000 },
    menengah: { entry_fee: 25_000_000, monthly_fee: 1_700_000, yearly_other: 10_000_000 },
    premium: { entry_fee: 75_000_000, monthly_fee: 4_500_000, yearly_other: 20_000_000 },
  },
};

export type Bucket = {
  key: "kas" | "pendek" | "menengah" | "panjang" | "sangat-panjang";
  label: string;
  minYears: number;
  returnPct: number; // perkiraan return tahunan setelah biaya, konservatif
  risk: "Sangat rendah" | "Rendah" | "Sedang" | "Sedang–tinggi" | "Tinggi (turun bertahap)";
  instruments: string;
  mix: string;
};

// Instrumen menurut jarak waktu ke kebutuhan dana. Semakin dekat, semakin aman.
export const BUCKETS: Bucket[] = [
  {
    key: "kas",
    label: "< 1 tahun",
    minYears: 0,
    returnPct: 4,
    risk: "Sangat rendah",
    instruments: "Tabungan terpisah, deposito, reksa dana pasar uang",
    mix: "100% pasar uang / deposito",
  },
  {
    key: "pendek",
    label: "1–3 tahun",
    minYears: 1,
    returnPct: 5.5,
    risk: "Rendah",
    instruments: "Reksa dana pasar uang + SBN ritel (ST, ORI, SR) atau deposito",
    mix: "50% pasar uang · 50% SBN ritel",
  },
  {
    key: "menengah",
    label: "3–5 tahun",
    minYears: 3,
    returnPct: 6.5,
    risk: "Sedang",
    instruments: "Reksa dana pendapatan tetap / SBN + sedikit emas",
    mix: "60% pendapatan tetap/SBN · 25% pasar uang · 15% emas",
  },
  {
    key: "panjang",
    label: "5–10 tahun",
    minYears: 5,
    returnPct: 8,
    risk: "Sedang–tinggi",
    instruments: "Reksa dana indeks saham + reksa dana pendapatan tetap + emas",
    mix: "50% indeks saham · 35% pendapatan tetap · 15% emas",
  },
  {
    key: "sangat-panjang",
    label: "> 10 tahun",
    minYears: 10,
    returnPct: 9,
    risk: "Tinggi (turun bertahap)",
    instruments: "Reksa dana indeks saham (IDX30/LQ45) dominan + obligasi + emas",
    mix: "70% indeks saham · 20% pendapatan tetap · 10% emas",
  },
];

export function bucketFor(years: number): Bucket {
  return [...BUCKETS].reverse().find((b) => years >= b.minYears) ?? BUCKETS[0];
}

export function defaultCosts(): Record<StageKey, StageCost> {
  return Object.fromEntries(
    STAGES.map((s) => {
      const tier: Tier = s.key === "kuliah" ? "negeri" : "menengah";
      return [s.key, { tier, ...TIER_PRESETS[s.key][tier] }];
    })
  ) as Record<StageKey, StageCost>;
}

export function defaultPlan(today = new Date()): EducationPlanInput {
  const iso = (y: number) => `${y}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  return {
    children: [
      { name: "Anak 1", birth_date: iso(today.getFullYear() - 2) },
      { name: "Anak 2", birth_date: iso(today.getFullYear() + 1) },
    ],
    costs: defaultCosts(),
    education_inflation_pct: 10,
    fund_full_school: false,
    investment_ids: [],
  };
}

export type Goal = {
  childIndex: number;
  childName: string;
  stage: (typeof STAGES)[number];
  startDate: Date; // awal tahun ajaran (Juli)
  yearsUntil: number;
  status: "akan-datang" | "berjalan" | "selesai";
  costToday: number; // uang pangkal + biaya tahun pertama, harga hari ini
  target: number; // dana yang harus siap saat masuk (nilai masa depan)
  monthlyFeeAtEntry: number; // SPP/bulan saat masuk (nilai masa depan)
  unfundedNote: boolean; // true bila SPP tahun ke-2 dst. dibayar dari cashflow bulanan
  bucket: Bucket;
  allocated: number; // dana terkumpul yang dialokasikan ke tujuan ini (nilai sekarang)
  monthlyContribution: number; // setoran/bulan mulai sekarang sampai tanggal masuk
};

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

function annualCost(c: StageCost) {
  return c.monthly_fee * 12 + c.yearly_other;
}

// Setoran bulanan agar FV tercapai dalam n bulan dengan return tahunan r.
function monthlyPayment(fv: number, years: number, annualReturnPct: number) {
  const n = Math.max(1, Math.round(years * 12));
  const r = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  if (r === 0) return fv / n;
  return (fv * r) / (Math.pow(1 + r, n) - 1);
}

export function buildGoals(
  plan: EducationPlanInput,
  childCount: number,
  currentFund: number,
  today = new Date()
): Goal[] {
  const infl = plan.education_inflation_pct / 100;
  const goals: Goal[] = [];

  plan.children.slice(0, childCount).forEach((child, childIndex) => {
    const birth = new Date(`${child.birth_date}T00:00:00`);
    for (const stage of STAGES) {
      const startDate = new Date(birth.getFullYear() + stage.entryAge, 6, 1);
      const endDate = new Date(startDate.getFullYear() + stage.years, 6, 1);
      const yearsUntil = (startDate.getTime() - today.getTime()) / MS_PER_YEAR;
      const status = today >= endDate ? "selesai" : today >= startDate ? "berjalan" : "akan-datang";
      const c = plan.costs[stage.key];
      const growth = (k: number) => Math.pow(1 + infl, Math.max(0, yearsUntil) + k);
      const fullFund = stage.key === "kuliah" || plan.fund_full_school;
      const yearsFunded = fullFund ? stage.years : 1;
      let target = c.entry_fee * growth(0);
      for (let k = 0; k < yearsFunded; k++) target += annualCost(c) * growth(k);
      goals.push({
        childIndex,
        childName: child.name,
        stage,
        startDate,
        yearsUntil,
        status,
        costToday: c.entry_fee + annualCost(c),
        target,
        monthlyFeeAtEntry: c.monthly_fee * growth(0),
        unfundedNote: !fullFund && stage.years > 1,
        bucket: bucketFor(Math.max(0, yearsUntil)),
        allocated: 0,
        monthlyContribution: 0,
      });
    }
  });

  // Dana yang sudah terkumpul dipakai untuk tujuan terdekat lebih dulu.
  let remaining = currentFund;
  const upcoming = goals
    .filter((g) => g.status === "akan-datang")
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  for (const g of upcoming) {
    const growth = Math.pow(1 + g.bucket.returnPct / 100, g.yearsUntil);
    const presentValue = g.target / growth;
    g.allocated = Math.min(remaining, presentValue);
    remaining -= g.allocated;
    const fvLeft = (presentValue - g.allocated) * growth;
    g.monthlyContribution = fvLeft > 1 ? monthlyPayment(fvLeft, g.yearsUntil, g.bucket.returnPct) : 0;
  }

  return goals.sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime() || a.childIndex - b.childIndex
  );
}

// Total biaya pendidikan per tahun ajaran (nilai masa depan), dipisah per anak.
export function yearlyCosts(plan: EducationPlanInput, childCount: number, today = new Date()) {
  const infl = plan.education_inflation_pct / 100;
  const byYear = new Map<number, number[]>();
  plan.children.slice(0, childCount).forEach((child, idx) => {
    const birthYear = new Date(`${child.birth_date}T00:00:00`).getFullYear();
    for (const stage of STAGES) {
      const c = plan.costs[stage.key];
      for (let k = 0; k < stage.years; k++) {
        const year = birthYear + stage.entryAge + k;
        if (year < today.getFullYear()) continue;
        const factor = Math.pow(1 + infl, Math.max(0, year - today.getFullYear()));
        const amount = ((k === 0 ? c.entry_fee : 0) + annualCost(c)) * factor;
        const row = byYear.get(year) ?? [0, 0];
        row[idx] += amount;
        byYear.set(year, row);
      }
    }
  });
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]);
}

// Total setoran per bulan untuk setiap tahun ke depan (setoran tiap tujuan berhenti saat anak masuk).
export function contributionTimeline(goals: Goal[], today = new Date()) {
  const lastYear = Math.max(today.getFullYear(), ...goals.map((g) => g.startDate.getFullYear()));
  const rows: { year: number; total: number }[] = [];
  for (let y = today.getFullYear(); y <= lastYear; y++) {
    const point = new Date(y, 0, 1) < today ? today : new Date(y, 0, 1);
    const total = goals
      .filter((g) => g.status === "akan-datang" && g.startDate > point)
      .reduce((s, g) => s + g.monthlyContribution, 0);
    rows.push({ year: y, total });
  }
  return rows;
}
