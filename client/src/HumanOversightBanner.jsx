import { ShieldCheck, Users } from 'lucide-react';

export default function HumanOversightBanner() {
  return (
    <section
      role="note"
      aria-label="Human oversight policy"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '10px 18px',
        borderBottom: '1px solid rgba(15, 23, 42, 0.12)',
        background: 'linear-gradient(90deg, rgba(239,246,255,.98), rgba(240,253,250,.98))',
        color: '#0f172a',
        fontSize: '13px',
        lineHeight: 1.45,
        textAlign: 'center',
        flexWrap: 'wrap'
      }}
    >
      <ShieldCheck size={18} aria-hidden="true" />
      <strong>Human accountable. AI advisory.</strong>
      <span>
        A named authorised reviewer owns every consequential decision and must record the rationale.
      </span>
      <Users size={18} aria-hidden="true" />
      <span>
        Synesis does not autonomously hire, reject, fire, promote, discipline, rank or set compensation.
      </span>
    </section>
  );
}
