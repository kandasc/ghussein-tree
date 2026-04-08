'use client';
import { useState } from 'react';
import { Member } from '@/lib/data';

interface Props {
  member: Member;
  members: Member[];
  isAdmin: boolean;
  onSelect: (id: number) => void;
  onEdit: (m: Member) => void;
  onDelete: (id: number) => void;
  onAddRelative: (id: number, type: 'parent' | 'child' | 'spouse') => void;
  onRelationChange?: () => void;
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
  const valid = m.parents.filter(p => members.find(x => x.id === p));
  if (!valid.length) return 0;
  return Math.max(...valid.map(p => genOf(p, members, new Set(visited)))) + 1;
}

type RelationType = 'parents' | 'children' | 'spouses';

export default function ProfilePanel({ member, members, isAdmin, onSelect, onEdit, onDelete, onAddRelative, onRelationChange }: Props) {
  const [editingRel, setEditingRel] = useState<RelationType | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const color = member.dead ? '#9CA3AF' : COLORS[member.gender || ''];
  const gen = genOf(member.id, members);

  // Members not already in this relation and not self
  const availableMembers = (relType: RelationType) => {
    const current = member[relType] as number[];
    return members.filter(m =>
      m.id !== member.id &&
      !current.includes(m.id) &&
      (searchQ === '' || m.name.toLowerCase().includes(searchQ.toLowerCase()))
    );
  };

  const currentRelMembers = (relType: RelationType) => {
    const ids = [...new Set(member[relType] as number[])];
    return ids.map(id => members.find(m => m.id === id)).filter(Boolean) as Member[];
  };

  const relLabels: Record<RelationType, string> = {
    parents: 'Parents',
    children: 'Enfants',
    spouses: 'Conjoint(e)s',
  };

  // Add a relation
  const addRelation = async (relType: RelationType, targetId: number) => {
    setSaving(true);
    try {
      const current = [...new Set([...(member[relType] as number[]), targetId])];
      await fetch(`/api/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [relType]: current }),
      });

      // Mirror relationship
      const target = members.find(m => m.id === targetId);
      if (target) {
        const mirrorField: RelationType =
          relType === 'parents' ? 'children' :
          relType === 'children' ? 'parents' : 'spouses';
        const mirrorCurrent = [...new Set([...(target[mirrorField] as number[]), member.id])];
        await fetch(`/api/members/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [mirrorField]: mirrorCurrent }),
        });
      }

      setMsg(`✓ ${members.find(m => m.id === targetId)?.name} ajouté(e)`);
      setTimeout(() => setMsg(''), 2000);
      onRelationChange?.();
    } finally {
      setSaving(false);
    }
  };

  // Remove a relation
  const removeRelation = async (relType: RelationType, targetId: number) => {
    setSaving(true);
    try {
      const current = (member[relType] as number[]).filter(id => id !== targetId);
      await fetch(`/api/members/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [relType]: current }),
      });

      // Mirror removal
      const target = members.find(m => m.id === targetId);
      if (target) {
        const mirrorField: RelationType =
          relType === 'parents' ? 'children' :
          relType === 'children' ? 'parents' : 'spouses';
        const mirrorCurrent = (target[mirrorField] as number[]).filter(id => id !== member.id);
        await fetch(`/api/members/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [mirrorField]: mirrorCurrent }),
        });
      }

      setMsg(`✓ Lien supprimé`);
      setTimeout(() => setMsg(''), 2000);
      onRelationChange?.();
    } finally {
      setSaving(false);
    }
  };

  const btn = (bg: string, color: string, border = bg) => ({
    padding: '5px 11px', borderRadius: 6,
    border: `1px solid ${border}`, background: bg, color,
    fontSize: 11, cursor: 'pointer',
    fontFamily: 'var(--font-dm), sans-serif', fontWeight: 500 as const,
  });

  const RelSection = ({ relType }: { relType: RelationType }) => {
    const current = currentRelMembers(relType);
    const isEditing = editingRel === relType;
    const available = availableMembers(relType);

    return (
      <div style={{ marginTop: 12 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500 }}>
            {relLabels[relType]} ({current.length})
          </span>
          {isAdmin && (
            <button
              onClick={() => { setEditingRel(isEditing ? null : relType); setSearchQ(''); }}
              style={{ ...btn(isEditing ? '#EAF3DE' : '#F9FAFB', isEditing ? '#2D5016' : '#6B7280', isEditing ? '#BBF7D0' : '#E5E7EB'), fontSize: 10, padding: '3px 8px' }}
            >
              {isEditing ? '✕ Fermer' : '✎ Modifier'}
            </button>
          )}
        </div>

        {/* Current relations */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {current.length === 0 && !isEditing && (
            <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic' }}>Aucun(e)</span>
          )}
          {current.map(rel => (
            <div key={rel.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '3px 8px', borderRadius: 20,
              background: '#F3F4F6', border: '1px solid #E5E7EB',
            }}>
              <span
                onClick={() => onSelect(rel.id)}
                style={{ cursor: 'pointer', color: '#374151' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#4A7A1E')}
                onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
              >
                {rel.name}
              </span>
              {isEditing && (
                <button
                  onClick={() => removeRelation(relType, rel.id)}
                  disabled={saving}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
                  title="Supprimer ce lien"
                >×</button>
              )}
            </div>
          ))}
        </div>

        {/* Edit panel: search + add */}
        {isEditing && (
          <div style={{
            marginTop: 8, background: '#F9FAFB', border: '1px solid #E5E7EB',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>
              Ajouter un(e) {relLabels[relType].toLowerCase().slice(0, -1)} :
            </div>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Rechercher un membre…"
              style={{
                width: '100%', padding: '6px 9px', border: '1px solid #E5E7EB',
                borderRadius: 6, fontSize: 12, background: '#fff', color: '#1A1A1A',
                fontFamily: 'var(--font-dm), sans-serif', outline: 'none', marginBottom: 6,
              }}
            />
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {available.length === 0 && (
                <div style={{ fontSize: 11, color: '#9CA3AF', padding: '4px 0' }}>Aucun membre disponible</div>
              )}
              {available.map(m => (
                <div
                  key={m.id}
                  onClick={() => !saving && addRelation(relType, m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EAF3DE')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: m.dead ? '#9CA3AF' : COLORS[m.gender || ''],
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 500,
                  }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#1A1A1A' }}>{m.name}</div>
                    <div style={{ fontSize: 9, color: '#9CA3AF' }}>{m.birth || ''} {m.birthPlace || ''}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#4A7A1E', fontWeight: 500 }}>+ Ajouter</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '1.25rem' }}>
      {/* Success message */}
      {msg && (
        <div style={{
          background: '#EAF3DE', border: '1px solid #BBF7D0', borderRadius: 7,
          padding: '6px 12px', fontSize: 12, color: '#2D5016', marginBottom: 12,
        }}>{msg}</div>
      )}

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
            {member.dead && <span style={{ color: '#9CA3AF', fontSize: 12, marginLeft: 6, fontStyle: 'italic' }}>✝</span>}
          </h3>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            {member.gender === 'M' ? 'Homme' : member.gender === 'F' ? 'Femme' : '—'} · Génération {gen + 1}
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
        {[
          { label: 'Naissance', value: member.birth || '—' },
          { label: 'Lieu', value: member.birthPlace || '—' },
          ...(member.dead && member.deathInfo ? [{ label: 'Décès', value: member.deathInfo }] : []),
          ...(member.note ? [{ label: 'Note', value: member.note }] : []),
        ].map(({ label, value }, i) => (
          <div key={i} style={{
            background: '#F9FAFB', borderRadius: 8, padding: '6px 10px',
            gridColumn: (label === 'Note' || label === 'Décès') ? 'span 2' : undefined,
          }}>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Editable relation sections */}
      <RelSection relType="parents" />
      <RelSection relType="children" />
      <RelSection relType="spouses" />

      {/* Admin actions */}
      {isAdmin && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button onClick={() => onEdit(member)} style={btn('#EFF6FF', '#1E5FA8', '#BFDBFE')}>✎ Modifier infos</button>
          <button
            onClick={() => { if (confirm(`Supprimer ${member.name} ?`)) onDelete(member.id); }}
            style={btn('#FEF2F2', '#B91C1C', '#FECACA')}
          >✕ Supprimer</button>
        </div>
      )}
    </div>
  );
}
