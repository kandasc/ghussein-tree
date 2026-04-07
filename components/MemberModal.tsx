'use client';
import { useState, useEffect } from 'react';
import { Member } from '@/lib/data';

interface Props {
  members: Member[];
  relatedId?: number;
  relType?: 'parent' | 'child' | 'spouse';
  editMember?: Member | null;
  onSave: (data: Partial<Member> & { relatedId?: number; relType?: string }) => Promise<void>;
  onClose: () => void;
}

export default function MemberModal({ members, relatedId, relType, editMember, onSave, onClose }: Props) {
  const [name, setName] = useState(editMember?.name || '');
  const [gender, setGender] = useState<'M' | 'F' | ''>(editMember?.gender || '');
  const [birth, setBirth] = useState(editMember?.birth || '');
  const [birthPlace, setBirthPlace] = useState(editMember?.birthPlace || '');
  const [dead, setDead] = useState(editMember?.dead || false);
  const [deathInfo, setDeathInfo] = useState(editMember?.deathInfo || '');
  const [note, setNote] = useState(editMember?.note || '');
  const [selectedRelType, setSelectedRelType] = useState(relType || '');
  const [loading, setLoading] = useState(false);

  const related = relatedId ? members.find(m => m.id === relatedId) : null;
  const title = editMember ? `Modifier ${editMember.name}` : relatedId ? `Ajouter un membre lié à ${related?.name}` : 'Nouveau membre';

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        gender,
        birth,
        birthPlace,
        dead,
        deathInfo,
        note,
        parents: editMember?.parents || [],
        children: editMember?.children || [],
        spouses: editMember?.spouses || [],
        relatedId,
        relType: selectedRelType,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 10px',
    border: '1px solid #E5E7EB', borderRadius: 7,
    fontSize: 13, background: '#fff', color: '#1A1A1A',
    fontFamily: 'var(--font-dm), sans-serif', outline: 'none',
  };

  const labelStyle = {
    display: 'block', fontSize: 10, color: '#6B7280',
    marginBottom: 4, fontWeight: 500,
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FAFAF7', borderRadius: 14, padding: '1.75rem 1.5rem',
          width: 380, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        }}
        className="fade-in"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 className="font-display" style={{ fontSize: 17, fontWeight: 600, color: '#1A1A1A' }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9CA3AF', padding: '0 4px' }}>×</button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Prénom & Nom *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="ex: GHUSSEIN Prénom" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Genre</label>
              <select style={inputStyle} value={gender} onChange={e => setGender(e.target.value as 'M' | 'F' | '')}>
                <option value="">Non spécifié</option>
                <option value="M">Homme</option>
                <option value="F">Femme</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Statut</label>
              <select style={inputStyle} value={dead ? '1' : '0'} onChange={e => setDead(e.target.value === '1')}>
                <option value="0">Vivant(e)</option>
                <option value="1">Décédé(e)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Date de naissance</label>
              <input style={inputStyle} value={birth} onChange={e => setBirth(e.target.value)} placeholder="JJ/MM/AAAA" />
            </div>
            <div>
              <label style={labelStyle}>Lieu de naissance</label>
              <input style={inputStyle} value={birthPlace} onChange={e => setBirthPlace(e.target.value)} placeholder="Ville, Pays" />
            </div>
          </div>

          {dead && (
            <div>
              <label style={labelStyle}>Informations sur le décès</label>
              <input style={inputStyle} value={deathInfo} onChange={e => setDeathInfo(e.target.value)} placeholder="ex: 25/11/2013 à Conakry" />
            </div>
          )}

          {relatedId && !editMember && (
            <div>
              <label style={labelStyle}>Lien avec {related?.name}</label>
              <select style={inputStyle} value={selectedRelType} onChange={e => setSelectedRelType(e.target.value)}>
                <option value="">Aucun lien direct</option>
                <option value="parent">Parent de {related?.name}</option>
                <option value="child">Enfant de {related?.name}</option>
                <option value="spouse">Conjoint(e) de {related?.name}</option>
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Note / Origine</label>
            <input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="ex: Fils de… Originaire de…" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 7, border: '1px solid #E5E7EB',
              background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-dm), sans-serif',
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: loading || !name.trim() ? '#9CA3AF' : '#4A7A1E',
              color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-dm), sans-serif', fontWeight: 500,
            }}
          >
            {loading ? 'Enregistrement…' : editMember ? 'Mettre à jour' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
