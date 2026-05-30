import { useEffect, useMemo, useState } from 'react';
import { api, type Transaction, type Category, type Tag } from '../api/client';

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

// Reusable multi-select dropdown with chips
const MultiSelectDropdown = ({
  label,
  items,
  selectedIds,
  onToggle,
  chipColor,
}: {
  label: string;
  items: { id: number; name: string }[];
  selectedIds: number[];
  onToggle: (id: number, checked: boolean) => void;
  chipColor: { bg: string; text: string };
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 10px',
          border: '1px solid #ccc',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          minWidth: 200,
          background: 'white',
          userSelect: 'none',
        }}
      >
        <span>
          {selectedIds.length
            ? `${selectedIds.length} ${label.toLowerCase()}${selectedIds.length > 1 ? 's' : ''} excluded`
            : label}
        </span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 10,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: 6,
              padding: '4px 0',
              minWidth: 220,
              boxShadow: '0 4px 12px rgba(0,0,0,.12)',
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            {items.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 13, color: '#999' }}>
                No {label.toLowerCase()}s available
              </div>
            )}
            {items.map((item) => (
              <label
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  background: selectedIds.includes(item.id) ? '#fafafa' : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={(e) => onToggle(item.id, e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: '#1f6feb', flexShrink: 0 }}
                />
                {item.name}
              </label>
            ))}
          </div>
        </>
      )}

      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {selectedIds.map((id) => {
            const item = items.find((i) => i.id === id);
            return item ? (
              <span
                key={id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: chipColor.bg,
                  color: chipColor.text,
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 12,
                }}
              >
                {item.name}
                <button
                  type="button"
                  onClick={() => onToggle(id, false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: chipColor.text,
                    cursor: 'pointer',
                    fontSize: 14,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};

const MonthlyAnalyticsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<{ month?: string; week?: string; day?: string }>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  // Store all transactions for credit calculation
  const [allTransactions, setAllTransactions] = useState<Transaction[] | null>(null);

  // Multi-select exclude filters
  const [excludeCategoryIds, setExcludeCategoryIds] = useState<number[]>([]);
  const [excludeTagIds, setExcludeTagIds] = useState<number[]>([]);

  useEffect(() => {
    Promise.all([api.listTransactions(), api.listCategories(), api.listTags()])
      .then(([txns, cats, tags]) => {
        setAllTransactions(txns);
        setCategories(cats);
        setTags(tags);
        // Only include debit transactions for analytics
        setTransactions(txns.filter((t) => t.debitOrCredit === 'debit'));
      })
      .catch((e) => setErr(e.message ?? String(e)));
  }, []);

  // Toggle helpers for multi-select
  const toggleCategory = (id: number, checked: boolean) => {
    setExcludeCategoryIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
  };

  const toggleTag = (id: number, checked: boolean) => {
    setExcludeTagIds((prev) =>
      checked ? [...prev, id] : prev.filter((i) => i !== id)
    );
  };

  // Exclude filter helper — applies to both debit and credit
  const filterExcluded = (txns: Transaction[] | null) => {
    if (!txns) return [] as Transaction[];
    return txns.filter((t) => {
      if (excludeCategoryIds.length && t.categoryId && excludeCategoryIds.includes(t.categoryId))
        return false;
      if (excludeTagIds.length && t.tags?.some((tag) => excludeTagIds.includes(tag.id)))
        return false;
      return true;
    });
  };

  // Group transactions by month, then week, then day (apply exclude filters)
  const grouped = useMemo(() => {
    const filtered = filterExcluded(transactions);
    const result: Record<string, Record<string, Record<string, Transaction[]>>> = {};
    for (const t of filtered) {
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
  }, [transactions, excludeCategoryIds, excludeTagIds]);

  // Filtered all transactions (for credit calculation) — also respects exclude filters
  const filteredAllTransactions = useMemo(
    () => filterExcluded(allTransactions),
    [allTransactions, excludeCategoryIds, excludeTagIds]
  );

  // Helper to update a transaction locally
  const updateTxn = (txn: Transaction) => {
    setTransactions((prev) =>
      prev ? prev.map((t) => (t.id === txn.id ? txn : t)) : prev
    );
  };

  // Inline editor for category/tag assignment
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
      const parts = raw
        .split(/[\,\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
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
      if (applyToAll && res.appliedToAll) {
        setTransactions((prev) =>
          prev
            ? prev.map((t) =>
                t.merchantKey === res.appliedToAll!.merchantKey
                  ? {
                      ...t,
                      category: res.transaction.category,
                      categoryId: res.transaction.categoryId,
                    }
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

    const merchantCount = useMemo(
      () => transactions?.filter((t) => t.merchantKey === txn.merchantKey).length ?? 1,
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
                <span
                  key={name}
                  style={{
                    background: '#eef6ff',
                    color: '#1f4f8a',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeTag(name)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#1f4f8a',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
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
            <button
              type="button"
              onClick={addTagFromInput}
              style={{
                padding: '6px 10px',
                fontSize: 13,
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={saveTags}
              disabled={savingTags}
              style={{
                padding: '6px 10px',
                fontSize: 13,
                background: '#1f6feb',
                color: 'white',
                border: '1px solid #1f6feb',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {savingTags ? 'Saving…' : 'Save tags'}
            </button>
          </div>
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
            Category
          </div>
          <select
            value={txn.categoryId ?? ''}
            onChange={(e) =>
              setCategory(e.target.value === '' ? null : Number(e.target.value))
            }
            style={{
              padding: '6px 8px',
              fontSize: 13,
              border: '1px solid #ccc',
              borderRadius: 4,
              width: 160,
            }}
          >
            <option value="">(none)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="or create new category"
              style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 }}
            />
            <button
              type="button"
              onClick={createAndAssign}
              disabled={creatingCat || !newCatName.trim()}
              style={{
                padding: '6px 10px',
                fontSize: 13,
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {creatingCat ? '…' : 'Create + assign'}
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              id={`apply-${txn.id}`}
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            <label htmlFor={`apply-${txn.id}`} style={{ fontSize: 13, marginLeft: 6 }}>
              Apply changes to <strong>all {merchantCount}</strong> transactions from{' '}
              <strong>{txn.merchantKey || '(no merchant key)'}</strong>
              {others > 0 ? (
                <span style={{ color: '#666' }}> (this + {others} others)</span>
              ) : null}
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
          {/* ── Exclude filters ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 500, marginBottom: 10, fontSize: 14 }}>What to Exclude:</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <MultiSelectDropdown
                label="Category"
                items={categories}
                selectedIds={excludeCategoryIds}
                onToggle={toggleCategory}
                chipColor={{ bg: '#f0e9ff', text: '#553c9a' }}
              />
              <MultiSelectDropdown
                label="Tag"
                items={tags}
                selectedIds={excludeTagIds}
                onToggle={toggleTag}
                chipColor={{ bg: '#eef6ff', text: '#1f4f8a' }}
              />
            </div>
          </div>

          {/* ── Month groups ── */}
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([monthKey, weeks]) => {
              const sampleDate = new Date(
                Object.values(weeks)[0][
                  Object.keys(Object.values(weeks)[0])[0]
                ][0].transactionDate
              );

              // Credit total for this month (filtered)
              let creditTotal = 0;
              if (filteredAllTransactions) {
                const [year, month] = monthKey.split('-');
                creditTotal = filteredAllTransactions
                  .filter((t) => t.debitOrCredit === 'credit')
                  .filter((t) => {
                    const d = new Date(t.transactionDate);
                    return (
                      d.getFullYear() === Number(year) &&
                      d.getMonth() + 1 === Number(month)
                    );
                  })
                  .reduce((sum, t) => sum + t.amount, 0);
              }

              const monthDebitTotal = Object.values(weeks)
                .flatMap((days) => Object.values(days).flatMap((txns) => txns))
                .reduce((sum, t) => sum + t.amount, 0);

              return (
                <div
                  key={monthKey}
                  style={{
                    marginBottom: 32,
                    border: '1px solid #eee',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  {/* Month header */}
                  <div
                    style={{
                      padding: 16,
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      background: '#f6f8fa',
                      fontWeight: 600,
                      fontSize: 18,
                    }}
                    onClick={() =>
                      setExpanded((e) => ({
                        month: e.month === monthKey ? undefined : monthKey,
                      }))
                    }
                  >
                    {formatMonth(sampleDate)}
                    <span style={{ fontSize: 13, color: '#888', marginLeft: 12 }}>
                      (₹{monthDebitTotal.toFixed(2)}
                      {creditTotal > 0 && (
                        <span style={{ color: '#1f6b3a', marginLeft: 16 }}>
                          | Credit: ₹{creditTotal.toFixed(2)}
                        </span>
                      )}
                      )
                    </span>
                  </div>

                  {expanded.month === monthKey && (
                    <div style={{ padding: 12 }}>
                      {Object.entries(weeks)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([weekKey, days]) => (
                          <div
                            key={weekKey}
                            style={{
                              marginBottom: 18,
                              border: '1px solid #f3f3f3',
                              borderRadius: 6,
                            }}
                          >
                            {/* Week header */}
                            <div
                              style={{
                                padding: 10,
                                background: '#f9f9f9',
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                              onClick={() =>
                                setExpanded((e) => ({
                                  ...e,
                                  week:
                                    e.week === `${monthKey}-${weekKey}`
                                      ? undefined
                                      : `${monthKey}-${weekKey}`,
                                }))
                              }
                            >
                              {weekKey}
                              <span style={{ fontSize: 13, color: '#888', marginLeft: 10 }}>
                                (₹
                                {Object.values(days)
                                  .flatMap((txns) => txns)
                                  .reduce((sum, t) => sum + t.amount, 0)
                                  .toFixed(2)}
                                )
                              </span>
                            </div>

                            {expanded.week === `${monthKey}-${weekKey}` && (
                              <div style={{ padding: 8 }}>
                                {Object.entries(days)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([dayKey, txns]) => (
                                    <div
                                      key={dayKey}
                                      style={{
                                        marginBottom: 10,
                                        border: '1px solid #f6f6f6',
                                        borderRadius: 4,
                                      }}
                                    >
                                      {/* Day header */}
                                      <div
                                        style={{
                                          padding: 8,
                                          background: '#f7f7fa',
                                          fontWeight: 400,
                                          cursor: 'pointer',
                                        }}
                                        onClick={() =>
                                          setExpanded((e) => ({
                                            ...e,
                                            day:
                                              e.day ===
                                              `${monthKey}-${weekKey}-${dayKey}`
                                                ? undefined
                                                : `${monthKey}-${weekKey}-${dayKey}`,
                                          }))
                                        }
                                      >
                                        {formatDay(new Date(dayKey))}
                                        <span
                                          style={{ fontSize: 13, color: '#888', marginLeft: 8 }}
                                        >
                                          (₹
                                          {txns
                                            .reduce((sum, t) => sum + t.amount, 0)
                                            .toFixed(2)}
                                          )
                                        </span>
                                      </div>

                                      {expanded.day ===
                                        `${monthKey}-${weekKey}-${dayKey}` && (
                                        <div style={{ padding: 8 }}>
                                          <table
                                            style={{
                                              width: '100%',
                                              borderCollapse: 'collapse',
                                              fontSize: 13,
                                            }}
                                          >
                                            <thead style={{ background: '#f3f3f3' }}>
                                              <tr>
                                                <th
                                                  style={{
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Date
                                                </th>
                                                <th
                                                  style={{
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Merchant
                                                </th>
                                                <th
                                                  style={{
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Description
                                                </th>
                                                <th
                                                  style={{
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Category
                                                </th>
                                                <th
                                                  style={{
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Tags
                                                </th>
                                                <th
                                                  style={{
                                                    textAlign: 'right',
                                                    padding: '8px 10px',
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Amount
                                                </th>
                                                <th
                                                  style={{
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Type
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {txns.map((t) => (
                                                <>
                                                  <tr
                                                    key={t.id}
                                                    style={{
                                                      borderTop: '1px solid #eee',
                                                      cursor: 'pointer',
                                                      background:
                                                        editingId === t.id
                                                          ? '#f6f8ff'
                                                          : undefined,
                                                    }}
                                                    onClick={() =>
                                                      setEditingId(
                                                        editingId === t.id ? null : t.id
                                                      )
                                                    }
                                                  >
                                                    <td style={{ padding: '6px 10px' }}>
                                                      {t.transactionDate.slice(0, 10)}
                                                    </td>
                                                    <td style={{ padding: '6px 10px' }}>
                                                      {t.merchantKey || '—'}
                                                    </td>
                                                    <td
                                                      style={{
                                                        padding: '6px 10px',
                                                        maxWidth: 360,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                      }}
                                                    >
                                                      {t.description}
                                                    </td>
                                                    <td style={{ padding: '6px 10px' }}>
                                                      {t.category ? (
                                                        <span
                                                          style={{
                                                            background: '#f0e9ff',
                                                            color: '#553c9a',
                                                            padding: '2px 8px',
                                                            borderRadius: 4,
                                                            fontSize: 12,
                                                            fontWeight: 500,
                                                          }}
                                                        >
                                                          {t.category.name}
                                                        </span>
                                                      ) : (
                                                        <em style={{ color: '#999' }}>—</em>
                                                      )}
                                                    </td>
                                                    <td style={{ padding: '6px 10px' }}>
                                                      {(t.tags || []).length === 0 ? (
                                                        <em style={{ color: '#999' }}>—</em>
                                                      ) : (
                                                        <span
                                                          style={{
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: 4,
                                                          }}
                                                        >
                                                          {t.tags!.map((tag) => (
                                                            <span
                                                              key={tag.id}
                                                              style={{
                                                                background: '#eef6ff',
                                                                color: '#1f4f8a',
                                                                padding: '2px 8px',
                                                                borderRadius: 999,
                                                                fontSize: 12,
                                                              }}
                                                            >
                                                              {tag.name}
                                                            </span>
                                                          ))}
                                                        </span>
                                                      )}
                                                    </td>
                                                    <td
                                                      style={{
                                                        padding: '6px 10px',
                                                        textAlign: 'right',
                                                        fontVariantNumeric: 'tabular-nums',
                                                      }}
                                                    >
                                                      {t.amount.toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '6px 10px' }}>
                                                      {t.debitOrCredit}
                                                    </td>
                                                  </tr>
                                                  {editingId === t.id && (
                                                    <tr>
                                                      <td
                                                        colSpan={7}
                                                        style={{
                                                          padding: 12,
                                                          background: '#fafbff',
                                                        }}
                                                      >
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