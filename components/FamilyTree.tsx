'use client';
import { useState } from 'react';
import { Member, genFullLabel } from '@/lib/data';
import MemberCard from './MemberCard';

interface Props {
  members: Member[];
  selectedId: number | null;
  isAdmin: boolean;
  onSelect: (id: number) => void;
  onAddRelative: (id: number, type: 'parent' | 'child' | 'spouse') => void;
}

// ── Layout constants ─────────────────────────────────────────────────────────
const CW = 152;        // card width
const CH = 148;        // card height
const SG = 30;         // gap between spouses in a normal couple
const WIDE_SG = 220;   // wider gap for a couple with grandparents shown above BOTH partners
const HG = 28;         // horizontal gap between sibling subtrees
const VG = 90;         // vertical gap between generations
const Y0 = 24;
const rowY = (g: number) => Y0 + g * (CH + VG);

// ── Birth-order helpers ──────────────────────────────────────────────────────
function birthYear(m?: Member): number {
  if (!m || !m.birth) return 9999;
  const parts = m.birth.split('/');
  const y = parseInt(parts[parts.length - 1], 10);
  return isNaN(y) ? 9999 : y;
}
// Siblings are ordered by explicit rank, then birth year, then id.
function childOrder(a: Member, b: Member): number {
  const ra = a.rank ?? 999, rb = b.rank ?? 999;
  if (ra !== rb) return ra - rb;
  const ya = birthYear(a), yb = birthYear(b);
  if (ya !== yb) return ya - yb;
  return a.id - b.id;
}

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

// ── Couple slots ─────────────────────────────────────────────────────────────
// A slot is one row-unit: a primary member plus an optional attached spouse.
// For a mutual spouse pair the lower id is primary; the other is attached and
// never gets its own slot, which guarantees partners always share a row.
interface Slot { primary: number; spouse: number | null }

function buildSlots(members: Member[], genOf: Map<number, number>): Slot[] {
  const attached = new Set<number>();
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
  return members
    .filter(m => !attached.has(m.id))
    .sort((a, b) => {
      const ga = genOf.get(a.id) ?? 0, gb = genOf.get(b.id) ?? 0;
      return ga !== gb ? ga - gb : a.id - b.id;
    })
    .map(m => ({ primary: m.id, spouse: pairs.get(m.id) ?? null }));
}

// ── Slot helpers ─────────────────────────────────────────────────────────────
function childIdsOf(s: Slot, memberMap: Map<number, Member>): number[] {
  const pm = memberMap.get(s.primary);
  const sm = s.spouse !== null ? memberMap.get(s.spouse) : null;
  return [...new Set([...(pm?.children || []), ...(sm?.children || [])])]
    .filter(id => memberMap.has(id));
}

// Child slots of a couple, in birth order. A child that married in is attached
// to its own slot, so every child id resolves to the slot it leads.
function childSlotsOf(s: Slot, slotMap: Map<number, Slot>, memberMap: Map<number, Member>): Slot[] {
  const kids = childIdsOf(s, memberMap)
    .map(id => memberMap.get(id)!)
    .sort(childOrder);
  const out: Slot[] = [];
  const seen = new Set<number>();
  kids.forEach(k => {
    const cs = slotMap.get(k.id);
    if (!cs || seen.has(cs.primary)) return;
    seen.add(cs.primary);
    if (cs.spouse !== null) seen.add(cs.spouse);
    out.push(cs);
  });
  return out;
}

// A couple gets the wide gap only when BOTH partners have parents in the tree —
// i.e. two ancestor couples need to sit above them (the founding couple).
function coupleGap(s: Slot, memberMap: Map<number, Member>): number {
  if (s.spouse === null) return 0;
  const pm = memberMap.get(s.primary), sm = memberMap.get(s.spouse);
  const hasParents = (m?: Member) => !!m?.parents?.some(p => memberMap.has(p));
  return hasParents(pm) && hasParents(sm) ? WIDE_SG : SG;
}
function selfWidth(s: Slot, memberMap: Map<number, Member>): number {
  return s.spouse !== null ? CW + coupleGap(s, memberMap) + CW : CW;
}

// ── Full layout ──────────────────────────────────────────────────────────────
interface Layout {
  genOf: Map<number, number>;
  slots: Slot[];
  slotMap: Map<number, Slot>;
  pos: Record<number, { x: number; y: number }>;
}

function computeLayout(members: Member[]): Layout {
  const memberMap = new Map(members.map(m => [m.id, m]));
  const genOf = buildGens(members);
  const slots = buildSlots(members, genOf);
  const slotMap = new Map<number, Slot>();
  slots.forEach(s => slotMap.set(s.primary, s));

  // Ancestor slots = top-row couples whose line continues through a partner who
  // married into another couple (the grandparents above the founders). They are
  // placed directly above their child instead of flowing through the descent.
  const ancestorSet = new Set<number>();
  slots.forEach(s => {
    const g = genOf.get(s.primary) ?? 0;
    if (g === 0 && childIdsOf(s, memberMap).length > 0) ancestorSet.add(s.primary);
  });
  const descentSlots = slots.filter(s => !ancestorSet.has(s.primary));

  // Subtree widths for the descent forest.
  const widths = new Map<number, number>();
  function width(s: Slot): number {
    if (widths.has(s.primary)) return widths.get(s.primary)!;
    const selfW = selfWidth(s, memberMap);
    const children = childSlotsOf(s, slotMap, memberMap);
    if (!children.length) { widths.set(s.primary, selfW); return selfW; }
    const childTotal = children.reduce((sum, cs, i) => sum + width(cs) + (i > 0 ? HG : 0), 0);
    const total = Math.max(selfW, childTotal);
    widths.set(s.primary, total);
    return total;
  }
  descentSlots.forEach(width);

  const pos: Record<number, { x: number; y: number }> = {};
  function place(s: Slot, leftEdge: number) {
    const g = genOf.get(s.primary) ?? 0;
    const totalW = widths.get(s.primary) ?? CW;
    const selfW = selfWidth(s, memberMap);
    const selfLeft = leftEdge + (totalW - selfW) / 2;
    pos[s.primary] = { x: selfLeft, y: rowY(g) };
    if (s.spouse !== null) pos[s.spouse] = { x: selfLeft + CW + coupleGap(s, memberMap), y: rowY(g) };
    let cur = leftEdge;
    childSlotsOf(s, slotMap, memberMap).forEach(cs => {
      place(cs, cur);
      cur += (widths.get(cs.primary) ?? CW) + HG;
    });
  }

  // Descent roots = descent slots that are nobody's child within the descent
  // (the founding couple, whose parents are the ancestor slots above).
  const childPrimaries = new Set<number>();
  descentSlots.forEach(s => childSlotsOf(s, slotMap, memberMap).forEach(cs => childPrimaries.add(cs.primary)));
  let cursor = Y0;
  descentSlots
    .filter(s => !childPrimaries.has(s.primary))
    .forEach(s => { place(s, cursor); cursor += (widths.get(s.primary) ?? CW) + HG * 2; });

  // Safety: place any descent slot the recursion somehow missed.
  descentSlots.forEach(s => {
    if (pos[s.primary]) return;
    const g = genOf.get(s.primary) ?? 0;
    pos[s.primary] = { x: cursor, y: rowY(g) };
    if (s.spouse !== null) pos[s.spouse] = { x: cursor + CW + coupleGap(s, memberMap), y: rowY(g) };
    cursor += selfWidth(s, memberMap) + HG;
  });

  // Ancestor couples: centre each one directly above its (already placed) child.
  ancestorSet.forEach(primary => {
    const s = slotMap.get(primary)!;
    const childId = childIdsOf(s, memberMap).find(id => pos[id]);
    const childCenter = childId != null ? pos[childId].x + CW / 2 : cursor;
    const selfW = selfWidth(s, memberMap);
    const left = childCenter - selfW / 2;
    pos[s.primary] = { x: left, y: rowY(0) };
    if (s.spouse !== null) pos[s.spouse] = { x: left + CW + coupleGap(s, memberMap), y: rowY(0) };
  });

  return { genOf, slots, slotMap, pos };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FamilyTree({ members, selectedId, isAdmin, onSelect, onAddRelative }: Props) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);

  const { genOf, slots, pos } = computeLayout(members);

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
  const maxGen = Math.max(0, ...members.map(m => genOf.get(m.id) ?? 0));
  const genLabels = Array.from({ length: maxGen + 1 }, (_, g) => {
    const y = rowY(g);
    const label = genFullLabel(g);
    return `<line x1="0" y1="${y-8}" x2="${svgW}" y2="${y-8}" stroke="#E5EDE0" stroke-width="0.75" stroke-dasharray="3,12"/>
    <text x="6" y="${y+12}" font-size="8" fill="#AABBA0" font-family="DM Sans,sans-serif" font-weight="600" letter-spacing="0.8">${label}</text>`;
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
