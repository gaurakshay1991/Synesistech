export function formatDate(value) {
  if (!value || value === 'Event driven' || value === 'Continuous' || value === 'Daily' || value === 'To be determined') return value || '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

export function downloadJson(filename, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function tone(value = '') { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

export function Modal({ title, onClose, children, wide = false }) { return <div className="modal-backdrop"><div className={`modal ${wide ? 'wide' : ''}`}><header><div><small>SYNESIS CONTROLLED ACTION</small><h2>{title}</h2></div><button className="icon" onClick={onClose}>×</button></header>{children}</div></div>; }
export function Panel({ title, subtitle, children }) { return <article className="panel"><header><div><h3>{title}</h3><p>{subtitle}</p></div></header>{children}</article>; }
export function RiskBadge({ value }) { return <span className={`risk ${tone(value)}`}>{value || 'Unrated'}</span>; }
export function Status({ value }) { return <span className={`status ${tone(value)}`}>{value || '—'}</span>; }
export function KeyValue({ label, value }) { return <div className="key-value"><span>{label}</span><strong>{value ?? '—'}</strong></div>; }
export function MiniProgress({ value = 0 }) { return <div className="mini-progress"><div><i style={{ width: `${value}%` }} /></div><span>{value}%</span></div>; }
export function ProgressRow({ label, value, meta }) { return <div className="progress-row"><div><strong>{label}</strong><small>{meta}</small></div><div><i style={{ width: `${value}%` }} /></div><b>{value}%</b></div>; }
