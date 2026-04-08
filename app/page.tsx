'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Member } from '@/lib/data';
import FamilyTree from '@/components/FamilyTree';
import MemberModal from '@/components/MemberModal';
import ProfilePanel from '@/components/ProfilePanel';

type Tab = 'tree' | 'list' | 'profile';

function genOf(id: number, members: Member[], visited = new Set<number>()): number {
  if (visited.has(id)) return 0;
  visited.add(id);
  const m = members.find(x => x.id === id);
  if (!m || !m.parents.length) return 0;
  const valid = m.parents.filter(p => members.find(x => x.id === p));
  if (!valid.length) return 0;
  return Math.max(...valid.map(p => genOf(p, members, new Set(visited)))) + 1;
}

export default function HomePage() {
  const { data: session } = useSession();
  const isAdmin = !!(session?.user as { role?: string })?.role;

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('tree');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{
    open: boolean;
    relatedId?: number;
    relType?: 'parent' | 'child' | 'spouse';
    editMember?: Member | null;
  }>({ open: false });

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/members');
    const data = await res.json();
    setMembers(data);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const selectedMember = members.find(m => m.id === selectedId) || null;

  const stats = {
    total: members.length,
    men: members.filter(m => m.gender === 'M').length,
    women: members.filter(m => m.gender === 'F').length,
    deceased: members.filter(m => m.dead).length,
    generations: new Set(members.map(m => genOf(m.id, members))).size,
  };

  const handleAddRelative = (id: number, type: 'parent' | 'child' | 'spouse') => {
    setModal({ open: true, relatedId: id, relType: type });
  };

  const handleSave = async (data: Partial<Member> & { relatedId?: number; relType?: string }) => {
    if (modal.editMember) {
      await fetch(`/api/members/${modal.editMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const newM = await res.json();
      setSelectedId(newM.id);
    }
    await fetchMembers();
    setModal({ open: false });
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/members/${id}`, { method: 'DELETE' });
    setSelectedId(null);
    await fetchMembers();
  };

  const handleSelect = (id: number) => {
    setSelectedId(id);
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.birthPlace || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
      <header style={{
        background: '#fff', borderBottom: '1px solid #E5E7EB',
        padding: '0 1.5rem', height: 56,
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🌳</span>
          <div>
            <h1 className="font-display" style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.2 }}>
              Famille GHUSSEIN
            </h1>
            <div style={{ fontSize: 9, color: '#9CA3AF', letterSpacing: 1.5, textTransform: 'uppercase' }}>Arbre Généalogique</div>
          </div>
        </div>
        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: '#DAA520', color: '#3D2B1F', fontWeight: 600, letterSpacing: 1 }}>SAYELE</span>
        <div style={{ flex: 1 }} />
        {isAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#EAF3DE', color: '#2D5016', border: '1px solid #BBF7D0', fontWeight: 500 }}>✓ Admin</span>
            <button onClick={() => setModal({ open: true })} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#4A7A1E', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-dm), sans-serif', fontWeight: 500 }}>+ Ajouter</button>
            <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-dm), sans-serif' }}>Déconnexion</button>
          </div>
        ) : (
          <a href="/login" style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 12, textDecoration: 'none', fontFamily: 'var(--font-dm), sans-serif' }}>Admin →</a>
        )}
      </header>

      <main style={{ padding: '1.25rem 1.5rem', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[{ n: stats.total, l: 'Membres' }, { n: stats.men, l: 'Hommes' }, { n: stats.women, l: 'Femmes' }, { n: stats.generations, l: 'Générations' }, { n: stats.deceased, l: 'Décédés' }].map(({ n, l }) => (
            <div key={l} style={{ flex: '1 1 80px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A' }}>{n}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', marginBottom: '1.25rem' }}>
          {(['tree', 'list', 'profile'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', border: 'none', borderBottom: `2px solid ${tab === t ? '#4A7A1E' : 'transparent'}`, background: 'none', color: tab === t ? '#4A7A1E' : '#6B7280', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-dm), sans-serif', fontWeight: tab === t ? 500 : 400 }}>
              {t === 'tree' ? '🌳 Arbre' : t === 'list' ? '📋 Liste' : '👤 Profil'}
            </button>
          ))}
        </div>

        {tab === 'tree' && (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, fontSize: 10, color: '#6B7280' }}>
              {[{ color: '#1E5FA8', label: 'Homme' }, { color: '#B8860B', label: 'Femme' }, { color: '#9CA3AF', label: 'Décédé(e)' }].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <FamilyTree members={members} selectedId={selectedId} isAdmin={isAdmin} onSelect={handleSelect} onAddRelative={handleAddRelative} />
          </>
        )}

        {tab === 'list' && (
          <div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre…" style={{ width: '100%', padding: '9px 13px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, background: '#fff', color: '#1A1A1A', fontFamily: 'var(--font-dm), sans-serif', outline: 'none', marginBottom: 12 }} />
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
              {filteredMembers.map((m, i) => (
                <div key={m.id} onClick={() => { handleSelect(m.id); setTab('profile'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < filteredMembers.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: m.dead ? '#9CA3AF' : m.gender === 'M' ? '#1E5FA8' : m.gender === 'F' ? '#B8860B' : '#6B7280', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500 }}>
                    {m.name.split(' ').map((w: string) => w[0] || '').slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>{m.name}{m.dead ? ' ✝' : ''}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>{[m.birth, m.birthPlace].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'right' }}>{m.children.length} enf.<br />G{genOf(m.id, members) + 1}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          !selectedMember
            ? <div style={{ textAlign: 'center', padding: '3rem', color: '#9CA3AF', fontSize: 13 }}>Cliquez sur un membre dans l&apos;arbre ou la liste.</div>
            : <ProfilePanel member={selectedMember} members={members} isAdmin={isAdmin} onSelect={handleSelect} onEdit={m => setModal({ open: true, editMember: m })} onDelete={handleDelete} onAddRelative={handleAddRelative} onRelationChange={fetchMembers} />
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: '1.5rem', fontSize: 10, color: '#9CA3AF', letterSpacing: 1.5, textTransform: 'uppercase', borderTop: '1px solid #F3F4F6', marginTop: '2rem' }}>
        SAYELE GROUP · Arbre Dynastique GHUSSEIN · Confidentiel
      </footer>

      {modal.open && (
        <MemberModal members={members} relatedId={modal.relatedId} relType={modal.relType} editMember={modal.editMember} onSave={handleSave} onClose={() => setModal({ open: false })} />
      )}
    </div>
  );
}
