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
const SG = 30;   // gap between spouses
const HG = 28;   // gap between sibling groups
const VG = 90;   // vertical gap between generations

// ── Generation: number of ancestor hops through parents only ────────────────
function buildGenMap(members: Member[]) {
  const cache = new Map<number, number>();

  function gen(id: number, visiting = new Set<number>()): number {
    if (cache.has(id)) return cache.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const m = members.find(x => x.id === id);
    if (!m) return 0;
    const validParents = (m.parents || []).filter(p => members.find(x => x.id === p));
    if (!validParents.length) { cache.set(id, 0); return 0; }
    const g = Math.max(...validParents.map(p => gen(p, new Set(visiting)))) + 1;
    cache.set(id, g);
    return g;
  }

  members.forEach(m => gen(m.id));
  return cache;
}

// ── Core layout ──────────────────────────────────────────────────────────────
function computeLayout(members: Member[]) {
  const genCache = buildGenMap(members);
  const genOf = (id: number) => genCache.get(id) ?? 0;

  // ── Step 1: assign each member to a "primary" slot owner ────────────────
  // A "slot" = one couple unit (primary + optional spouse side-by-side)
  // Rules:
  //   - The member with PARENTS in the dataset is always "primary"
  //   - Their spouse (in spouses[]) with NO parents in the dataset is "attached"
  //   - Two members both without parents: pair by mutual spouses[]
  //   - An attached spouse is NEVER placed as a separate slot

  const attached = new Set<number>(); // ids that are drawn as spouse of another

  // Find spouse to attach: for a given member, find the first spouse that:
  //   a) exists in members list
  //   b) is at the same generation
  //   c) not already attached elsewhere
  const getAttachedSpouse = (id: number): number | null => {
    const m = members.find(x => x.id === id);
    if (!m) return null;
    for (const sid of (m.spouses || [])) {
      if (attached.has(sid)) continue;
      const sm = members.find(x => x.id === sid);
      if (!sm) continue;
      if (genOf(sid) === genOf(id)) return sid;
    }
    return null;
  };

  // Build ordered list of "primary" members (slots), skipping attached spouses
  // Process members ordered by generation then by id for determinism
  const sortedMembers = [...members].sort((a, b) => {
    const ga = genOf(a.id), gb = genOf(b.id);
    if (ga !== gb) return ga - gb;
    return a.id - b.id;
  });

  // First pass: members WITH parents in the dataset take priority as primaries
  // Their spouses (without parents) become attached
  sortedMembers.forEach(m => {
    if (attached.has(m.id)) return;
    const hasParents = (m.parents || []).some(p => members.find(x => x.id === p));
    if (hasParents) {
      const sp = getAttachedSpouse(m.id);
      if (sp !== null) attached.add(sp);
    }
  });

  // Second pass: remaining unattached members pair with each other
  sortedMembers.forEach(m => {
    if (attached.has(m.id)) return;
    const sp = getAttachedSpouse(m.id);
    if (sp !== null && !attached.has(sp)) attached.add(sp);
  });

  // Slots = all members not in attached, ordered gen then id
  const slots = sortedMembers.filter(m => !attached.has(m.id));

  // For each slot, get its attached spouse
  const slotSpouse = new Map<number, number | null>();
  slots.forEach(m => {
    const sp = getAttachedSpouse(m.id);
    slotSpouse.set(m.id, sp !== null && attached.has(sp) ? sp : null);
  });

  // ── Step 2: subtree width (bottom-up) ────────────────────────────────────
  const getCoupleChildren = (primary: number, spouse: number | null): number[] => {
    const pm = members.find(x => x.id === primary);
    const sm = spouse !== null ? members.find(x => x.id === spouse) : null;
    return [...new Set([
      ...(pm?.children || []),
      ...(sm?.children || []),
    ])].filter(cid => members.find(x => x.id === cid));
  };

  const widthCache = new Map<number, number>();

  function slotWidth(primaryId: number): number {
    if (widthCache.has(primaryId)) return widthCache.get(primaryId)!;
    const spouse = slotSpouse.get(primaryId) ?? null;
    const selfW = spouse !== null ? CW + SG + CW : CW;
    const children = getCoupleChildren(primaryId, spouse);

    // children are placed as slots themselves
    const childSlots = children
      .map(cid => slots.find(s => s.id === cid))
      .filter(Boolean) as Member[];

    if (!childSlots.length) {
      widthCache.set(primaryId, selfW);
      return selfW;
    }

    let childTotal = 0;
    childSlots.forEach((cs, i) => {
      childTotal += slotWidth(cs.id) + (i > 0 ? HG : 0);
    });

    const total = Math.max(selfW, childTotal);
    widthCache.set(primaryId, total);
    return total;
  }

  slots.forEach(m => slotWidth(m.id));

  // ── Step 3: top-down x/y assignment ──────────────────────────────────────
  const pos: Record<number, { x: number; y: number }> = {};

  function place(primaryId: number, leftEdge: number) {
    const m = members.find(x => x.id === primaryId);
    if (!m) return;
    const spouse = slotSpouse.get(primaryId) ?? null;
    const g = genOf(primaryId);
    const totalW = slotWidth(primaryId);
    const selfW = spouse !== null ? CW + SG + CW : CW;
    const selfLeft = leftEdge + (totalW - selfW) / 2;

    pos[primaryId] = { x: selfLeft, y: 24 + g * (CH + VG) };
    if (spouse !== null) {
      pos[spouse] = { x: selfLeft + CW + SG, y: 24 + g * (CH + VG) };
    }

    // Place children
    const children = getCoupleChildren(primaryId, spouse);
    const childSlots = children
      .map(cid => slots.find(s => s.id === cid))
      .filter(Boolean) as Member[];

    let childCursor = leftEdge;
    childSlots.forEach(cs => {
      place(cs.id, childCursor);
      childCursor += slotWidth(cs.id) + HG;
    });
  }

  // Root slots = gen 0 slots (no parents in dataset)
  const rootSlots = slots.filter(m => {
    const g = genOf(m.id);
    return g === 0;
  });

  let cursor = 24;
  rootSlots.forEach(m => {
    place(m.id, cursor);
    cursor += slotWidth(m.id) + HG * 2;
  });

  // Orphan slots not yet placed (deep members whose parents aren't in dataset)
  slots.forEach(m => {
    if (!pos[m.id]) {
      const g = genOf(m.id);
      pos[m.id] = { x: cursor, y: 24 + g * (CH + VG) };
      const sp = slotSpouse.get(m.id) ?? null;
      if (sp !== null) pos[sp] = { x: cursor + CW + SG, y: 24 + g * (CH + VG) };
      cursor += (sp !== null ? CW + SG + CW : CW) + HG;
    }
  });

  return { pos, genCache, genOf, slotSpouse, getCoupleChildren, slots, attached };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FamilyTree({ members, selectedId, isAdmin, onSelect, onAddRelative }: Props) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);

  const { pos, genOf, slotSpouse, getCoupleChildren, slots } = computeLayout(members);

  const allX = Object.values(pos).map(p => p.x).filter(v => !isNaN(v));
  const allY = Object.values(pos).map(p => p.y).filter(v => !isNaN(v));
  if (!allX.length) return <div style={{ padding: '2rem', color: '#9CA3AF', textAlign: 'center' }}>Chargement…</div>;

  const svgW = Math.max(...allX) + CW + 48;
  const svgH = Math.max(...allY) + CH + 60;

  // ── SVG lines ─────────────────────────────────────────────────────────────
  const lines: string[] = [];
  const drawnCouples = new Set<string>();
  const drawnParents = new Set<number>();

  slots.forEach(slot => {
    const id = slot.id;
    const p = pos[id];
    if (!p) return;
    const spouse = slotSpouse.get(id) ?? null;

    // Spouse connector
    if (spouse !== null && pos[spouse]) {
      const ck = [id, spouse].sort().join('|');
      if (!drawnCouples.has(ck)) {
        drawnCouples.add(ck);
        const x1 = p.x + CW;
        const x2 = pos[spouse].x;
        const cy = p.y + CH / 2 - 10;
        const mx = (x1 + x2) / 2;
        lines.push(`<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="#D4A843" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.85"/>`);
        lines.push(`<text x="${mx}" y="${cy + 5}" text-anchor="middle" font-size="12" fill="#D4A843">♥</text>`);
      }
    }

    // Children connector
    if (drawnParents.has(id)) return;
    drawnParents.add(id);

    const children = getCoupleChildren(id, spouse);
    const childSlots = children
      .map(cid => slots.find(s => s.id === cid))
      .filter(Boolean) as Member[];
    const placedChildren = childSlots.filter(cs => pos[cs.id] && pos[cs.id].y > p.y);
    if (!placedChildren.length) return;

    const leftX = p.x;
    const rightX = spouse !== null && pos[spouse] ? pos[spouse].x + CW : p.x + CW;
    const stemX = (leftX + rightX) / 2;
    const stemTop = p.y + CH;
    const forkY = stemTop + VG * 0.42;

    lines.push(`<line x1="${stemX}" y1="${stemTop}" x2="${stemX}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);

    if (placedChildren.length === 1) {
      const cx = pos[placedChildren[0].id].x + CW / 2;
      const cy2 = pos[placedChildren[0].id].y;
      if (Math.abs(cx - stemX) > 1)
        lines.push(`<line x1="${stemX}" y1="${forkY}" x2="${cx}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      lines.push(`<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${cy2}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
    } else {
      const xs = placedChildren.map(cs => pos[cs.id].x + CW / 2);
      const busL = Math.min(...xs);
      const busR = Math.max(...xs);
      const clampedStem = Math.min(Math.max(stemX, busL), busR);
      if (Math.abs(clampedStem - stemX) > 1)
        lines.push(`<line x1="${stemX}" y1="${forkY}" x2="${clampedStem}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      lines.push(`<line x1="${busL}" y1="${forkY}" x2="${busR}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      placedChildren.forEach(cs => {
        const cx = pos[cs.id].x + CW / 2;
        lines.push(`<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${pos[cs.id].y}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      });
    }
  });

  // ── Gen labels ───────────────────────────────────────────────────────────
  const maxGen = Math.max(...members.map(m => genOf(m.id)));
  const GEN_NAMES = ['Fondateurs', 'Enfants', 'Petits-enfants', 'Arrière-petits-enfants'];
  const genLabels = Array.from({ length: maxGen + 1 }, (_, g) => {
    const y = 24 + g * (CH + VG);
    return `
      <line x1="0" y1="${y - 8}" x2="${svgW}" y2="${y - 8}" stroke="#E5EDE0" stroke-width="0.75" stroke-dasharray="3,12"/>
      <text x="6" y="${y + 12}" font-size="8" fill="#AABBA0" font-family="DM Sans,sans-serif" font-weight="600" letter-spacing="0.8">GÉN. ${g + 1}${GEN_NAMES[g] ? ' · ' + GEN_NAMES[g].toUpperCase() : ''}</text>
    `;
  }).join('');

  // ── Export PDF ──────────────────────────────────────────────────────────
  const exportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
      <rect width="${svgW}" height="${svgH}" fill="#FAFAF7"/>
      ${genLabels}${lines.join('\n')}
      ${members.map(m => {
        const p = pos[m.id]; if (!p || isNaN(p.x)) return '';
        const color = m.dead ? '#9CA3AF' : m.gender === 'M' ? '#1E5FA8' : m.gender === 'F' ? '#B8860B' : '#6B7280';
        const ini = m.name.split(' ').map((x: string) => x[0] || '').slice(0, 2).join('').toUpperCase();
        const year = m.birth ? m.birth.split('/').pop() : '';
        const meta = [year, m.birthPlace].filter(Boolean).join(' · ');
        const words = m.name.split(' ');
        const l1 = words.slice(0, 2).join(' ');
        const l2 = words.slice(2).join(' ');
        return `<g>
          <rect x="${p.x}" y="${p.y}" width="${CW}" height="${CH}" rx="10" fill="white" stroke="#E5E7EB" stroke-width="1"/>
          ${m.dead ? `<text x="${p.x+8}" y="${p.y+14}" font-size="9" fill="#9CA3AF" font-family="sans-serif">✝</text>` : ''}
          <circle cx="${p.x+CW/2}" cy="${p.y+40}" r="19" fill="${color}"/>
          <text x="${p.x+CW/2}" y="${p.y+46}" text-anchor="middle" font-size="12" fill="white" font-family="sans-serif" font-weight="500">${ini}</text>
          <text x="${p.x+CW/2}" y="${p.y+72}" text-anchor="middle" font-size="10" fill="#1A1A1A" font-family="sans-serif" font-weight="500">${l1}</text>
          ${l2 ? `<text x="${p.x+CW/2}" y="${p.y+85}" text-anchor="middle" font-size="10" fill="#1A1A1A" font-family="sans-serif">${l2}</text>` : ''}
          <text x="${p.x+CW/2}" y="${p.y+104}" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="sans-serif">${meta}</text>
        </g>`;
      }).join('')}
      <text x="${svgW/2}" y="${svgH-12}" text-anchor="middle" font-size="8" fill="#C8D0C0" font-family="sans-serif" letter-spacing="1.5">SAYELE GROUP · FAMILLE GHUSSEIN</text>
    </svg>`;
    w.document.write(`<!DOCTYPE html><html><head><title>Arbre GHUSSEIN</title>
    <style>body{margin:0;padding:16px;background:#FAFAF7;font-family:sans-serif}
    .hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
    .hdr h1{font-size:18px;margin:0}
    .btn{padding:8px 18px;background:#4A7A1E;color:white;border:none;border-radius:7px;cursor:pointer;font-size:13px}
    @media print{.hdr button{display:none};body{padding:0}}</style>
    </head><body>
    <div class="hdr"><h1>Arbre Généalogique · Famille GHUSSEIN</h1>
    <button class="btn" onclick="window.print()">🖨 Imprimer / Enregistrer PDF</button></div>
    ${svg}</body></html>`);
    w.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px' }}>
          <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.1).toFixed(1)))}
            style={{ width: 26, height: 26, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#374151', lineHeight: 1 }}>−</button>
          <span style={{ fontSize: 12, color: '#6B7280', minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
            style={{ width: 26, height: 26, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#374151', lineHeight: 1 }}>+</button>
        </div>
        <button onClick={() => setZoom(0.45)} style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #E5E7EB', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
          Vue globale
        </button>
        <button onClick={() => setZoom(1)} style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #E5E7EB', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
          100%
        </button>
        <button onClick={exportPDF} style={{ fontSize: 11, padding: '5px 14px', border: '1px solid #4A7A1E', background: '#EAF3DE', borderRadius: 7, cursor: 'pointer', color: '#2D5016', fontWeight: 500 }}>
          📄 Exporter PDF
        </button>
      </div>

      {/* Canvas */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)', background: '#FAFAF7', borderRadius: 12, border: '1px solid #E8EDE4' }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: svgW, height: svgH, position: 'relative', transition: 'transform 0.2s ease' }}>
          <svg width={svgW} height={svgH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: genLabels + lines.join('') }} />
          {members.map(m => {
            const p = pos[m.id];
            if (!p || isNaN(p.x) || isNaN(p.y)) return null;
            return (
              <div key={m.id} style={{ position: 'absolute', left: p.x, top: p.y, transition: 'transform 0.15s', transform: hovered === m.id ? 'translateY(-3px)' : 'none', zIndex: m.id === selectedId ? 10 : 1 }}
                onMouseEnter={() => setHovered(m.id)} onMouseLeave={() => setHovered(null)}>
                <MemberCard member={m} selected={m.id === selectedId} isAdmin={isAdmin} onClick={() => onSelect(m.id)} onAddRelative={onAddRelative} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
