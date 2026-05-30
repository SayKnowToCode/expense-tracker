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

export interface Transaction {
  id: number;
  transactionDate: string;
  amount: number;
  debitOrCredit: string;
  description: string;
  referenceNumber: string | null;
  category?: { id: number; name: string } | null;
  merchant?: { id: number; name: string } | null;
  tags?: { id: number; name: string }[];
  import?: { id: number; fileName: string };
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
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
};
