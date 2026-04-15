export interface Client {
  id?: number;
  first_name: string;
  last_name: string;
  birth_date?: string;
  email?: string;
  phone_number?: string;
  address?: string;
  client_type_id: number;
  blood_type?: string;
  insurance_company?: string;
  gender?: string;
  chronic_disease?: string;
  discount_percentage?: number;
  created_by?: number;
  clientType?: ClientType;
  creator?: any;
  created_at?: string;
  updated_at?: string;
  // Sous-comptes
  parent_client_id?: number | null;
  relationship?: string | null;
  parentClient?: Client | null;
  subAccounts?: Client[];
  // Plafond mensuel
  spending_limit?: number | null;
  current_month_spending?: number;
  spending_reset_date?: string | null;
  // Statut
  is_active?: boolean;
  blocked_reason?: string | null;
}

export interface ClientType {
  id?: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SpendingInfo {
  limit: number | null;
  current: number;
  remaining: number | null;
  reset_date: string | null;
  is_unlimited: boolean;
}

export interface SpendingCheckResult {
  can_purchase: boolean;
  amount_requested: number;
  spending_info: SpendingInfo;
  reason: string | null;
}

export interface SpendingWarning {
  type: 'blocked' | 'exceeded' | 'warning';
  message: string;
  spendingInfo?: SpendingInfo;
}

export interface FamilyGroup {
  principal: Client;
  sub_accounts: Client[];
  total_members: number;
}
