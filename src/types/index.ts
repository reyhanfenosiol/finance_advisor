export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
  color: string | null;
  created_at: string;
};

export type InstrumentType =
  | "saham"
  | "reksadana"
  | "obligasi"
  | "emas"
  | "crypto"
  | "deposito"
  | "tabungan"
  | "p2p_lending"
  | "properti"
  | "lainnya";

export type InvestmentOwnership = "pribadi" | "keluarga";

export type Investment = {
  id: string;
  user_id: string;
  instrument_type: InstrumentType;
  instrument_name: string;
  ownership: InvestmentOwnership;
  notes: string | null;
  created_at: string;
};

export type InvestmentTransactionType = "buy" | "sell";

export type InvestmentTransaction = {
  id: string;
  user_id: string;
  investment_id: string;
  type: InvestmentTransactionType;
  amount: number;
  units: number | null;
  price_per_unit: number | null;
  transaction_date: string;
  created_at: string;
};

export type InvestmentValuation = {
  id: string;
  user_id: string;
  investment_id: string;
  valuation_date: string;
  current_value: number;
  created_at: string;
};

export type InflationData = {
  id: string;
  period: string;
  inflation_yoy: number;
  source: "bps_api" | "manual";
  fetched_at: string;
};

export type AdvisorType = "cashflow" | "investment";

export type AiConversation = {
  id: string;
  user_id: string;
  advisor_type: AdvisorType;
  title: string | null;
  created_at: string;
};

export type AiMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
