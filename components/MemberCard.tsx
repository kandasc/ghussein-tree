'use client';
import { Member } from '@/lib/data';

interface Props {
  member: Member;
  selected: boolean;
  isAdmin: boolean;
  onClick: () => void;
  onAddRelative: (id: number, type: 'parent' | 'child' | 'spouse') => void;
}

const COLORS = { M: '#1E5FA8', F: '#B8860B', '': '#6B7280' };
const RANK_LABELS: Record<number, string> = {
  1:'1er', 2:'2ème', 3:'3ème', 4:'4ème', 5:'5ème',
  6:'6ème', 7:'7ème', 8:'8ème', 9:'9ème', 10:'10ème',
};

function initials(name: string) {
  return name.split(' ').map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
}

export default function MemberCard({ member, selected, isAdmin, onClick, onAddRelative }: Props) {
  const color = member.dead ? '#9CA3AF' : COLORS[member.gender || ''];
  const year = member.birth ? member.birth.split('/').pop() : '';
  const meta = [year, member.birthPlace].filter(Boolean).join(' · ');

  return (
    <div onClick={onClick} style={{
      width: 152, background: '#fff',
      border: selected ? '2px solid #4A7A1E' : '1px solid #E5E7EB',
      borderRadius: 10, padding: '10px 10px 8px',
      cursor: 'pointer', textAlign: 'center', position: 'relative',
      boxShadow: selected ? '0 0 0 3px rgba(74,122,30,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
      opacity: member.dead ? 0.85 : 1, transition: 'all 0.15s ease',
    }}>
      {/* Décédé */}
      {member.dead && (
        <span style={{ position:'absolute', top:4, left:6, fontSize:9, color:'#9CA3AF', fontStyle:'italic' }}>✝</span>
      )}
      {/* Rang */}
      {member.rank && (
        <span style={{
          position:'absolute', top:4, right:6,
          fontSize:8, fontWeight:600, color:'#4A7A1E',
          background:'#EAF3DE', padding:'1px 5px', borderRadius:8,
        }}>
          {RANK_LABELS[member.rank] || `${member.rank}e`}
        </span>
      )}

      {/* Avatar — photo ou initiales */}
      {member.photoUrl ? (
        <div style={{
          width:44, height:44, borderRadius:'50%',
          margin:'0 auto 6px', overflow:'hidden',
          border: `2px solid ${color}`,
          flexShrink: 0,
        }}>
          <img
            src={member.photoUrl}
            alt={member.name}
            style={{ width:'100%', height:'100%', objectFit:'cover' }}
          />
        </div>
      ) : (
        <div style={{
          width:44, height:44, borderRadius:'50%',
          background: color, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:14, fontWeight:500, margin:'0 auto 6px',
        }}>
          {initials(member.name)}
        </div>
      )}

      {/* Nom */}
      <div style={{ fontSize:11, fontWeight:500, color:'#1A1A1A', lineHeight:1.3, marginBottom:2 }}>
        {member.name}
      </div>
      {/* Meta */}
      <div style={{ fontSize:9, color:'#9CA3AF', lineHeight:1.4 }}>
        {meta || '—'}
      </div>

      {/* Boutons admin */}
      {isAdmin && (
        <div style={{ marginTop:6, display:'flex', justifyContent:'center', gap:4 }}>
          {(['parent','child','spouse'] as const).map(type => (
            <button key={type}
              title={type==='parent'?'Parent':type==='child'?'Enfant':'Conjoint(e)'}
              onClick={e => { e.stopPropagation(); onAddRelative(member.id, type); }}
              style={{
                width:20, height:20, borderRadius:'50%',
                border:'1px dashed #4A7A1E', background:'none',
                color:'#4A7A1E', fontSize:11, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', padding:0,
              }}
            >
              {type==='parent'?'↑':type==='child'?'↓':'♥'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
