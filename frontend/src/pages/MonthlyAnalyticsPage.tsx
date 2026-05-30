import { useEffect, useMemo, useState } from 'react';
import { api, type Transaction, type Category } from '../api/client';

// Helper to get week number in a month
function getWeekOfMonth(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
}

function formatMonth(date: Date) {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function formatDay(date: Date) {
  return date.toLocaleDateString();
}

const MonthlyAnalyticsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<{ month?: string; week?: string; day?: string }>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  // Store all transactions for credit calculation
  const [allTransactions, setAllTransactions] = useState<Transaction[] | null>(null);
  useEffect(() => {
    Promise.all([api.listTransactions(), api.listCategories()])
      .then(([txns, cats]) => {
        setAllTransactions(txns);
        // Only include debit transactions for analytics
        setTransactions(txns.filter((t) => t.debitOrCredit === 'debit'));
        setCategories(cats);
      })
      .catch((e) => setErr(e.message ?? String(e)));
  }, []);

  // Group transactions by month, then week, then day
  const grouped = useMemo(() => {
    if (!transactions) return {};
    const result: Record<string, Record<string, Record<string, Transaction[]>>> = {};
    for (const t of transactions) {
      const d = new Date(t.transactionDate);
      const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const weekKey = `Week ${getWeekOfMonth(d)}`;
      const dayKey = d.toISOString().slice(0, 10);
      if (!result[monthKey]) result[monthKey] = {};
      if (!result[monthKey][weekKey]) result[monthKey][weekKey] = {};
      if (!result[monthKey][weekKey][dayKey]) result[monthKey][weekKey][dayKey] = [];
      result[monthKey][weekKey][dayKey].push(t);
    }
    return result;
  }, [transactions]);

  // Helper to update a transaction locally
  const updateTxn = (txn: Transaction) => {
    setTransactions((prev) =>
      prev ? prev.map((t) => (t.id === txn.id ? txn : t)) : prev
    );
  };

  // Inline editor for category/tag assignment (reuse TransactionsPage logic)
  const Editor = ({ txn }: { txn: Transaction }) => {
    const [draftTags, setDraftTags] = useState<string[]>(
      (txn.tags || []).map((t) => t.name)
    );
    const [tagInput, setTagInput] = useState('');
    const [savingTags, setSavingTags] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [creatingCat, setCreatingCat] = useState(false);
    const [applyToAll, setApplyToAll] = useState(true);

    const addTagFromInput = () => {
      const raw = tagInput.trim();
      if (!raw) return;
      const parts = raw.split(/[\,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      setDraftTags((prev) => Array.from(new Set([...prev, ...parts])));
      setTagInput('');
    };

    const removeTag = (name: string) => {
      setDraftTags((prev) => prev.filter((t) => t !== name));
    };

    const saveTags = async () => {
      setSavingTags(true);
      try {
        const res = await api.setTransactionTags(txn.id, draftTags, applyToAll);
        updateTxn(res.transaction);
        // If applied to all, update all matching merchantKey txns locally
        if (applyToAll && res.appliedToAll) {
          setTransactions((prev) =>
            prev
              ? prev.map((t) =>
                  t.merchantKey === res.appliedToAll!.merchantKey
                    ? { ...t, tags: res.transaction.tags }
                    : t
                )
              : prev
          );
        }
      } finally {
        setSavingTags(false);
      }
    };

    const setCategory = async (categoryId: number | null) => {
      const res = await api.setTransactionCategory(txn.id, categoryId, applyToAll);
      updateTxn(res.transaction);
      // If applied to all, update all matching merchantKey txns locally
      if (applyToAll && res.appliedToAll) {
        setTransactions((prev) =>
          prev
            ? prev.map((t) =>
                t.merchantKey === res.appliedToAll!.merchantKey
                  ? { ...t, category: res.transaction.category, categoryId: res.transaction.categoryId }
                  : t
              )
            : prev
        );
      }
    };

    const createAndAssign = async () => {
      const name = newCatName.trim();
      if (!name) return;
      setCreatingCat(true);
      try {
        const c = await api.createCategory(name);
        setCategory(c.id);
        setNewCatName('');
      } finally {
        setCreatingCat(false);
      }
    };

    // Count of other transactions from same merchant
    const merchantCount = useMemo(() =>
      transactions?.filter((t) => t.merchantKey === txn.merchantKey).length ?? 1,
      [transactions, txn.merchantKey]
    );
    const others = Math.max(0, merchantCount - 1);

    return (
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '8px 0' }}>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {draftTags.length === 0 ? (
              <em style={{ color: '#999', fontSize: 13 }}>no tags yet</em>
            ) : (
              draftTags.map((name) => (
                <span key={name} style={{ background: '#eef6ff', color: '#1f4f8a', padding: '2px 8px', borderRadius: 999, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {name}
                  <button type="button" onClick={() => removeTag(name)} style={{ border: 'none', background: 'transparent', color: '#1f4f8a', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTagFromInput();
                }
              }}
              placeholder="type a tag, press Enter or comma"
              style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
            />
            <button type="button" onClick={addTagFromInput} style={{ padding: '6px 10px', fontSize: 13, background: 'white', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>Add</button>
            <button type="button" onClick={saveTags} disabled={savingTags} style={{ padding: '6px 10px', fontSize: 13, background: '#1f6feb', color: 'white', border: '1px solid #1f6feb', borderRadius: 4, cursor: 'pointer' }}>{savingTags ? 'Saving…' : 'Save tags'}</button>
          </div>
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Category</div>
          <select
            value={txn.categoryId ?? ''}
            onChange={(e) => setCategory(e.target.value === '' ? null : Number(e.target.value))}
            style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4, width: 160 }}
          >
            <option value="">(none)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="or create new category"
              style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
            />
            <button type="button" onClick={createAndAssign} disabled={creatingCat || !newCatName.trim()} style={{ padding: '6px 10px', fontSize: 13, background: 'white', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>{creatingCat ? '…' : 'Create + assign'}</button>
          </div>
          <div style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              id={`apply-${txn.id}`}
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            <label htmlFor={`apply-${txn.id}`} style={{ fontSize: 13, marginLeft: 6 }}>
              Apply changes to <strong>all {merchantCount}</strong> transactions from <strong>{txn.merchantKey || '(no merchant key)'}</strong>
              {others > 0 ? <span style={{ color: '#666' }}> (this + {others} others)</span> : null}
            </label>
          </div>
        </div>
      </div>
    );
  };

  // Render
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Monthly Analytics</h1>
      {err ? <p style={{ color: '#a32f2a' }}>{err}</p> : null}
      {!transactions && !err ? <p>Loading…</p> : null}
      {transactions ? (
        <div>
          {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([monthKey, weeks]) => {
            // Get a sample date for formatting
            const sampleDate = new Date(Object.values(weeks)[0] && Object.values(weeks)[0][Object.keys(Object.values(weeks)[0])[0]][0].transactionDate);
            // Calculate total credit for this month
            let creditTotal = 0;
            if (allTransactions) {
              const [year, month] = monthKey.split('-');
              creditTotal = allTransactions
                .filter((t) => t.debitOrCredit === 'credit')
                .filter((t) => {
                  const d = new Date(t.transactionDate);
                  return d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month);
                })
                .reduce((sum, t) => sum + t.amount, 0);
            }
            return (
              <div key={monthKey} style={{ marginBottom: 32, border: '1px solid #eee', borderRadius: 8, background: '#fff' }}>
                <div style={{ padding: 16, borderBottom: '1px solid #eee', cursor: 'pointer', background: '#f6f8fa', fontWeight: 600, fontSize: 18 }}
                  onClick={() => setExpanded((e) => ({ month: e.month === monthKey ? undefined : monthKey }))}>
                  {formatMonth(sampleDate)}
                  <span style={{ fontSize: 13, color: '#888', marginLeft: 12 }}>
                    (₹{Object.values(weeks).flatMap((days) => Object.values(days).flatMap((txns) => txns)).reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
                    {creditTotal > 0 && (
                      <span style={{ color: '#1f6b3a', marginLeft: 16 }}>
                        | Credit: ₹{creditTotal.toFixed(2)}
                      </span>
                    )}
                  </span>
                </div>
                {expanded.month === monthKey && (
                  <div style={{ padding: 12 }}>
                    {Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([weekKey, days]) => (
                      <div key={weekKey} style={{ marginBottom: 18, border: '1px solid #f3f3f3', borderRadius: 6 }}>
                        <div style={{ padding: 10, background: '#f9f9f9', fontWeight: 500, cursor: 'pointer' }}
                          onClick={() => setExpanded((e) => ({ ...e, week: e.week === `${monthKey}-${weekKey}` ? undefined : `${monthKey}-${weekKey}` }))}>
                          {weekKey}
                          <span style={{ fontSize: 13, color: '#888', marginLeft: 10 }}>
                            (₹{Object.values(days).flatMap((txns) => txns).reduce((sum, t) => sum + t.amount, 0).toFixed(2)})
                          </span>
                        </div>
                        {expanded.week === `${monthKey}-${weekKey}` && (
                          <div style={{ padding: 8 }}>
                            {Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([dayKey, txns]) => (
                              <div key={dayKey} style={{ marginBottom: 10, border: '1px solid #f6f6f6', borderRadius: 4 }}>
                                <div style={{ padding: 8, background: '#f7f7fa', fontWeight: 400, cursor: 'pointer' }}
                                  onClick={() => setExpanded((e) => ({ ...e, day: e.day === `${monthKey}-${weekKey}-${dayKey}` ? undefined : `${monthKey}-${weekKey}-${dayKey}` }))}>
                                  {formatDay(new Date(dayKey))}
                                  <span style={{ fontSize: 13, color: '#888', marginLeft: 8 }}>
                                    (₹{txns.reduce((sum, t) => sum + t.amount, 0).toFixed(2)})
                                  </span>
                                </div>
                                {expanded.day === `${monthKey}-${weekKey}-${dayKey}` && (
                                  <div style={{ padding: 8 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                      <thead style={{ background: '#f3f3f3' }}>
                                        <tr>
                                          <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Date</th>
                                          <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Merchant</th>
                                          <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Description</th>
                                          <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Category</th>
                                          <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Tags</th>
                                          <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Amount</th>
                                          <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Type</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {txns.map((t) => (
                                          <>
                                            <tr key={t.id} style={{ borderTop: '1px solid #eee', cursor: 'pointer', background: editingId === t.id ? '#f6f8ff' : undefined }}
                                              onClick={() => setEditingId(editingId === t.id ? null : t.id)}>
                                              <td style={{ padding: '6px 10px' }}>{t.transactionDate.slice(0, 10)}</td>
                                              <td style={{ padding: '6px 10px' }}>{t.merchantKey || '—'}</td>
                                              <td style={{ padding: '6px 10px', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                                              <td style={{ padding: '6px 10px' }}>{t.category ? <span style={{ background: '#f0e9ff', color: '#553c9a', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>{t.category.name}</span> : <em style={{ color: '#999' }}>—</em>}</td>
                                              <td style={{ padding: '6px 10px' }}>{(t.tags || []).length === 0 ? <em style={{ color: '#999' }}>—</em> : <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{t.tags!.map((tag) => (<span key={tag.id} style={{ background: '#eef6ff', color: '#1f4f8a', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{tag.name}</span>))}</span>}</td>
                                              <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.amount.toFixed(2)}</td>
                                              <td style={{ padding: '6px 10px' }}>{t.debitOrCredit}</td>
                                            </tr>
                                            {editingId === t.id && (
                                              <tr>
                                                <td colSpan={7} style={{ padding: 12, background: '#fafbff' }}>
                                                  <Editor txn={t} />
                                                </td>
                                              </tr>
                                            )}
                                          </>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default MonthlyAnalyticsPage;