import { useEffect, useState } from 'react';
import { api, type DashboardSummary } from '../api/client';

const card: React.CSSProperties = {
  padding: 20,
  border: '1px solid #eee',
  borderRadius: 8,
  background: 'white',
  minWidth: 180,
};

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const DashboardPage = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .dashboardSummary()
      .then((s) => alive && setSummary(s))
      .catch((e) => alive && setErr(e.message ?? String(e)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Dashboard</h1>
      {err ? <p style={{ color: '#a32f2a' }}>{err}</p> : null}
      {!summary && !err ? <p>Loading…</p> : null}
      {summary ? (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={card}>
            <div style={{ fontSize: 13, color: '#666' }}>Total Income</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#1f6b3a' }}>
              {fmt(summary.totalIncome)}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, color: '#666' }}>Total Expenses</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#a32f2a' }}>
              {fmt(summary.totalExpenses)}
            </div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, color: '#666' }}>Net Savings</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: summary.netSavings >= 0 ? '#1f6b3a' : '#a32f2a',
              }}
            >
              {fmt(summary.netSavings)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
