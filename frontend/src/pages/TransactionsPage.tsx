import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Category, type Transaction } from '../api/client';

const TransactionsPage = () => {
  const [txns, setTxns] = useState<Transaction[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const [t, c] = await Promise.all([api.listTransactions(), api.listCategories()]);
    setTxns(t);
    setCategories(c);
  }, []);

  useEffect(() => {
    reload().catch((e) => setErr(e.message ?? String(e)));
  }, [reload]);

  const filtered = useMemo(() => {
    if (!txns) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return txns;
    return txns.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.referenceNumber || '').toLowerCase().includes(q) ||
        (t.category?.name || '').toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.name.toLowerCase().includes(q)),
    );
  }, [txns, filter]);

  const applyLocalUpdate = (updated: Transaction) => {
    setTxns((prev) => (prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev));
  };

  const onSetTags = async (id: number, tags: string[]) => {
    const updated = await api.setTransactionTags(id, tags);
    applyLocalUpdate(updated);
  };

  const onSetCategory = async (id: number, categoryId: number | null) => {
    const updated = await api.setTransactionCategory(id, categoryId);
    applyLocalUpdate(updated);
  };

  const onCreateCategory = async (name: string) => {
    const c = await api.createCategory(name);
    setCategories((prev) => [...prev, c]);
    return c;
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Transactions</h1>
      <input
        placeholder="Filter by description, reference, tag, or category…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          padding: '8px 10px',
          fontSize: 14,
          border: '1px solid #ccc',
          borderRadius: 6,
          width: 460,
          marginBottom: 12,
        }}
      />
      {err ? <p style={{ color: '#a32f2a' }}>{err}</p> : null}
      {!txns && !err ? <p>Loading…</p> : null}
      {txns ? (
        <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
          Showing {filtered.length} of {txns.length} transactions · click a row to edit tags &
          category
        </div>
      ) : null}
      <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f3f3f3' }}>
            <tr>
              <th style={th}>Date</th>
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
                isEditing={editingId === t.id}
                onToggleEdit={() => setEditingId(editingId === t.id ? null : t.id)}
                onSetTags={(tags) => onSetTags(t.id, tags)}
                onSetCategory={(cid) => onSetCategory(t.id, cid)}
                onCreateCategory={onCreateCategory}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface RowProps {
  txn: Transaction;
  categories: Category[];
  isEditing: boolean;
  onToggleEdit: () => void;
  onSetTags: (tags: string[]) => Promise<void>;
  onSetCategory: (categoryId: number | null) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category>;
}

const Row = ({
  txn,
  categories,
  isEditing,
  onToggleEdit,
  onSetTags,
  onSetCategory,
  onCreateCategory,
}: RowProps) => {
  return (
    <>
      <tr
        style={{ borderTop: '1px solid #eee', cursor: 'pointer' }}
        onClick={onToggleEdit}
      >
        <td style={td}>{txn.transactionDate.slice(0, 10)}</td>
        <td style={{ ...td, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {txn.description}
        </td>
        <td style={td}>
          {txn.category ? (
            <span style={categoryChip}>{txn.category.name}</span>
          ) : (
            <em style={{ color: '#999' }}>—</em>
          )}
        </td>
        <td style={td}>
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
          <td colSpan={6} style={{ padding: 12 }}>
            <Editor
              txn={txn}
              categories={categories}
              onSetTags={onSetTags}
              onSetCategory={onSetCategory}
              onCreateCategory={onCreateCategory}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
};

const Editor = ({
  txn,
  categories,
  onSetTags,
  onSetCategory,
  onCreateCategory,
}: Omit<RowProps, 'isEditing' | 'onToggleEdit'>) => {
  const [draftTags, setDraftTags] = useState<string[]>(
    (txn.tags || []).map((t) => t.name),
  );
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    try {
      await onSetTags(draftTags);
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = async (value: string) => {
    if (value === '') {
      await onSetCategory(null);
    } else {
      await onSetCategory(Number(value));
    }
  };

  const createAndAssign = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setCreatingCat(true);
    try {
      const c = await onCreateCategory(name);
      await onSetCategory(c.id);
      setNewCatName('');
    } catch (e: any) {
      alert(e.message ?? String(e));
    } finally {
      setCreatingCat(false);
    }
  };

  return (
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
          <button type="button" onClick={saveTags} disabled={saving} style={primarySmallBtn}>
            {saving ? 'Saving…' : 'Save tags'}
          </button>
        </div>
      </div>

      <div style={{ minWidth: 280 }}>
        <div style={editorLabel}>Category</div>
        <select
          value={txn.categoryId ?? ''}
          onChange={(e) => handleCategoryChange(e.target.value)}
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
  );
};

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
