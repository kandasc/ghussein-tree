'use client';
import { useState } from 'react';
import { Member } from '@/lib/data';
import MemberCard from './MemberCard';

interface Props {
  members: Member[];
  selectedId: number | null;
  isAdmin: boolean;
  onSelect: (id: number) => void;
  onAddRelative: (id: number, type: 'parent' | 'child' | 'spouse') => void;
}

const CW = 152;
const CH = 148;
const SG = 30;
const HG = 28;
const VG = 90;

// ── Generation via parents chain ─────────────────────────────────────────────
function buildGens(members: Member[]): Map<number, number> {
  const cache = new Map<number, number>();
  function gen(id: number, stack = new Set<number>()): number {
    if (cache.has(id)) return cache.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const m = members.find(x => x.id === id);
    if (!m) return 0;
    const validParents = (m.parents || []).filter(p => members.find(x => x.id === p));
    if (!validParents.length) { cache.set(id, 0); return 0; }
    const g = Math.max(...validParents.map(p => gen(p, new Set(stack)))) + 1;
    cache.set(id, g);
    return g;
  }
  members.forEach(m => gen(m.id));
  return cache;
}

// ── Build couple slots ───────────────────────────────────────────────────────
// A slot = { primary, spouse|null }
// Rule: for every mutual spouse pair (A.spouses contains B AND B.spouses contains A),
//       the one with LOWER id is primary, the other is attached.
//       If only one-way, still attach.
// Attached members are NEVER standalone slots.

interface Slot { primary: number; spouse: number | null }

function buildSlots(members: Member[], genOf: Map<number, number>): Slot[] {
  const attached = new Set<number>();

  // Find all spouse pairs - keyed by lower id
  const pairs = new Map<number, number>(); // primary -> spouse
  members.forEach(m => {
    (m.spouses || []).forEach(sid => {
      if (!members.find(x => x.id === sid)) return;
      if (attached.has(m.id) || attached.has(sid)) return;
      const [primary, spouse] = m.id < sid ? [m.id, sid] : [sid, m.id];
      if (!pairs.has(primary) && !attached.has(primary) && !attached.has(spouse)) {
        pairs.set(primary, spouse);
        attached.add(spouse);
      }
    });
  });

  // Build slots: all members not attached, ordered by gen then id
  const slots: Slot[] = members
    .filter(m => !attached.has(m.id))
    .sort((a, b) => {
      const ga = genOf.get(a.id) ?? 0;
      const gb = genOf.get(b.id) ?? 0;
      return ga !== gb ? ga - gb : a.id - b.id;
    })
    .map(m => ({ primary: m.id, spouse: pairs.get(m.id) ?? null }));

  return slots;
}

// ── Subtree width ────────────────────────────────────────────────────────────
function computeWidths(
  slots: Slot[],
  members: Member[],
  genOf: Map<number, number>
): Map<number, number> {
  const cache = new Map<number, number>();
  const slotMap = new Map<number, Slot>(); // primary id -> slot
  slots.forEach(s => slotMap.set(s.primary, s));

  // For a slot, get its children slots (children of primary + spouse, as slot primaries)
  function getChildSlots(s: Slot): Slot[] {
    const pm = members.find(x => x.id === s.primary);
    const sm = s.spouse !== null ? members.find(x => x.id === s.spouse) : null;
    const childIds = [...new Set([
      ...(pm?.children || []),
      ...(sm?.children || []),
    ])].filter(cid => members.find(x => x.id === cid));

    // Each child is either a primary or an attached spouse -> find its slot
    const childSlots: Slot[] = [];
    const seen = new Set<number>();
    childIds.forEach(cid => {
      if (seen.has(cid)) return;
      // Is cid a primary?
      if (slotMap.has(cid)) {
        seen.add(cid);
        // also mark spouse
        const cs = slotMap.get(cid)!;
        if (cs.spouse !== null) seen.add(cs.spouse);
        childSlots.push(cs);
      }
      // else: cid is an attached spouse -> its slot is already included via primary
    });
    return childSlots;
  }

  function width(s: Slot): number {
    if (cache.has(s.primary)) return cache.get(s.primary)!;
    const selfW = s.spouse !== null ? CW + SG + CW : CW;
    const children = getChildSlots(s);
    if (!children.length) { cache.set(s.primary, selfW); return selfW; }
    const childTotal = children.reduce((sum, cs, i) => sum + width(cs) + (i > 0 ? HG : 0), 0);
    const total = Math.max(selfW, childTotal);
    cache.set(s.primary, total);
    return total;
  }

  slots.forEach(s => width(s));
  return cache;
}

// ── Assign positions ─────────────────────────────────────────────────────────
function assignPositions(
  slots: Slot[],
  members: Member[],
  genOf: Map<number, number>,
  widths: Map<number, number>
): Record<number, { x: number; y: number }> {
  const pos: Record<number, { x: number; y: number }> = {};
  const slotMap = new Map<number, Slot>();
  slots.forEach(s => slotMap.set(s.primary, s));

  function getChildSlots(s: Slot): Slot[] {
    const pm = members.find(x => x.id === s.primary);
    const sm = s.spouse !== null ? members.find(x => x.id === s.spouse) : null;
    const childIds = [...new Set([
      ...(pm?.children || []),
      ...(sm?.children || []),
    ])].filter(cid => members.find(x => x.id === cid));
    const childSlots: Slot[] = [];
    const seen = new Set<number>();
    childIds.forEach(cid => {
      if (seen.has(cid)) return;
      if (slotMap.has(cid)) {
        seen.add(cid);
        const cs = slotMap.get(cid)!;
        if (cs.spouse !== null) seen.add(cs.spouse);
        childSlots.push(cs);
      }
    });
    return childSlots;
  }

  function place(s: Slot, leftEdge: number) {
    const g = genOf.get(s.primary) ?? 0;
    const totalW = widths.get(s.primary) ?? CW;
    const selfW = s.spouse !== null ? CW + SG + CW : CW;
    const selfLeft = leftEdge + (totalW - selfW) / 2;

    pos[s.primary] = { x: selfLeft, y: 24 + g * (CH + VG) };
    if (s.spouse !== null) {
      pos[s.spouse] = { x: selfLeft + CW + SG, y: 24 + g * (CH + VG) };
    }

    let childCursor = leftEdge;
    getChildSlots(s).forEach(cs => {
      place(cs, childCursor);
      childCursor += (widths.get(cs.primary) ?? CW) + HG;
    });
  }

  // Roots = gen 0 slots
  let cursor = 24;
  slots.filter(s => (genOf.get(s.primary) ?? 0) === 0).forEach(s => {
    place(s, cursor);
    cursor += (widths.get(s.primary) ?? CW) + HG * 2;
  });

  // Orphan deeper slots not yet placed
  slots.forEach(s => {
    if (!pos[s.primary]) {
      const g = genOf.get(s.primary) ?? 0;
      pos[s.primary] = { x: cursor, y: 24 + g * (CH + VG) };
      if (s.spouse !== null) pos[s.spouse] = { x: cursor + CW + SG, y: 24 + g * (CH + VG) };
      cursor += (widths.get(s.primary) ?? CW) + HG;
    }
  });

  return pos;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FamilyTree({ members, selectedId, isAdmin, onSelect, onAddRelative }: Props) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);

  const genOf = buildGens(members);
  const slots = buildSlots(members, genOf);
  const widths = computeWidths(slots, members, genOf);
  const pos = assignPositions(slots, members, genOf, widths);

  const slotMap = new Map<number, Slot>();
  slots.forEach(s => slotMap.set(s.primary, s));

  const allX = Object.values(pos).map(p => p.x).filter(v => !isNaN(v));
  const allY = Object.values(pos).map(p => p.y).filter(v => !isNaN(v));
  if (!allX.length) return <div style={{ padding: '2rem', color: '#9CA3AF', textAlign: 'center' }}>Chargement…</div>;

  const svgW = Math.max(...allX) + CW + 48;
  const svgH = Math.max(...allY) + CH + 60;

  // ── SVG lines ─────────────────────────────────────────────────────────────
  const lines: string[] = [];
  const drawnCouples = new Set<string>();

  slots.forEach(s => {
    const p = pos[s.primary];
    if (!p) return;

    // Spouse connector
    if (s.spouse !== null && pos[s.spouse]) {
      const ck = [s.primary, s.spouse].sort().join('|');
      if (!drawnCouples.has(ck)) {
        drawnCouples.add(ck);
        const x1 = p.x + CW, x2 = pos[s.spouse].x;
        const cy = p.y + CH / 2 - 10;
        lines.push(`<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="#D4A843" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.85"/>`);
        lines.push(`<text x="${(x1+x2)/2}" y="${cy+5}" text-anchor="middle" font-size="12" fill="#D4A843">♥</text>`);
      }
    }

    // Children connector — only children whose pos.y > parent pos.y
    const pm = members.find(x => x.id === s.primary);
    const sm = s.spouse !== null ? members.find(x => x.id === s.spouse) : null;
    const childIds = [...new Set([...(pm?.children||[]), ...(sm?.children||[])])]
      .filter(cid => {
        const cp = pos[cid];
        return cp && cp.y > p.y + 10;
      });

    if (!childIds.length) return;

    const rightX = s.spouse !== null && pos[s.spouse] ? pos[s.spouse].x + CW : p.x + CW;
    const stemX = (p.x + rightX) / 2;
    const stemTop = p.y + CH;
    const forkY = stemTop + VG * 0.42;

    lines.push(`<line x1="${stemX}" y1="${stemTop}" x2="${stemX}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);

    if (childIds.length === 1) {
      const cx = pos[childIds[0]].x + CW / 2;
      if (Math.abs(cx - stemX) > 2)
        lines.push(`<line x1="${stemX}" y1="${forkY}" x2="${cx}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      lines.push(`<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${pos[childIds[0]].y}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
    } else {
      const xs = childIds.map(cid => pos[cid].x + CW / 2);
      const busL = Math.min(...xs), busR = Math.max(...xs);
      const clamp = Math.min(Math.max(stemX, busL), busR);
      if (Math.abs(clamp - stemX) > 2)
        lines.push(`<line x1="${stemX}" y1="${forkY}" x2="${clamp}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      lines.push(`<line x1="${busL}" y1="${forkY}" x2="${busR}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      childIds.forEach(cid => {
        const cx = pos[cid].x + CW / 2;
        lines.push(`<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${pos[cid].y}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      });
    }
  });

  // ── Gen labels ────────────────────────────────────────────────────────────
  const maxGen = Math.max(...members.map(m => genOf.get(m.id) ?? 0));
  const GEN_NAMES = ['Fondateurs', 'Enfants', 'Petits-enfants', 'Arrière-petits-enfants'];
  const genLabels = Array.from({ length: maxGen + 1 }, (_, g) => {
    const y = 24 + g * (CH + VG);
    return `<line x1="0" y1="${y-8}" x2="${svgW}" y2="${y-8}" stroke="#E5EDE0" stroke-width="0.75" stroke-dasharray="3,12"/>
    <text x="6" y="${y+12}" font-size="8" fill="#AABBA0" font-family="DM Sans,sans-serif" font-weight="600" letter-spacing="0.8">GÉN. ${g+1}${GEN_NAMES[g] ? ' · '+GEN_NAMES[g].toUpperCase() : ''}</text>`;
  }).join('');

  // ── Export PDF ────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
      <rect width="${svgW}" height="${svgH}" fill="#FAFAF7"/>
      ${genLabels}${lines.join('\n')}
      ${members.map(m => {
        const p = pos[m.id]; if (!p||isNaN(p.x)) return '';
        const color = m.dead?'#9CA3AF':m.gender==='M'?'#1E5FA8':m.gender==='F'?'#B8860B':'#6B7280';
        const ini = m.name.split(' ').map((x:string)=>x[0]||'').slice(0,2).join('').toUpperCase();
        const meta = [m.birth?m.birth.split('/').pop():'', m.birthPlace].filter(Boolean).join(' · ');
        const words = m.name.split(' ');
        const l1 = words.slice(0,2).join(' '), l2 = words.slice(2).join(' ');
        return `<g>
          <rect x="${p.x}" y="${p.y}" width="${CW}" height="${CH}" rx="10" fill="white" stroke="#E5E7EB" stroke-width="1"/>
          ${m.dead?`<text x="${p.x+8}" y="${p.y+14}" font-size="9" fill="#9CA3AF" font-family="sans-serif">✝</text>`:''}
          <circle cx="${p.x+CW/2}" cy="${p.y+40}" r="19" fill="${color}"/>
          <text x="${p.x+CW/2}" y="${p.y+46}" text-anchor="middle" font-size="12" fill="white" font-family="sans-serif" font-weight="500">${ini}</text>
          <text x="${p.x+CW/2}" y="${p.y+72}" text-anchor="middle" font-size="10" fill="#1A1A1A" font-family="sans-serif" font-weight="500">${l1}</text>
          ${l2?`<text x="${p.x+CW/2}" y="${p.y+86}" text-anchor="middle" font-size="10" fill="#1A1A1A" font-family="sans-serif">${l2}</text>`:''}
          <text x="${p.x+CW/2}" y="${p.y+106}" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="sans-serif">${meta}</text>
        </g>`;
      }).join('')}
      <text x="${svgW/2}" y="${svgH-12}" text-anchor="middle" font-size="8" fill="#C8D0C0" font-family="sans-serif" letter-spacing="1.5">SAYELE GROUP · FAMILLE GHUSSEIN</text>
    </svg>`;
    w.document.write(`<!DOCTYPE html><html><head><title>Arbre GHUSSEIN</title>
    <style>body{margin:0;padding:16px;background:#FAFAF7;font-family:sans-serif}
    .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
    .btn{padding:8px 18px;background:#4A7A1E;color:white;border:none;border-radius:7px;cursor:pointer;font-size:13px}
    @media print{.btn{display:none}}</style></head><body>
    <div class="hdr"><h1 style="font-size:18px;margin:0">Arbre Généalogique · Famille GHUSSEIN</h1>
    <button class="btn" onclick="window.print()">🖨 Imprimer / PDF</button></div>
    ${svg}</body></html>`);
    w.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px' }}>
          <button onClick={() => setZoom(z => Math.max(0.2, +(z-0.1).toFixed(1)))} style={{ width:26,height:26,border:'none',background:'none',fontSize:18,cursor:'pointer',color:'#374151',lineHeight:1 }}>−</button>
          <span style={{ fontSize:12,color:'#6B7280',minWidth:38,textAlign:'center' }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, +(z+0.1).toFixed(1)))} style={{ width:26,height:26,border:'none',background:'none',fontSize:18,cursor:'pointer',color:'#374151',lineHeight:1 }}>+</button>
        </div>
        <button onClick={() => setZoom(0.4)} style={{ fontSize:11,padding:'5px 12px',border:'1px solid #E5E7EB',background:'#fff',borderRadius:7,cursor:'pointer',color:'#374151' }}>Vue globale</button>
        <button onClick={() => setZoom(1)} style={{ fontSize:11,padding:'5px 12px',border:'1px solid #E5E7EB',background:'#fff',borderRadius:7,cursor:'pointer',color:'#374151' }}>100%</button>
        <button onClick={exportPDF} style={{ fontSize:11,padding:'5px 14px',border:'1px solid #4A7A1E',background:'#EAF3DE',borderRadius:7,cursor:'pointer',color:'#2D5016',fontWeight:500 }}>📄 Exporter PDF</button>
      </div>

      <div style={{ overflow:'auto', maxHeight:'calc(100vh - 300px)', background:'#FAFAF7', borderRadius:12, border:'1px solid #E8EDE4' }}>
        <div style={{ transform:`scale(${zoom})`, transformOrigin:'top left', width:svgW, height:svgH, position:'relative', transition:'transform 0.2s ease' }}>
          <svg width={svgW} height={svgH} style={{ position:'absolute',top:0,left:0,pointerEvents:'none' }}
            dangerouslySetInnerHTML={{ __html: genLabels + lines.join('') }} />
          {members.map(m => {
            const p = pos[m.id];
            if (!p||isNaN(p.x)||isNaN(p.y)) return null;
            return (
              <div key={m.id} style={{ position:'absolute',left:p.x,top:p.y,transition:'transform 0.15s',transform:hovered===m.id?'translateY(-3px)':'none',zIndex:m.id===selectedId?10:1 }}
                onMouseEnter={()=>setHovered(m.id)} onMouseLeave={()=>setHovered(null)}>
                <MemberCard member={m} selected={m.id===selectedId} isAdmin={isAdmin} onClick={()=>onSelect(m.id)} onAddRelative={onAddRelative}/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
