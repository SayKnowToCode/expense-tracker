import { useState } from 'react';
import { api, type ImportSummary } from '../api/client';
import { parseHdfcCsv, type HdfcParseResult } from '../lib/hdfcCsv';

type Status =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'parsed'; preview: HdfcParseResult; csv: string; fileName: string }
  | { kind: 'uploading' }
  | { kind: 'done'; summary: ImportSummary; preview: HdfcParseResult }
  | { kind: 'error'; message: string };

const ImportCsvPage = () => {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const onFile = async (file: File) => {
    setStatus({ kind: 'parsing' });
    try {
      const csv = await file.text();
      const preview = parseHdfcCsv(csv);
      if (preview.rows.length === 0) {
        setStatus({
          kind: 'error',
          message:
            'No transactions found in this file. Are you sure it is an HDFC bank statement export?',
        });
        return;
      }
      setStatus({ kind: 'parsed', preview, csv, fileName: file.name });
    } catch (err: any) {
      setStatus({ kind: 'error', message: err.message ?? String(err) });
    }
  };

  const upload = async () => {
    if (status.kind !== 'parsed') return;
    const { csv, fileName, preview } = status;
    setStatus({ kind: 'uploading' });
    try {
      const summary = await api.importCsv({
        fileName,
        originalCsv: csv,
        parsedRows: preview.rows,
      });
      setStatus({ kind: 'done', summary, preview });
    } catch (err: any) {
      setStatus({ kind: 'error', message: err.message ?? String(err) });
    }
  };

  const reset = () => setStatus({ kind: 'idle' });

  return (
    <div style={{ padding: 24, maxWidth: 880, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Import bank statement
      </h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Upload your HDFC bank statement CSV. Re-uploading the same statement
        is a no-op — only genuinely new transactions are added.
      </p>

      {status.kind === 'idle' || status.kind === 'error' ? (
        <label
          style={{
            display: 'block',
            padding: 32,
            border: '2px dashed #bbb',
            borderRadius: 8,
            textAlign: 'center',
            cursor: 'pointer',
            background: '#fafafa',
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 500 }}>Click to choose a CSV file</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Tested with HDFC `Acct Statement_*.csv` exports
          </div>
        </label>
      ) : null}

      {status.kind === 'error' ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#fdecea',
            color: '#a32f2a',
            borderRadius: 6,
          }}
        >
          <strong>Could not parse file.</strong> {status.message}
        </div>
      ) : null}

      {status.kind === 'parsing' ? <p>Parsing…</p> : null}

      {status.kind === 'parsed' ? (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              padding: 12,
              background: '#eef6ff',
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            Parsed <strong>{status.preview.rows.length}</strong> transactions
            from <code>{status.fileName}</code>
            {status.preview.skipped > 0
              ? ` (${status.preview.skipped} non-transaction rows skipped)`
              : ''}
            .
          </div>
          <PreviewTable preview={status.preview} />
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={upload} style={primaryBtn}>
              Upload to expense tracker
            </button>
            <button onClick={reset} style={secondaryBtn}>
              Choose a different file
            </button>
          </div>
        </div>
      ) : null}

      {status.kind === 'uploading' ? <p style={{ marginTop: 16 }}>Uploading…</p> : null}

      {status.kind === 'done' ? (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              padding: 16,
              background: '#e7f6ec',
              color: '#1f6b3a',
              borderRadius: 6,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
              Import #{status.summary.importId} complete
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>
                <strong>{status.summary.createdCount}</strong> new transactions
                added
              </li>
              <li>
                <strong>{status.summary.duplicateCount}</strong> already
                existed and were skipped
              </li>
              <li>
                <strong>{status.summary.totalRows}</strong> total rows in the
                file
              </li>
            </ul>
          </div>
          <button onClick={reset} style={{ ...secondaryBtn, marginTop: 16 }}>
            Upload another statement
          </button>
        </div>
      ) : null}
    </div>
  );
};

const PreviewTable = ({ preview }: { preview: HdfcParseResult }) => {
  const sample = preview.rows.slice(0, 8);
  return (
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
          {sample.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #eee' }}>
              <td style={td}>{r.transactionDate}</td>
              <td style={{ ...td, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.description}
              </td>
              <td style={td}>{r.referenceNumber || <em style={{ color: '#999' }}>—</em>}</td>
              <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {r.amount.toFixed(2)}
              </td>
              <td style={td}>{r.debitOrCredit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview.rows.length > sample.length ? (
        <div style={{ padding: 8, fontSize: 12, color: '#888' }}>
          …and {preview.rows.length - sample.length} more rows.
        </div>
      ) : null}
    </div>
  );
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontWeight: 600,
};
const td: React.CSSProperties = { padding: '6px 10px' };
const primaryBtn: React.CSSProperties = {
  background: '#1f6feb',
  color: 'white',
  border: 'none',
  padding: '10px 18px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
};
const secondaryBtn: React.CSSProperties = {
  background: 'white',
  color: '#333',
  border: '1px solid #ccc',
  padding: '10px 18px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
};

export default ImportCsvPage;
