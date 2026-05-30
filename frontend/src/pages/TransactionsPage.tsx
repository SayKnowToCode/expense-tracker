import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type Category,
  type Transaction,
} from '../api/client';

const TransactionsPage = () => {
  const [txns, setTxns] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [merchantFilter, setMerchantFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [t, c] = await Promise.all([api.listTransactions(), api.listCategories()]);
    setTxns(t);
    setCategories(c);
  }, []);

  useEffect(() => {
    reload().catch((e) => setErr(e.message ?? String(e)));
  }, [reload]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!txns) return [];
    const q = filter.trim().toLowerCase();
    return txns.filter((t) => {
      if (merchantFilter && t.merchantKey !== merchantFilter) return false;
      if (!q) return true;
      return (
        t.description.toLowerCase().includes(q) ||
        (t.referenceNumber || '').toLowerCase().includes(q) ||
        (t.category?.name || '').toLowerCase().includes(q) ||
        (t.merchantKey || '').toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.name.toLowerCase().includes(q))
      );
    });
  }, [txns, filter, merchantFilter]);

  const merchantCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txns ?? []) {
      m.set(t.merchantKey, (m.get(t.merchantKey) ?? 0) + 1);
    }
    return m;
  }, [txns]);

  const handleTagsApplied = (count: number, merchantKey: string) => {
    if (count > 0) {
      setToast(`Tagged ${count} transactions from ${merchantKey}.`);
      reload().catch((e) => setErr(e.message ?? String(e)));
    }
  };

  const handleCategoryApplied = (count: number, merchantKey: string) => {
    if (count > 0) {
      setToast(`Categorized ${count} transactions from ${merchantKey}.`);
      reload().catch((e) => setErr(e.message ?? String(e)));
    }
  };

  const onCreateCategory = async (name: string) => {
    const c = await api.createCategory(name);
    setCategories((prev) => [...prev, c]);
    return c;
  };

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Transactions</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Filter by description, merchant, tag, or category…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...input, width: 460 }}
        />
        {merchantFilter ? (
          <button
            onClick={() => setMerchantFilter(null)}
            style={{ ...smallBtn, background: '#fff3cd' }}
          >
            Clear merchant filter: {merchantFilter} ×
          </button>
        ) : null}
      </div>
      {err ? <p style={{ color: '#a32f2a' }}>{err}</p> : null}
      {!txns && !err ? <p>Loading…</p> : null}
      {txns ? (
        <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          Showing {filtered.length} of {txns.length} transactions · click a row to edit
        </div>
      ) : null}
      <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f3f3f3' }}>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Merchant</th>
              <th style={th}>Description</th>
              <th style={th}>Category</th>
              <th style={th}>Tags</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <Row
                key={t.id}
                txn={t}
                categories={categories}
                merchantCount={merchantCounts.get(t.merchantKey) ?? 0}
                isEditing={editingId === t.id}
                onToggleEdit={() => setEditingId(editingId === t.id ? null : t.id)}
                onFilterByMerchant={() => setMerchantFilter(t.merchantKey)}
                onTagsApplied={handleTagsApplied}
                onCategoryApplied={handleCategoryApplied}
                onCreateCategory={onCreateCategory}
                onLocalUpdate={(u) =>
                  setTxns((prev) => (prev ? prev.map((x) => (x.id === u.id ? u : x)) : prev))
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      {toast ? <Toast message={toast} /> : null}
    </div>
  );
};

interface RowProps {
  txn: Transaction;
  categories: Category[];
  merchantCount: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onFilterByMerchant: () => void;
  onTagsApplied: (count: number, merchantKey: string) => void;
  onCategoryApplied: (count: number, merchantKey: string) => void;
  onCreateCategory: (name: string) => Promise<Category>;
  onLocalUpdate: (txn: Transaction) => void;
}

const Row = (props: RowProps) => {
  const { txn, isEditing, onToggleEdit, onFilterByMerchant } = props;
  return (
    <>
      <tr style={{ borderTop: '1px solid #eee' }}>
        <td style={td}>{txn.transactionDate.slice(0, 10)}</td>
        <td style={td}>
          <button
            type="button"
            onClick={onFilterByMerchant}
            title={`Filter to ${txn.merchantKey}`}
            style={merchantChip}
          >
            {txn.merchantKey || '—'}
          </button>
        </td>
        <td
          style={{ ...td, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
          onClick={onToggleEdit}
        >
          {txn.description}
        </td>
        <td style={{ ...td, cursor: 'pointer' }} onClick={onToggleEdit}>
          {txn.category ? (
            <span style={categoryChip}>{txn.category.name}</span>
          ) : (
            <em style={{ color: '#999' }}>—</em>
          )}
        </td>
        <td style={{ ...td, cursor: 'pointer' }} onClick={onToggleEdit}>
          {(txn.tags || []).length === 0 ? (
            <em style={{ color: '#999' }}>—</em>
          ) : (
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {txn.tags!.map((tag) => (
                <span key={tag.id} style={tagChip}>
                  {tag.name}
                </span>
              ))}
            </span>
          )}
        </td>
        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {txn.amount.toFixed(2)}
        </td>
        <td style={td}>{txn.debitOrCredit}</td>
      </tr>
      {isEditing ? (
        <tr style={{ background: '#fafbff' }}>
          <td colSpan={7} style={{ padding: 12 }}>
            <Editor {...props} />
          </td>
        </tr>
      ) : null}
    </>
  );
};

const Editor = ({
  txn,
  categories,
  merchantCount,
  onTagsApplied,
  onCategoryApplied,
  onCreateCategory,
  onLocalUpdate,
}: RowProps) => {
  const [draftTags, setDraftTags] = useState<string[]>(
    (txn.tags || []).map((t) => t.name),
  );
  const [tagInput, setTagInput] = useState('');
  const [applyToAll, setApplyToAll] = useState(true);
  const [savingTags, setSavingTags] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  const addTagFromInput = () => {
    const raw = tagInput.trim();
    if (!raw) return;
    const parts = raw.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
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
      onLocalUpdate(res.transaction);
      if (res.appliedToAll) {
        onTagsApplied(res.appliedToAll.backfilled, res.appliedToAll.merchantKey);
      }
    } finally {
      setSavingTags(false);
    }
  };

  const setCategory = async (categoryId: number | null) => {
    const res = await api.setTransactionCategory(txn.id, categoryId, applyToAll);
    onLocalUpdate(res.transaction);
    if (res.appliedToAll) {
      onCategoryApplied(res.appliedToAll.backfilled, res.appliedToAll.merchantKey);
    }
  };

  const createAndAssign = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setCreatingCat(true);
    try {
      const c = await onCreateCategory(name);
      await setCategory(c.id);
      setNewCatName('');
    } catch (e: any) {
      alert(e.message ?? String(e));
    } finally {
      setCreatingCat(false);
    }
  };

  const others = Math.max(0, merchantCount - 1);

  return (
    <div>
      <div
        style={{
          padding: '8px 12px',
          background: '#fff4d6',
          borderRadius: 4,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="checkbox"
          id={`apply-${txn.id}`}
          checked={applyToAll}
          onChange={(e) => setApplyToAll(e.target.checked)}
        />
        <label htmlFor={`apply-${txn.id}`} style={{ fontSize: 13 }}>
          Apply changes to <strong>all {merchantCount}</strong> transactions from{' '}
          <strong>{txn.merchantKey || '(no merchant key)'}</strong>
          {others > 0 ? <span style={{ color: '#666' }}> (this + {others} others)</span> : null}
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <div style={{ minWidth: 320 }}>
          <div style={editorLabel}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {draftTags.length === 0 ? (
              <em style={{ color: '#999', fontSize: 13 }}>no tags yet</em>
            ) : (
              draftTags.map((name) => (
                <span key={name} style={tagChip}>
                  {name}
                  <button
                    type="button"
                    onClick={() => removeTag(name)}
                    style={chipRemove}
                    aria-label={`remove ${name}`}
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
              style={input}
            />
            <button type="button" onClick={addTagFromInput} style={smallBtn}>
              Add
            </button>
            <button type="button" onClick={saveTags} disabled={savingTags} style={primarySmallBtn}>
              {savingTags ? 'Saving…' : 'Save tags'}
            </button>
          </div>
        </div>

        <div style={{ minWidth: 280 }}>
          <div style={editorLabel}>Category</div>
          <select
            value={txn.categoryId ?? ''}
            onChange={(e) =>
              setCategory(e.target.value === '' ? null : Number(e.target.value))
            }
            style={{ ...input, width: 220 }}
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
              style={input}
            />
            <button
              type="button"
              onClick={createAndAssign}
              disabled={creatingCat || !newCatName.trim()}
              style={smallBtn}
            >
              {creatingCat ? '…' : 'Create + assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Toast = ({ message }: { message: string }) => (
  <div
    style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      background: '#1f6b3a',
      color: 'white',
      padding: '10px 16px',
      borderRadius: 6,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxWidth: 360,
      fontSize: 13,
    }}
  >
    {message}
  </div>
);

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontWeight: 600,
};
const td: React.CSSProperties = { padding: '6px 10px', verticalAlign: 'top' };
const tagChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  background: '#eef6ff',
  color: '#1f4f8a',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 12,
};
const categoryChip: React.CSSProperties = {
  display: 'inline-block',
  background: '#f0e9ff',
  color: '#553c9a',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
};
const merchantChip: React.CSSProperties = {
  display: 'inline-block',
  background: '#f3f3f3',
  border: '1px solid #ddd',
  color: '#333',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  maxWidth: 180,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const chipRemove: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#1f4f8a',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};
const editorLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#555',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};
const input: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 13,
  border: '1px solid #ccc',
  borderRadius: 4,
};
const smallBtn: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  background: 'white',
  border: '1px solid #ccc',
  borderRadius: 4,
  cursor: 'pointer',
};
const primarySmallBtn: React.CSSProperties = {
  ...smallBtn,
  background: '#1f6feb',
  color: 'white',
  borderColor: '#1f6feb',
};

export default TransactionsPage;
