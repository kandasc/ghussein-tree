'use client';
import { useState, useRef } from 'react';
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
const RANK_LABELS: Record<number, string> = {
  1:'1er', 2:'2ème', 3:'3ème', 4:'4ème', 5:'5ème',
  6:'6ème', 7:'7ème', 8:'8ème', 9:'9ème', 10:'10ème',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
}

function genOf(id: number, members: Member[], visited = new Set<number>()): number {
  if (visited.has(id)) return 0; visited.add(id);
  const m = members.find(x => x.id === id);
  if (!m || !m.parents.length) return 0;
  const valid = m.parents.filter(p => members.find(x => x.id === p));
  if (!valid.length) return 0;
  return Math.max(...valid.map(p => genOf(p, members, new Set(visited)))) + 1;
}

type RelType = 'parents' | 'children' | 'spouses';

export default function ProfilePanel({ member, members, isAdmin, onSelect, onEdit, onDelete, onAddRelative, onRelationChange }: Props) {
  const [editingRel, setEditingRel] = useState<RelType | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const color = member.dead ? '#9CA3AF' : COLORS[member.gender || ''];
  const gen = genOf(member.id, members);

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 2500); };

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('memberId', String(member.id));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        showMsg('✓ Photo mise à jour');
        onRelationChange?.();
      } else {
        showMsg('Erreur : ' + (data.error || 'inconnue'));
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Relation management ───────────────────────────────────────────────────
  const addRelation = async (relType: RelType, targetId: number) => {
    setSaving(true);
    try {
      const current = [...new Set([...(member[relType] as number[]), targetId])];
      await fetch(`/api/members/${member.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [relType]: current }),
      });
      const target = members.find(m => m.id === targetId);
      if (target) {
        const mirror: RelType = relType==='parents'?'children':relType==='children'?'parents':'spouses';
        const mc = [...new Set([...(target[mirror] as number[]), member.id])];
        await fetch(`/api/members/${targetId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [mirror]: mc }),
        });
      }
      showMsg(`✓ ${members.find(m=>m.id===targetId)?.name} ajouté(e)`);
      onRelationChange?.();
    } finally { setSaving(false); }
  };

  const removeRelation = async (relType: RelType, targetId: number) => {
    setSaving(true);
    try {
      const current = (member[relType] as number[]).filter(id => id !== targetId);
      await fetch(`/api/members/${member.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [relType]: current }),
      });
      const target = members.find(m => m.id === targetId);
      if (target) {
        const mirror: RelType = relType==='parents'?'children':relType==='children'?'parents':'spouses';
        const mc = (target[mirror] as number[]).filter(id => id !== member.id);
        await fetch(`/api/members/${targetId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [mirror]: mc }),
        });
      }
      showMsg('✓ Lien supprimé');
      onRelationChange?.();
    } finally { setSaving(false); }
  };

  const availableMembers = (relType: RelType) => {
    const current = member[relType] as number[];
    return members.filter(m =>
      m.id !== member.id && !current.includes(m.id) &&
      (searchQ==='' || m.name.toLowerCase().includes(searchQ.toLowerCase()))
    );
  };

  const RelSection = ({ relType }: { relType: RelType }) => {
    const labels: Record<RelType,string> = { parents:'Parents', children:'Enfants', spouses:'Conjoint(e)s' };
    const current = [...new Set(member[relType] as number[])]
      .map(id => members.find(m => m.id===id)).filter(Boolean) as Member[];
    const isEditing = editingRel === relType;

    return (
      <div style={{ marginTop:12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
          <span style={{ fontSize:10, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.8, fontWeight:500 }}>
            {labels[relType]} ({current.length})
          </span>
          {isAdmin && (
            <button onClick={() => { setEditingRel(isEditing?null:relType); setSearchQ(''); }}
              style={{ fontSize:10, padding:'3px 8px', borderRadius:6,
                border:`1px solid ${isEditing?'#BBF7D0':'#E5E7EB'}`,
                background:isEditing?'#EAF3DE':'#F9FAFB', color:isEditing?'#2D5016':'#6B7280',
                cursor:'pointer', fontFamily:'var(--font-dm),sans-serif' }}>
              {isEditing ? '✕ Fermer' : '✎ Modifier'}
            </button>
          )}
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {!current.length && !isEditing && <span style={{ fontSize:11, color:'#D1D5DB', fontStyle:'italic' }}>Aucun(e)</span>}
          {current.map(rel => (
            <div key={rel.id} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11,
              padding:'3px 8px', borderRadius:20, background:'#F3F4F6', border:'1px solid #E5E7EB' }}>
              {rel.photoUrl && <img src={rel.photoUrl} style={{ width:16,height:16,borderRadius:'50%',objectFit:'cover' }} />}
              <span onClick={() => onSelect(rel.id)} style={{ cursor:'pointer', color:'#374151' }}
                onMouseEnter={e=>(e.currentTarget.style.color='#4A7A1E')}
                onMouseLeave={e=>(e.currentTarget.style.color='#374151')}>
                {rel.name}
              </span>
              {isEditing && (
                <button onClick={() => removeRelation(relType, rel.id)} disabled={saving}
                  style={{ background:'none',border:'none',cursor:'pointer',color:'#EF4444',fontSize:12,padding:'0 2px',lineHeight:1 }}>×</button>
              )}
            </div>
          ))}
        </div>
        {isEditing && (
          <div style={{ marginTop:8, background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:10, color:'#6B7280', marginBottom:6 }}>
              Ajouter un(e) {labels[relType].toLowerCase().slice(0,-1)} :
            </div>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Rechercher…"
              style={{ width:'100%', padding:'6px 9px', border:'1px solid #E5E7EB', borderRadius:6,
                fontSize:12, background:'#fff', color:'#1A1A1A',
                fontFamily:'var(--font-dm),sans-serif', outline:'none', marginBottom:6 }} />
            <div style={{ maxHeight:150, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
              {!availableMembers(relType).length && <div style={{ fontSize:11, color:'#9CA3AF', padding:'4px 0' }}>Aucun membre disponible</div>}
              {availableMembers(relType).map(m => (
                <div key={m.id} onClick={() => !saving && addRelation(relType, m.id)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px', borderRadius:6, cursor:saving?'not-allowed':'pointer' }}
                  onMouseEnter={e=>(e.currentTarget.style.background='#EAF3DE')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                  {m.photoUrl ? (
                    <img src={m.photoUrl} style={{ width:24,height:24,borderRadius:'50%',objectFit:'cover',flexShrink:0 }} />
                  ) : (
                    <div style={{ width:24,height:24,borderRadius:'50%',flexShrink:0,
                      background:m.dead?'#9CA3AF':COLORS[m.gender||''],
                      color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:500 }}>
                      {initials(m.name)}
                    </div>
                  )}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:'#1A1A1A' }}>{m.name}</div>
                    <div style={{ fontSize:9, color:'#9CA3AF' }}>{m.birth} {m.birthPlace}</div>
                  </div>
                  <span style={{ fontSize:10, color:'#4A7A1E', fontWeight:500 }}>+ Ajouter</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const btnStyle = (bg: string, col: string, border = bg) => ({
    padding:'5px 11px', borderRadius:6, border:`1px solid ${border}`,
    background:bg, color:col, fontSize:11, cursor:'pointer',
    fontFamily:'var(--font-dm),sans-serif', fontWeight:500 as const,
  });

  return (
    <div className="fade-in" style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, padding:'1.25rem' }}>
      {msg && (
        <div style={{ background:'#EAF3DE', border:'1px solid #BBF7D0', borderRadius:7,
          padding:'6px 12px', fontSize:12, color:'#2D5016', marginBottom:12 }}>{msg}</div>
      )}

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:'1rem' }}>
        {/* Photo / Avatar */}
        <div style={{ position:'relative', flexShrink:0 }}>
          {member.photoUrl ? (
            <img src={member.photoUrl} alt={member.name}
              style={{ width:60, height:60, borderRadius:'50%', objectFit:'cover', border:`2px solid ${color}` }} />
          ) : (
            <div style={{ width:60, height:60, borderRadius:'50%', background:color, color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, fontWeight:500 }}>
              {initials(member.name)}
            </div>
          )}
          {/* Upload button (admin only) */}
          {isAdmin && (
            <>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                title="Changer la photo"
                style={{ position:'absolute', bottom:-2, right:-2,
                  width:20, height:20, borderRadius:'50%',
                  background: uploading ? '#9CA3AF' : '#4A7A1E',
                  border:'2px solid #fff', color:'#fff',
                  fontSize:10, cursor:uploading?'not-allowed':'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                {uploading ? '…' : '📷'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={handlePhotoUpload} />
            </>
          )}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <h3 className="font-display" style={{ fontSize:16, fontWeight:600, color:'#1A1A1A', lineHeight:1.3 }}>
            {member.name}
            {member.dead && <span style={{ color:'#9CA3AF', fontSize:12, marginLeft:6, fontStyle:'italic' }}>✝</span>}
          </h3>
          <div style={{ fontSize:11, color:'#6B7280', marginTop:2 }}>
            {member.gender==='M'?'Homme':member.gender==='F'?'Femme':'—'} · Génération {gen+1}
            {member.rank && <span style={{ marginLeft:6, color:'#4A7A1E', fontWeight:500 }}>{RANK_LABELS[member.rank]||`${member.rank}e`} enfant</span>}
          </div>
        </div>
      </div>

      {/* ── Detail grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:4 }}>
        {[
          { label:'Naissance', value:member.birth||'—' },
          { label:'Lieu', value:member.birthPlace||'—' },
          ...(member.dead&&member.deathInfo?[{ label:'Décès', value:member.deathInfo }]:[]),
          ...(member.note?[{ label:'Note', value:member.note }]:[]),
        ].map(({label,value},i) => (
          <div key={i} style={{ background:'#F9FAFB', borderRadius:8, padding:'6px 10px',
            gridColumn:(label==='Note'||label==='Décès')?'span 2':undefined }}>
            <div style={{ fontSize:9, color:'#9CA3AF', marginBottom:2, textTransform:'uppercase', letterSpacing:0.8 }}>{label}</div>
            <div style={{ fontSize:12, fontWeight:500, color:'#374151' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Relations ── */}
      <RelSection relType="parents" />
      <RelSection relType="children" />
      <RelSection relType="spouses" />

      {/* ── Admin actions ── */}
      {isAdmin && (
        <div style={{ marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid #F3F4F6', display:'flex', gap:7, flexWrap:'wrap' }}>
          <button onClick={() => onEdit(member)} style={btnStyle('#EFF6FF','#1E5FA8','#BFDBFE')}>✎ Modifier</button>
          <button onClick={() => { if(confirm(`Supprimer ${member.name} ?`)) onDelete(member.id); }}
            style={btnStyle('#FEF2F2','#B91C1C','#FECACA')}>✕ Supprimer</button>
        </div>
      )}
    </div>
  );
}
