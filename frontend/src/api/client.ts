/**
 * Tiny typed API client. Goes through Vite's dev proxy (see
 * vite.config.ts) so we don't need to know whether we're running
 * against localhost:4000 directly or behind a reverse proxy.
 */

export interface ApiError {
  error: string;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let body: ApiError | string;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      body = await res.text();
    }
    const message = typeof body === 'string' ? body : body.error;
    throw new Error(message || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

export interface ParsedTransactionRow {
  transactionDate: string;
  amount: number;
  debitOrCredit: 'debit' | 'credit';
  description: string;
  referenceNumber: string | null;
  rawCsvJson?: Record<string, string>;
}

export interface ImportSummary {
  importId: number;
  createdCount: number;
  duplicateCount: number;
  totalRows: number;
  summary: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
}

export interface Transaction {
  id: number;
  transactionDate: string;
  amount: number;
  debitOrCredit: string;
  description: string;
  referenceNumber: string | null;
  categoryId?: number | null;
  category?: Category | null;
  merchant?: { id: number; name: string } | null;
  merchantKey: string;
  tags?: Tag[];
  import?: { id: number; fileName: string };
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  transactionCount: number;
  daysCovered: number;
  avgDailySpend: number;
  firstTransactionDate: string | null;
  lastTransactionDate: string | null;
}

export interface SpendBucket {
  key: string;
  label: string;
  totalAmount: number;
  transactionCount: number;
}

export interface DailyPoint {
  date: string;
  spend: number;
  income: number;
  count: number;
}

export interface ApplyToAllResult {
  merchantKey: string;
  backfilled: number;
}

export interface SetTagsResponse {
  transaction: Transaction;
  appliedToAll: ApplyToAllResult | null;
}

export interface SetCategoryResponse {
  transaction: Transaction;
  appliedToAll: ApplyToAllResult | null;
}

export interface AutoTagRule {
  id: number;
  merchantKey: string;
  tagId: number;
  tag: Tag;
}

export interface AutoCategoryRule {
  id: number;
  merchantKey: string;
  categoryId: number;
  category: Category;
}

export const api = {
  importCsv: (payload: {
    fileName: string;
    originalCsv: string;
    parsedRows: ParsedTransactionRow[];
  }) =>
    request<ImportSummary>('/api/imports/csv', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listImports: () => request<unknown[]>('/api/imports'),

  listTransactions: () => request<Transaction[]>('/api/transactions'),

  dashboardSummary: () => request<DashboardSummary>('/api/analytics/summary'),

  listTags: () => request<Tag[]>('/api/tags'),

  listCategories: () => request<Category[]>('/api/categories'),

  createCategory: (name: string, description?: string) =>
    request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),

  setTransactionTags: (
    transactionId: number,
    tags: string[],
    applyToAllFromSameMerchant = false,
  ) =>
    request<SetTagsResponse>(`/api/transactions/${transactionId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags, applyToAllFromSameMerchant }),
    }),

  setTransactionCategory: (
    transactionId: number,
    categoryId: number | null,
    applyToAllFromSameMerchant = false,
  ) =>
    request<SetCategoryResponse>(`/api/transactions/${transactionId}/category`, {
      method: 'PUT',
      body: JSON.stringify({ categoryId, applyToAllFromSameMerchant }),
    }),

  spendByTag: () => request<SpendBucket[]>('/api/analytics/by-tag'),
  spendByCategory: () => request<SpendBucket[]>('/api/analytics/by-category'),
  spendByMerchant: (limit = 25) =>
    request<SpendBucket[]>(`/api/analytics/by-merchant?limit=${limit}`),
  dailySeries: () => request<DailyPoint[]>('/api/analytics/daily'),

  listAutoTagRules: () => request<AutoTagRule[]>('/api/auto-rules/tags'),
  deleteAutoTagRule: (id: number) =>
    request<void>(`/api/auto-rules/tags/${id}`, { method: 'DELETE' }),
  listAutoCategoryRules: () =>
    request<AutoCategoryRule[]>('/api/auto-rules/categories'),
  deleteAutoCategoryRule: (id: number) =>
    request<void>(`/api/auto-rules/categories/${id}`, { method: 'DELETE' }),
  backfillMerchantKeys: () =>
    request<{ scanned: number; updated: number }>(
      '/api/auto-rules/backfill-merchant-keys',
      { method: 'POST' },
    ),
};
