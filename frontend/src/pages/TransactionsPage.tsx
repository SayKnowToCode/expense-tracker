import { useEffect, useMemo, useState } from 'react';
import { api, type Transaction } from '../api/client';

const TransactionsPage = () => {
  const [txns, setTxns] = useState<Transaction[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .listTransactions()
      .then((data) => alive && setTxns(data))
      .catch((e) => alive && setErr(e.message ?? String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!txns) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return txns;
    return txns.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.referenceNumber || '').toLowerCase().includes(q),
    );
  }, [txns, filter]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Transactions</h1>
      <input
        placeholder="Filter by description or reference…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          padding: '8px 10px',
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 6,
          width: 360,
          marginBottom: 12,
        }}
      />
      {err ? <p style={{ color: '#a32f2a' }}>{err}</p> : null}
      {!txns && !err ? <p>Loading…</p> : null}
      {txns ? (
        <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          Showing {filtered.length} of {txns.length} transactions
        </div>
      ) : null}
      <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f3f3f3' }}>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Description</th>
              <th style={th}>Reference</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>{t.transactionDate.slice(0, 10)}</td>
                <td style={{ ...td, maxWidth: 480 }}>{t.description}</td>
                <td style={td}>{t.referenceNumber || <em style={{ color: '#999' }}>—</em>}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {t.amount.toFixed(2)}
                </td>
                <td style={td}>{t.debitOrCredit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontWeight: 600,
};
const td: React.CSSProperties = { padding: '6px 10px' };

export default TransactionsPage;
