'use client';
import { useState, useRef } from 'react';
import { Member } from '@/lib/data';
import MemberCard from './MemberCard';

interface Props {
  members: Member[];
  selectedId: number | null;
  isAdmin: boolean;
  onSelect: (id: number) => void;
  onAddRelative: (id: number, type: 'parent' | 'child' | 'spouse') => void;
}

const CW = 150;   // card width
const CH = 148;   // card height
const SG = 28;    // spouse gap (between couple)
const HG = 24;    // horizontal gap between siblings/groups
const VG = 88;    // vertical gap between generations

// ─── helpers ────────────────────────────────────────────────────────────────

function getGen(id: number, members: Member[], cache: Map<number, number> = new Map()): number {
  if (cache.has(id)) return cache.get(id)!;
  const m = members.find(x => x.id === id);
  if (!m) return 0;
  const validParents = (m.parents || []).filter(p => members.find(x => x.id === p));
  if (!validParents.length) { cache.set(id, 0); return 0; }
  const g = Math.max(...validParents.map(p => getGen(p, members, cache))) + 1;
  cache.set(id, g);
  return g;
}

// ─── LAYOUT ENGINE ──────────────────────────────────────────────────────────
//
// Strategy: process generation by generation top-down.
// Each "slot" is either a single card or a couple side-by-side.
// A couple = (primary, spouse) where spouse shares ≥1 child with primary
//   OR is listed in spouses[] of primary and same generation.
// Children are placed below their parent couple, centered.
// No member appears twice. No line drawn unless direct parent→child or spouse.

function computeLayout(members: Member[]) {
  const genCache = new Map<number, number>();
  const genOf = (id: number) => getGen(id, members, genCache);

  // Build genMap
  const genMap: Record<number, number[]> = {};
  members.forEach(m => {
    const g = genOf(m.id);
    if (!genMap[g]) genMap[g] = [];
    genMap[g].push(m.id);
  });
  const genKeys = Object.keys(genMap).map(Number).sort((a, b) => a - b);

  // For each member, find their "official" spouse at same generation
  // (first spouse in spouses[] that exists in members and same gen)
  const getSpouse = (id: number): number | null => {
    const m = members.find(x => x.id === id);
    if (!m) return null;
    for (const sid of (m.spouses || [])) {
      if (members.find(x => x.id === sid) && genOf(sid) === genOf(id)) {
        return sid;
      }
    }
    return null;
  };

  // For a couple (primary + optional spouse), get their shared children
  const getCoupleChildren = (primary: number, spouse: number | null): number[] => {
    const pm = members.find(x => x.id === primary);
    const sm = spouse !== null ? members.find(x => x.id === spouse) : null;
    const allChildren = [...new Set([
      ...(pm?.children || []),
      ...(sm?.children || []),
    ])].filter(cid => members.find(x => x.id === cid));
    return allChildren;
  };

  // ── Assign x positions ───────────────────────────────────────────────
  // We do a bottom-up pass: compute subtree widths, then top-down assign x.

  // First, identify all "couple units" per generation (avoid double-placing spouses)
  const units: Array<{ primary: number; spouse: number | null; gen: number }> = [];
  const placed = new Set<number>();

  genKeys.forEach(g => {
    (genMap[g] || []).forEach(id => {
      if (placed.has(id)) return;
      placed.add(id);
      const sp = getSpouse(id);
      if (sp !== null && !placed.has(sp)) {
        placed.add(sp);
        units.push({ primary: id, spouse: sp, gen: g });
      } else {
        units.push({ primary: id, spouse: null, gen: g });
      }
    });
  });

  // Compute subtree width for a unit (recursive)
  const subtreeWidthCache = new Map<string, number>();
  function subtreeWidth(primary: number, spouse: number | null): number {
    const key = `${primary}-${spouse}`;
    if (subtreeWidthCache.has(key)) return subtreeWidthCache.get(key)!;

    const selfW = spouse !== null ? CW + SG + CW : CW;
    const children = getCoupleChildren(primary, spouse);

    if (!children.length) {
      subtreeWidthCache.set(key, selfW);
      return selfW;
    }

    // Children's total width (sum of their subtrees + gaps)
    let childTotal = 0;
    const childPlaced = new Set<number>();
    children.forEach(cid => {
      if (childPlaced.has(cid)) return;
      childPlaced.add(cid);
      const csp = getSpouse(cid);
      if (csp !== null && children.includes(csp)) childPlaced.add(csp);
      else if (csp !== null) {
        // spouse not in children list — treat as single
      }
      const w = subtreeWidth(cid, csp !== null && children.includes(csp) ? csp : null);
      childTotal += w + (childTotal > 0 ? HG : 0);
    });

    const total = Math.max(selfW, childTotal);
    subtreeWidthCache.set(key, total);
    return total;
  }

  // Top-down x assignment
  const pos: Record<number, { x: number; y: number }> = {};

  function assignX(primary: number, spouse: number | null, leftEdge: number, gen: number) {
    const totalW = subtreeWidth(primary, spouse);
    const selfW = spouse !== null ? CW + SG + CW : CW;
    const selfLeft = leftEdge + (totalW - selfW) / 2;

    pos[primary] = { x: selfLeft, y: 24 + gen * (CH + VG) };
    if (spouse !== null) {
      pos[spouse] = { x: selfLeft + CW + SG, y: 24 + gen * (CH + VG) };
    }

    // Assign children
    const children = getCoupleChildren(primary, spouse);
    const childPlaced = new Set<number>();
    let childCursor = leftEdge;

    children.forEach(cid => {
      if (childPlaced.has(cid)) return;
      childPlaced.add(cid);

      const csp = getSpouse(cid);
      const useSpouse = csp !== null && children.includes(csp) ? csp : null;
      if (useSpouse !== null) childPlaced.add(useSpouse);

      const cw = subtreeWidth(cid, useSpouse);
      assignX(cid, useSpouse, childCursor, gen + 1);
      childCursor += cw + HG;
    });
  }

  // Assign root units (gen 0 couples)
  let cursor = 24;
  units.filter(u => u.gen === 0).forEach(u => {
    const w = subtreeWidth(u.primary, u.spouse);
    assignX(u.primary, u.spouse, cursor, 0);
    cursor += w + HG * 2;
  });

  // Any unplaced members (orphans in deeper gens with no placed parents)
  genKeys.forEach((g) => {
    (genMap[g] || []).forEach(id => {
      if (pos[id]) return;
      pos[id] = { x: cursor, y: 24 + g * (CH + VG) };
      cursor += CW + HG;
    });
  });

  return { pos, genMap, genKeys, genOf, getSpouse, getCoupleChildren };
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function FamilyTree({ members, selectedId, isAdmin, onSelect, onAddRelative }: Props) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { pos, genMap, genKeys, genOf, getSpouse, getCoupleChildren } = computeLayout(members);

  const allX = Object.values(pos).map(p => p.x).filter(v => !isNaN(v));
  const allY = Object.values(pos).map(p => p.y).filter(v => !isNaN(v));
  if (!allX.length) return <div style={{ padding: '2rem', color: '#9CA3AF', textAlign: 'center' }}>Chargement…</div>;

  const svgW = Math.max(...allX) + CW + 40;
  const svgH = Math.max(...allY) + CH + 60;

  // ── Build SVG lines ──────────────────────────────────────────────────
  const lines: string[] = [];
  const drawnLines = new Set<string>();
  const drawnCouples = new Set<string>();

  genKeys.forEach(g => {
    const row = genMap[g] || [];
    const rowPlaced = new Set<number>();

    row.forEach(id => {
      if (rowPlaced.has(id) || !pos[id]) return;
      rowPlaced.add(id);

      const sp = getSpouse(id);
      const useSpouse = sp !== null && pos[sp] && genOf(sp) === g ? sp : null;
      if (useSpouse !== null) rowPlaced.add(useSpouse);

      // ── Spouse line ──
      if (useSpouse !== null) {
        const ck = [id, useSpouse].sort().join('|');
        if (!drawnCouples.has(ck)) {
          drawnCouples.add(ck);
          const x1 = pos[id].x + CW;
          const x2 = pos[useSpouse].x;
          const cy = pos[id].y + CH / 2 - 10;
          const mx = (x1 + x2) / 2;
          lines.push(`<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="#D4A843" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.85"/>`);
          lines.push(`<text x="${mx}" y="${cy+5}" text-anchor="middle" font-size="12" fill="#D4A843">♥</text>`);
        }
      }

      // ── Parent → Children lines ──
      const children = getCoupleChildren(id, useSpouse).filter(cid => pos[cid] && pos[cid].y > pos[id].y);
      if (!children.length) return;

      const lk = [id, useSpouse, ...children.sort()].join('|');
      if (drawnLines.has(lk)) return;
      drawnLines.add(lk);

      // Center of couple
      const leftX = pos[id].x;
      const rightX = useSpouse !== null ? pos[useSpouse].x + CW : pos[id].x + CW;
      const stemX = (leftX + rightX) / 2;
      const stemTop = pos[id].y + CH;
      const forkY = stemTop + VG * 0.44;

      // Vertical stem down
      lines.push(`<line x1="${stemX}" y1="${stemTop}" x2="${stemX}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);

      if (children.length === 1) {
        const cx = pos[children[0]].x + CW / 2;
        const cy2 = pos[children[0]].y;
        if (cx !== stemX) {
          lines.push(`<line x1="${stemX}" y1="${forkY}" x2="${cx}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
        }
        lines.push(`<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${cy2}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      } else {
        const xs = children.map(cid => pos[cid].x + CW / 2);
        const busL = Math.min(...xs);
        const busR = Math.max(...xs);
        // Extend stem to bus if needed
        const clampedStem = Math.min(Math.max(stemX, busL), busR);
        if (clampedStem !== stemX) {
          lines.push(`<line x1="${stemX}" y1="${forkY}" x2="${clampedStem}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
        }
        lines.push(`<line x1="${busL}" y1="${forkY}" x2="${busR}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
        children.forEach(cid => {
          const cx = pos[cid].x + CW / 2;
          lines.push(`<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${pos[cid].y}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
        });
      }
    });
  });

  // ── Gen labels ───────────────────────────────────────────────────────
  const GEN_NAMES = ['Fondateurs', 'Enfants', 'Petits-enfants', 'Arrière-petits-enfants'];
  const genLabels = genKeys.map((g, gi) => {
    const y = 24 + gi * (CH + VG);
    return `
      <line x1="0" y1="${y - 8}" x2="${svgW}" y2="${y - 8}" stroke="#E5EDE0" stroke-width="0.75" stroke-dasharray="3,12"/>
      <text x="6" y="${y + 12}" font-size="8" fill="#AABBA0" font-family="DM Sans,sans-serif" font-weight="600" letter-spacing="0.8">GÉN. ${g + 1}${GEN_NAMES[g] ? ' · ' + GEN_NAMES[g].toUpperCase() : ''}</text>
    `;
  }).join('');

  // ── Export PDF ───────────────────────────────────────────────────────
  const exportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    // Serialize cards as SVG foreignObjects is unreliable for PDF
    // Instead we generate a clean SVG with text labels for each member
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" style="background:#FAFAF7">
        <rect width="${svgW}" height="${svgH}" fill="#FAFAF7"/>
        ${genLabels}
        ${lines.join('\n')}
        ${members.map(m => {
          const p = pos[m.id];
          if (!p || isNaN(p.x)) return '';
          const color = m.dead ? '#9CA3AF' : m.gender === 'M' ? '#1E5FA8' : m.gender === 'F' ? '#B8860B' : '#6B7280';
          const ini = m.name.split(' ').map((w: string) => w[0] || '').slice(0, 2).join('').toUpperCase();
          const year = m.birth ? m.birth.split('/').pop() : '';
          const loc = m.birthPlace || '';
          const meta = [year, loc].filter(Boolean).join(' · ');
          // Truncate name
          const name1 = m.name.length > 20 ? m.name.slice(0, 18) + m.name.slice(18).split(' ')[0] : m.name;
          const nameParts = name1.split(' ');
          const line1 = nameParts.slice(0, 2).join(' ');
          const line2 = nameParts.slice(2).join(' ');
          return `
            <g>
              <rect x="${p.x}" y="${p.y}" width="${CW}" height="${CH}" rx="10" fill="white" stroke="${m.id === selectedId ? '#4A7A1E' : '#E5E7EB'}" stroke-width="${m.id === selectedId ? 2 : 1}"/>
              ${m.dead ? `<text x="${p.x+8}" y="${p.y+14}" font-size="9" fill="#9CA3AF" font-family="DM Sans,sans-serif">✝</text>` : ''}
              <circle cx="${p.x+CW/2}" cy="${p.y+42}" r="20" fill="${color}"/>
              <text x="${p.x+CW/2}" y="${p.y+48}" text-anchor="middle" font-size="12" fill="white" font-family="DM Sans,sans-serif" font-weight="500">${ini}</text>
              <text x="${p.x+CW/2}" y="${p.y+76}" text-anchor="middle" font-size="10.5" fill="#1A1A1A" font-family="DM Sans,sans-serif" font-weight="500">${line1}</text>
              ${line2 ? `<text x="${p.x+CW/2}" y="${p.y+90}" text-anchor="middle" font-size="10.5" fill="#1A1A1A" font-family="DM Sans,sans-serif" font-weight="500">${line2}</text>` : ''}
              <text x="${p.x+CW/2}" y="${p.y+108}" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="DM Sans,sans-serif">${meta}</text>
            </g>
          `;
        }).join('')}
        <text x="${svgW/2}" y="${svgH - 12}" text-anchor="middle" font-size="9" fill="#C8D0C0" font-family="DM Sans,sans-serif" letter-spacing="1.5">SAYELE GROUP · FAMILLE GHUSSEIN · ARBRE GÉNÉALOGIQUE</text>
      </svg>`;

    w.document.write(`<!DOCTYPE html><html><head><title>Arbre GHUSSEIN</title>
      <style>body{margin:0;background:#FAFAF7}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
      </head><body>
      <div style="padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-family:serif;font-size:20px;font-weight:600">Arbre Généalogique · Famille GHUSSEIN</div>
          <button onclick="window.print()" style="padding:8px 18px;background:#4A7A1E;color:white;border:none;border-radius:7px;cursor:pointer;font-size:13px">🖨 Imprimer / PDF</button>
        </div>
        ${svgContent}
      </div>
      </body></html>`);
    w.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px' }}>
          <button onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
            style={{ width: 24, height: 24, border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', color: '#374151', lineHeight: 1 }}>−</button>
          <span style={{ fontSize: 12, color: '#6B7280', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}
            style={{ width: 24, height: 24, border: 'none', background: 'none', fontSize: 16, cursor: 'pointer', color: '#374151', lineHeight: 1 }}>+</button>
          <button onClick={() => setZoom(1)}
            style={{ fontSize: 10, border: '1px solid #E5E7EB', background: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#6B7280' }}>Réinitialiser</button>
        </div>
        <button onClick={() => setZoom(0.5)}
          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #E5E7EB', background: '#fff', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
          Vue globale
        </button>
        <button onClick={exportPDF}
          style={{ fontSize: 11, padding: '5px 12px', border: '1px solid #4A7A1E', background: '#EAF3DE', borderRadius: 7, cursor: 'pointer', color: '#2D5016', fontWeight: 500 }}>
          📄 Exporter PDF
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 300px)',
        background: '#FAFAF7',
        borderRadius: 12,
        border: '1px solid #E8EDE4',
        cursor: 'grab',
      }}>
        <div style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          width: svgW,
          height: svgH,
          position: 'relative',
          transition: 'transform 0.2s ease',
        }}>
          {/* Lines */}
          <svg width={svgW} height={svgH}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: genLabels + lines.join('') }}
          />
          {/* Cards */}
          {members.map(m => {
            const p = pos[m.id];
            if (!p || isNaN(p.x) || isNaN(p.y)) return null;
            return (
              <div key={m.id}
                style={{
                  position: 'absolute', left: p.x, top: p.y,
                  transition: 'transform 0.15s ease',
                  transform: hovered === m.id ? 'translateY(-3px)' : 'none',
                  zIndex: m.id === selectedId ? 10 : 1,
                }}
                onMouseEnter={() => setHovered(m.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <MemberCard
                  member={m}
                  selected={m.id === selectedId}
                  isAdmin={isAdmin}
                  onClick={() => onSelect(m.id)}
                  onAddRelative={onAddRelative}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
