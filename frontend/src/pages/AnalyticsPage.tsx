import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, type DailyPoint, type SpendBucket } from '../api/client';

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const AnalyticsPage = () => {
  const [byTag, setByTag] = useState<SpendBucket[] | null>(null);
  const [byCategory, setByCategory] = useState<SpendBucket[] | null>(null);
  const [byMerchant, setByMerchant] = useState<SpendBucket[] | null>(null);
  const [daily, setDaily] = useState<DailyPoint[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.spendByTag(),
      api.spendByCategory(),
      api.spendByMerchant(15),
      api.dailySeries(),
    ])
      .then(([t, c, m, d]) => {
        if (!alive) return;
        setByTag(t);
        setByCategory(c);
        setByMerchant(m);
        setDaily(d);
      })
      .catch((e) => alive && setErr(e.message ?? String(e)));
    return () => {
      alive = false;
    };
  }, []);

  if (err) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Analytics</h1>
        <p style={{ color: '#a32f2a' }}>{err}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Analytics</h1>

      <Panel title="Daily spend vs income">
        {!daily ? (
          <Loading />
        ) : daily.length === 0 ? (
          <Empty>No transactions imported yet.</Empty>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={daily} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" minTickGap={32} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="spend" stroke="#d32f2f" dot={false} name="Spend" />
                <Line type="monotone" dataKey="income" stroke="#1f6b3a" dot={false} name="Income" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <Panel title="Spend by tag">
          <BucketList
            buckets={byTag}
            emptyHint="Tag some transactions to see them grouped here."
          />
        </Panel>
        <Panel title="Spend by category">
          <BucketList
            buckets={byCategory}
            emptyHint="Assign categories to transactions to see them grouped here."
          />
        </Panel>
      </div>

      <Panel title="Top 15 merchants">
        {!byMerchant ? (
          <Loading />
        ) : byMerchant.length === 0 ? (
          <Empty>No transactions yet.</Empty>
        ) : (
          <>
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <BarChart
                  data={byMerchant}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    width={160}
                    interval={0}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="totalAmount" fill="#1f6feb" name="Total spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <BucketList buckets={byMerchant} emptyHint="" />
          </>
        )}
      </Panel>
    </div>
  );
};

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    style={{
      background: 'white',
      border: '1px solid #eee',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
    }}
  >
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#444' }}>{title}</div>
    {children}
  </div>
);

const Loading = () => <div style={{ color: '#888', fontSize: 13 }}>Loading…</div>;
const Empty = ({ children }: { children: React.ReactNode }) => (
  <div style={{ color: '#888', fontSize: 13 }}>{children}</div>
);

const BucketList = ({
  buckets,
  emptyHint,
}: {
  buckets: SpendBucket[] | null;
  emptyHint: string;
}) => {
  if (!buckets) return <Loading />;
  if (buckets.length === 0) return <Empty>{emptyHint}</Empty>;
  const total = buckets.reduce((acc, b) => acc + b.totalAmount, 0);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead style={{ color: '#666' }}>
        <tr>
          <th style={{ textAlign: 'left', padding: '4px 6px' }}>Label</th>
          <th style={{ textAlign: 'right', padding: '4px 6px' }}>Count</th>
          <th style={{ textAlign: 'right', padding: '4px 6px' }}>Total</th>
          <th style={{ textAlign: 'right', padding: '4px 6px' }}>Share</th>
        </tr>
      </thead>
      <tbody>
        {buckets.map((b) => {
          const share = total > 0 ? (b.totalAmount / total) * 100 : 0;
          return (
            <tr key={b.key} style={{ borderTop: '1px solid #f3f3f3' }}>
              <td style={{ padding: '4px 6px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.label}
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {b.transactionCount}
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(b.totalAmount)}
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'right', color: '#666' }}>
                {share.toFixed(1)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default AnalyticsPage;
