import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DashboardSummary } from '../api/client';

const card: React.CSSProperties = {
  padding: 20,
  border: '1px solid #eee',
  borderRadius: 8,
  background: 'white',
  minWidth: 200,
  flex: '1 1 200px',
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
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Dashboard</h1>
      {err ? <p style={{ color: '#a32f2a' }}>{err}</p> : null}
      {!summary && !err ? <p>Loading…</p> : null}
      {summary ? (
        <>
          {summary.transactionCount === 0 ? (
            <div
              style={{
                padding: 16,
                background: '#eef6ff',
                color: '#1f4f8a',
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              No transactions yet.{' '}
              <Link to="/import" style={{ color: '#1f6feb' }}>
                Import a bank statement
              </Link>{' '}
              to get started.
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <Card label="Total Income" value={fmt(summary.totalIncome)} color="#1f6b3a" />
            <Card label="Total Expenses" value={fmt(summary.totalExpenses)} color="#a32f2a" />
            <Card
              label="Net Savings"
              value={fmt(summary.netSavings)}
              color={summary.netSavings >= 0 ? '#1f6b3a' : '#a32f2a'}
            />
            <Card
              label="Avg daily spend"
              value={fmt(summary.avgDailySpend)}
              color="#444"
              sub={`over ${summary.daysCovered} days`}
            />
            <Card label="Transactions" value={String(summary.transactionCount)} color="#444" />
          </div>

          <p style={{ color: '#666', fontSize: 14 }}>
            Detailed breakdowns by tag, category, merchant and daily spend live on the{' '}
            <Link to="/analytics" style={{ color: '#1f6feb' }}>
              Analytics
            </Link>{' '}
            page.
          </p>
        </>
      ) : null}
    </div>
  );
};

const Card = ({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) => (
  <div style={card}>
    <div style={{ fontSize: 13, color: '#666' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600, color }}>{value}</div>
    {sub ? <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{sub}</div> : null}
  </div>
);

export default DashboardPage;
