'use client';
import { Member } from '@/lib/data';

interface Props {
  member: Member;
  members: Member[];
  isAdmin: boolean;
  onSelect: (id: number) => void;
  onEdit: (m: Member) => void;
  onDelete: (id: number) => void;
  onAddRelative: (id: number, type: 'parent' | 'child' | 'spouse') => void;
}

const COLORS = { M: '#1E5FA8', F: '#B8860B', '': '#6B7280' };

function initials(name: string) {
  return name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
}

function genOf(id: number, members: Member[], visited = new Set<number>()): number {
  if (visited.has(id)) return 0;
  visited.add(id);
  const m = members.find(x => x.id === id);
  if (!m || !m.parents.length) return 0;
  const pg = m.parents.filter(p => members.find(x => x.id === p)).map(p => genOf(p, members, new Set(visited)));
  return Math.max(...pg) + 1;
}

export default function ProfilePanel({ member, members, isAdmin, onSelect, onEdit, onDelete, onAddRelative }: Props) {
  const color = member.dead ? '#9CA3AF' : COLORS[member.gender || ''];
  const gen = genOf(member.id, members);

  const RelPills = ({ label, ids }: { label: string; ids: number[] }) => {
    const valid = [...new Set(ids)].filter(id => members.find(m => m.id === id));
    if (!valid.length) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500 }}>{label}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {valid.map(id => {
            const rel = members.find(m => m.id === id);
            return rel ? (
              <button
                key={id}
                onClick={() => onSelect(id)}
                style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 20,
                  background: '#F3F4F6', border: '1px solid #E5E7EB',
                  cursor: 'pointer', color: '#374151',
                  fontFamily: 'var(--font-dm), sans-serif',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = '#4A7A1E'; (e.target as HTMLButtonElement).style.color = '#4A7A1E'; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = '#E5E7EB'; (e.target as HTMLButtonElement).style.color = '#374151'; }}
              >
                {rel.name}
              </button>
            ) : null;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{
      background: '#fff', border: '1px solid #E5E7EB',
      borderRadius: 12, padding: '1.25rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1rem' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 500, flexShrink: 0,
        }}>
          {initials(member.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>
            {member.name}
            {member.dead && <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: 12, marginLeft: 5 }}>✝</span>}
          </h3>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            {member.gender === 'M' ? 'Homme' : member.gender === 'F' ? 'Femme' : '—'} · Génération {gen + 1}
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        {[
          { label: 'Naissance', value: member.birth || '—' },
          { label: 'Lieu', value: member.birthPlace || '—' },
          ...(member.dead && member.deathInfo ? [{ label: 'Décès', value: member.deathInfo }] : []),
          ...(member.note ? [{ label: 'Note', value: member.note }] : []),
        ].map(({ label, value }, i) => (
          <div key={i} style={{
            background: '#F9FAFB', borderRadius: 8, padding: '6px 10px',
            gridColumn: label === 'Note' || (member.dead && label === 'Décès') ? 'span 2' : undefined,
          }}>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Relations */}
      <RelPills label="Parents" ids={member.parents} />
      <RelPills label="Enfants" ids={member.children} />
      <RelPills label="Conjoint(e)s" ids={member.spouses} />

      {/* Admin actions */}
      {isAdmin && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button onClick={() => onAddRelative(member.id, 'child')} style={btnStyle('#4A7A1E', '#fff')}>+ Enfant</button>
          <button onClick={() => onAddRelative(member.id, 'parent')} style={btnStyle('#fff', '#374151', '#E5E7EB')}>+ Parent</button>
          <button onClick={() => onAddRelative(member.id, 'spouse')} style={btnStyle('#fff', '#374151', '#E5E7EB')}>+ Conjoint(e)</button>
          <button onClick={() => onEdit(member)} style={btnStyle('#EFF6FF', '#1E5FA8', '#BFDBFE')}>✎ Modifier</button>
          <button
            onClick={() => { if (confirm(`Supprimer ${member.name} ?`)) onDelete(member.id); }}
            style={btnStyle('#FEF2F2', '#B91C1C', '#FECACA')}
          >✕ Supprimer</button>
        </div>
      )}
    </div>
  );
}

function btnStyle(bg: string, color: string, border = bg) {
  return {
    padding: '6px 12px', borderRadius: 7,
    border: `1px solid ${border}`, background: bg, color,
    fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-dm), sans-serif',
    fontWeight: 500 as const,
  };
}
