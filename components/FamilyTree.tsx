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

const W = 150;   // card width
const H = 148;   // card height
const SPOUSE_GAP = 32;  // gap between spouses
const SIBLING_GAP = 20; // gap between sibling groups
const V_GAP = 90;       // vertical gap between generations

interface NodePos { x: number; y: number; width: number }

// A "family unit" = one member + optional spouse, + their children below
interface FamilyUnit {
  primary: number;
  spouse: number | null;
  children: number[]; // direct children shared
}

function buildFamilyUnits(members: Member[]): FamilyUnit[] {
  const units: FamilyUnit[] = [];
  const placed = new Set<number>();

  // Roots = members with no parents in the dataset
  const roots = members.filter(m => !m.parents.some(p => members.find(x => x.id === p)));

  // For each root, pair with spouse if any
  roots.forEach(root => {
    if (placed.has(root.id)) return;
    placed.add(root.id);

    const spouseId = (root.spouses || []).find(sid => {
      const s = members.find(x => x.id === sid);
      return s && !s.parents.some(p => members.find(x => x.id === p));
    }) ?? null;

    if (spouseId) placed.add(spouseId);

    // Children = root's children that exist in dataset
    const children = [...new Set([
      ...(root.children || []),
      ...(spouseId ? (members.find(x => x.id === spouseId)?.children || []) : [])
    ])].filter(cid => members.find(x => x.id === cid));

    units.push({ primary: root.id, spouse: spouseId, children });
  });

  return units;
}

// Recursively compute positions
// Returns: map of id -> {x, y}, and total width used
function computePositions(
  members: Member[],
  ids: number[],
  startX: number,
  startY: number,
  placed: Set<number>
): Record<number, NodePos> {
  const pos: Record<number, NodePos> = {};

  // Group siblings by their shared parent pair
  // Each group = members who share the same parents
  // Process each member; if they have a spouse, place spouse next to them

  let curX = startX;

  ids.forEach(id => {
    if (placed.has(id)) return;
    const m = members.find(x => x.id === id);
    if (!m) return;
    placed.add(id);

    // Find spouse among same-generation members
    const spouseId = (m.spouses || []).find(sid => {
      const s = members.find(x => x.id === sid);
      if (!s || placed.has(sid)) return false;
      // Spouse is on same generation (roughly)
      return true;
    }) ?? null;

    if (spouseId) placed.add(spouseId);

    // Unit width = 1 or 2 cards
    const unitW = spouseId ? W + SPOUSE_GAP + W : W;

    // Children
    const childIds = [...new Set([
      ...(m.children || []),
      ...(spouseId ? (members.find(x => x.id === spouseId)?.children || []) : [])
    ])].filter(cid => {
      const c = members.find(x => x.id === cid);
      return c && !placed.has(cid);
    });

    // Recursively layout children to get their total width
    const childPos = childIds.length > 0
      ? computePositions(members, childIds, curX, startY + H + V_GAP, new Set(placed))
      : {};

    // Total width of children subtree
    let childrenWidth = 0;
    if (childIds.length > 0) {
      const childXs = childIds.map(cid => childPos[cid]?.x ?? curX).filter(Boolean);
      const minCX = Math.min(...childXs);
      const maxCX = Math.max(...childXs) + W;
      childrenWidth = maxCX - minCX;
      // Shift children to start at curX if needed
      const shift = curX - minCX;
      childIds.forEach(cid => {
        if (childPos[cid]) childPos[cid].x += shift;
        // Also shift their descendants
        Object.keys(childPos).forEach(k => {
          if (childPos[Number(k)]) childPos[Number(k)].x += shift;
        });
      });
    }

    // The unit should be centered over its children
    const totalW = Math.max(unitW, childrenWidth);
    const unitStartX = curX + (totalW - unitW) / 2;

    pos[id] = { x: unitStartX, y: startY, width: W };
    if (spouseId) {
      pos[spouseId] = { x: unitStartX + W + SPOUSE_GAP, y: startY, width: W };
    }

    // Merge child positions
    Object.assign(pos, childPos);

    curX += totalW + SIBLING_GAP;
  });

  return pos;
}

export default function FamilyTree({ members, selectedId, isAdmin, onSelect, onAddRelative }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  // ── LAYOUT ──────────────────────────────────────────────────────────
  // Group members by generation
  function genOf(id: number, vis = new Set<number>()): number {
    if (vis.has(id)) return 0; vis.add(id);
    const m = members.find(x => x.id === id);
    if (!m) return 0;
    const validParents = (m.parents || []).filter(p => members.find(x => x.id === p));
    if (!validParents.length) return 0;
    return Math.max(...validParents.map(p => genOf(p, new Set(vis)))) + 1;
  }

  const genMap: Record<number, number[]> = {};
  members.forEach(m => {
    const g = genOf(m.id);
    if (!genMap[g]) genMap[g] = [];
    genMap[g].push(m.id);
  });
  const genKeys = Object.keys(genMap).map(Number).sort((a, b) => a - b);

  // Assign positions generation by generation
  const pos: Record<number, { x: number; y: number }> = {};
  const globalPlaced = new Set<number>();

  genKeys.forEach((g, gi) => {
    const row = genMap[g].filter(id => !globalPlaced.has(id));
    let curX = 24;

    row.forEach(id => {
      if (globalPlaced.has(id)) return;
      const m = members.find(x => x.id === id);
      if (!m) return;
      globalPlaced.add(id);

      // Find spouse on same generation
      const spouseId = (m.spouses || []).find(sid => {
        if (globalPlaced.has(sid)) return false;
        const sg = genOf(sid);
        return sg === g;
      }) ?? null;

      if (spouseId !== null) globalPlaced.add(spouseId);

      // Children of this couple
      const childIds = [...new Set([
        ...(m.children || []),
        ...(spouseId !== null ? (members.find(x => x.id === spouseId)?.children || []) : [])
      ])].filter(cid => members.find(x => x.id === cid));

      // Compute how wide the children subtree is
      // (children are placed in next generation, so we look ahead)
      const nextGenIds = genMap[g + 1] || [];
      const myChildrenInNextGen = childIds.filter(cid => nextGenIds.includes(cid));
      const estimatedChildWidth = myChildrenInNextGen.length * (W + SIBLING_GAP) - SIBLING_GAP;

      const coupleWidth = spouseId !== null ? W + SPOUSE_GAP + W : W;
      const unitWidth = Math.max(coupleWidth, estimatedChildWidth > 0 ? estimatedChildWidth : coupleWidth);

      const unitStart = curX + Math.max(0, (unitWidth - coupleWidth) / 2);

      pos[id] = { x: unitStart, y: 24 + gi * (H + V_GAP) };
      if (spouseId !== null) {
        pos[spouseId] = { x: unitStart + W + SPOUSE_GAP, y: 24 + gi * (H + V_GAP) };
      }

      curX += unitWidth + SIBLING_GAP;
    });
  });

  // Second pass: center parents over their children
  for (let pass = 0; pass < 3; pass++) {
    for (let gi = genKeys.length - 2; gi >= 0; gi--) {
      const g = genKeys[gi];
      const row = genMap[g] || [];

      // Process couples together
      const processed = new Set<number>();
      row.forEach(id => {
        if (processed.has(id) || !pos[id]) return;
        processed.add(id);

        const m = members.find(x => x.id === id);
        if (!m) return;

        const spouseId = (m.spouses || []).find(sid => {
          const sg = genOf(sid);
          return sg === g && pos[sid];
        }) ?? null;
        if (spouseId !== null) processed.add(spouseId);

        // Get all children of this couple with positions
        const childIds = [...new Set([
          ...(m.children || []),
          ...(spouseId !== null ? (members.find(x => x.id === spouseId)?.children || []) : [])
        ])].filter(cid => pos[cid]);

        if (!childIds.length) return;

        const childXs = childIds.map(cid => pos[cid].x);
        const childCenter = (Math.min(...childXs) + Math.max(...childXs) + W) / 2;

        const coupleWidth = spouseId !== null ? W + SPOUSE_GAP + W : W;
        const coupleCenter = childCenter - coupleWidth / 2;

        const dx = coupleCenter - pos[id].x;
        if (Math.abs(dx) > 1) {
          pos[id].x += dx;
          if (spouseId !== null && pos[spouseId]) pos[spouseId].x += dx;
        }
      });
    }
  }

  // Resolve overlaps left→right per generation
  genKeys.forEach((g) => {
    const row = (genMap[g] || [])
      .filter(id => pos[id])
      .sort((a, b) => pos[a].x - pos[b].x);

    for (let i = 1; i < row.length; i++) {
      const prev = pos[row[i - 1]];
      const cur = pos[row[i]];
      const minX = prev.x + W + SIBLING_GAP;
      if (cur.x < minX) {
        const shift = minX - cur.x;
        // Shift this and all to the right in this generation
        for (let j = i; j < row.length; j++) {
          pos[row[j]].x += shift;
        }
        // Also shift children
        const m = members.find(x => x.id === row[i]);
        const shiftSubtree = (mid: number, dx: number, vis = new Set<number>()) => {
          if (vis.has(mid) || !pos[mid]) return;
          vis.add(mid);
          // Only shift if in a deeper generation
          const mg = genOf(mid);
          const rg = genOf(row[i]);
          if (mg > rg) {
            pos[mid].x += dx;
            const mc = members.find(x => x.id === mid);
            (mc?.children || []).forEach(cid => shiftSubtree(cid, dx, vis));
            (mc?.spouses || []).forEach(sid => {
              if (genOf(sid) === mg) pos[sid] && (pos[sid].x += dx);
            });
          }
        };
        if (m) {
          m.children.forEach(cid => shiftSubtree(cid, shift));
        }
      }
    }
  });

  // Normalize to start at x=24
  const allX = Object.values(pos).map(p => p.x).filter(x => !isNaN(x));
  const allY = Object.values(pos).map(p => p.y).filter(y => !isNaN(y));
  if (!allX.length) return <div style={{ padding: '2rem', color: '#9CA3AF', textAlign: 'center' }}>Chargement…</div>;

  const minX = Math.min(...allX);
  if (minX < 24) {
    const offset = 24 - minX;
    Object.keys(pos).forEach(k => { if (pos[Number(k)]) pos[Number(k)].x += offset; });
  }

  const svgW = Math.max(...Object.values(pos).map(p => p.x)) + W + 40;
  const svgH = Math.max(...Object.values(pos).map(p => p.y)) + H + 40;

  // ── DRAW LINES ──────────────────────────────────────────────────────
  const lines: string[] = [];
  const drawnCouples = new Set<string>();

  genKeys.forEach(g => {
    const row = genMap[g] || [];
    const processed = new Set<number>();

    row.forEach(id => {
      if (processed.has(id) || !pos[id]) return;
      processed.add(id);

      const m = members.find(x => x.id === id);
      if (!m) return;

      const spouseId = (m.spouses || []).find(sid => {
        const sg = genOf(sid);
        return sg === g && pos[sid];
      }) ?? null;
      if (spouseId !== null) processed.add(spouseId);

      // ── Spouse connector ──
      if (spouseId !== null && pos[spouseId]) {
        const coupleKey = [id, spouseId].sort().join('-');
        if (!drawnCouples.has(coupleKey)) {
          drawnCouples.add(coupleKey);
          const x1 = pos[id].x + W;
          const x2 = pos[spouseId].x;
          const y = pos[id].y + H / 2 - 8;
          const mx = (x1 + x2) / 2;
          // Dashed line
          lines.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#D4A843" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.8"/>`);
          // Heart
          lines.push(`<text x="${mx}" y="${y + 5}" text-anchor="middle" font-size="11" fill="#D4A843">♥</text>`);
        }
      }

      // ── Children connector ──
      const childIds = [...new Set([
        ...(m.children || []),
        ...(spouseId !== null ? (members.find(x => x.id === spouseId)?.children || []) : [])
      ])].filter(cid => {
        const c = members.find(x => x.id === cid);
        return c && pos[cid] && pos[cid].y > pos[id].y; // must be strictly below
      });

      if (!childIds.length) return;

      // Parent anchor = center of couple (or center of single parent)
      const leftX = pos[id].x;
      const rightX = spouseId !== null && pos[spouseId] ? pos[spouseId].x + W : pos[id].x + W;
      const parentCenterX = (leftX + rightX) / 2;
      const parentBottomY = pos[id].y + H;
      const forkY = parentBottomY + V_GAP * 0.42;

      // Vertical stem down from parent center
      lines.push(`<line x1="${parentCenterX}" y1="${parentBottomY}" x2="${parentCenterX}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);

      if (childIds.length === 1) {
        const cp = pos[childIds[0]];
        const cx = cp.x + W / 2;
        lines.push(`<line x1="${parentCenterX}" y1="${forkY}" x2="${cx}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
        lines.push(`<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${cp.y}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
      } else {
        // Horizontal bus
        const childXs = childIds.map(cid => pos[cid].x + W / 2);
        const busL = Math.min(...childXs);
        const busR = Math.max(...childXs);
        lines.push(`<line x1="${busL}" y1="${forkY}" x2="${busR}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
        childIds.forEach(cid => {
          const cp = pos[cid];
          const cx = cp.x + W / 2;
          lines.push(`<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${cp.y}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
        });
        // Connect stem to bus
        if (parentCenterX < busL || parentCenterX > busR) {
          lines.push(`<line x1="${parentCenterX}" y1="${forkY}" x2="${Math.min(Math.max(parentCenterX, busL), busR)}" y2="${forkY}" stroke="#B8CEAD" stroke-width="2" stroke-linecap="round"/>`);
        }
      }
    });
  });

  // ── GEN LABELS ──────────────────────────────────────────────────────
  const GEN_NAMES = ['Fondateurs', 'Enfants', 'Petits-enfants', 'Arrière-petits-enfants'];
  const genLabelsSvg = genKeys.map((g, gi) => {
    const row = (genMap[g] || []).filter(id => pos[id]);
    if (!row.length) return '';
    const y = 24 + gi * (H + V_GAP);
    return `<text x="4" y="${y + 13}" font-size="8" fill="#AABBA0" font-family="DM Sans,sans-serif" font-weight="600" letter-spacing="0.8">GÉN. ${g + 1}${GEN_NAMES[g] ? ' · ' + GEN_NAMES[g].toUpperCase() : ''}</text>
    <line x1="0" y1="${y - 6}" x2="${svgW}" y2="${y - 6}" stroke="#E8EDE4" stroke-width="0.75" stroke-dasharray="3,10"/>`;
  }).join('');

  return (
    <div style={{
      overflowX: 'auto', overflowY: 'auto',
      maxHeight: 'calc(100vh - 260px)',
      background: '#FAFAF7',
      borderRadius: 12,
      border: '1px solid #E8EDE4',
      padding: '4px',
    }}>
      <div style={{ position: 'relative', width: svgW, height: svgH }}>
        {/* Lines layer */}
        <svg width={svgW} height={svgH}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          dangerouslySetInnerHTML={{ __html: genLabelsSvg + lines.join('') }}
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
  );
}
