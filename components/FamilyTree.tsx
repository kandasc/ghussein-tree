'use client';
import { useRef, useEffect, useState } from 'react';
import { Member } from '@/lib/data';
import MemberCard from './MemberCard';

interface Props {
  members: Member[];
  selectedId: number | null;
  isAdmin: boolean;
  onSelect: (id: number) => void;
  onAddRelative: (id: number, type: 'parent' | 'child' | 'spouse') => void;
}

const W = 160;
const H = 150;
const H_GAP = 24;  // horizontal gap between siblings
const V_GAP = 80;  // vertical gap between generations

interface Pos { x: number; y: number; }

function genOf(id: number, members: Member[], visited = new Set<number>()): number {
  if (visited.has(id)) return 0;
  visited.add(id);
  const m = members.find(x => x.id === id);
  if (!m || !m.parents.length) return 0;
  const valid = m.parents.filter(p => members.find(x => x.id === p));
  if (!valid.length) return 0;
  return Math.max(...valid.map(p => genOf(p, members, new Set(visited)))) + 1;
}

// Reingold–Tilford inspired: assign X by subtree width, center parents over children
function computeLayout(members: Member[]): Record<number, Pos> {
  // Group by generation
  const genMap: Record<number, number[]> = {};
  members.forEach(m => {
    const g = genOf(m.id, members);
    if (!genMap[g]) genMap[g] = [];
    genMap[g].push(m.id);
  });
  const genKeys = Object.keys(genMap).map(Number).sort((a, b) => a - b);

  // For each member, get direct children that exist in our members list
  const getChildren = (id: number) => {
    const m = members.find(x => x.id === id);
    return (m?.children || []).filter(cid => members.find(x => x.id === cid));
  };

  // Assign X positions bottom-up: leaves first, then center parents over their children
  const pos: Record<number, Pos> = {};
  const colWidth = W + H_GAP;

  // Start from deepest generation, assign sequential X
  // Then propagate up centering parents over children
  const maxGen = Math.max(...genKeys);

  // Assign X for leaves (deepest gen) sequentially
  // Then for each upper gen, center over children or place sequentially if no children
  
  // First pass: assign tentative X for all by generation order
  genKeys.forEach((g, gi) => {
    const row = genMap[g];
    row.forEach((id, i) => {
      pos[id] = { x: i * colWidth, y: gi * (H + V_GAP) };
    });
  });

  // Second pass: from bottom up, center parents over their children
  for (let g = maxGen - 1; g >= 0; g--) {
    const row = genMap[g] || [];
    row.forEach(id => {
      const children = getChildren(id).filter(cid => {
        const cg = genOf(cid, members);
        return cg > g;
      });
      if (children.length > 0 && children.every(cid => pos[cid] !== undefined)) {
        const childXs = children.map(cid => pos[cid].x);
        const centerX = (Math.min(...childXs) + Math.max(...childXs)) / 2;
        pos[id] = { ...pos[id], x: centerX };
      }
    });
  }

  // Third pass: resolve overlaps within each generation (left to right, maintain order)
  genKeys.forEach((g, gi) => {
    const row = [...(genMap[g] || [])];
    // Sort by current x
    row.sort((a, b) => (pos[a]?.x || 0) - (pos[b]?.x || 0));
    // Ensure no overlap
    for (let i = 1; i < row.length; i++) {
      const prev = pos[row[i - 1]];
      const cur = pos[row[i]];
      if (cur.x < prev.x + colWidth) {
        pos[row[i]] = { ...cur, x: prev.x + colWidth };
      }
    }
    // Re-center parents after resolving overlaps (bottom-up already done, but re-apply y)
    row.forEach(id => {
      pos[id] = { ...pos[id], y: gi * (H + V_GAP) };
    });
  });

  // Normalize: shift everything so min x = 20
  const allX = Object.values(pos).map(p => p.x);
  const minX = Math.min(...allX);
  const offset = 20 - minX;
  Object.keys(pos).forEach(k => {
    pos[Number(k)].x += offset;
    pos[Number(k)].y += 20;
  });

  return pos;
}

export default function FamilyTree({ members, selectedId, isAdmin, onSelect, onAddRelative }: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const pos = computeLayout(members);

  const allX = Object.values(pos).map(p => p.x);
  const allY = Object.values(pos).map(p => p.y);
  const svgW = allX.length ? Math.max(...allX) + W + 40 : 800;
  const svgH = allY.length ? Math.max(...allY) + H + 40 : 600;

  // Build SVG connection lines
  const lines: string[] = [];

  members.forEach(m => {
    const mp = pos[m.id];
    if (!mp) return;

    // Parent → Children: draw a clean fork
    const validChildren = (m.children || []).filter(cid => {
      const cp = pos[cid];
      if (!cp) return false;
      // Only draw if this member is clearly above the child
      return cp.y > mp.y;
    });

    if (validChildren.length > 0) {
      const childPositions = validChildren.map(cid => pos[cid]).filter(Boolean);
      const parentX = mp.x + W / 2;
      const parentY = mp.y + H;
      const forkY = parentY + V_GAP * 0.45;

      if (validChildren.length === 1) {
        // Simple straight line to single child
        const cp = childPositions[0];
        const childX = cp.x + W / 2;
        const childY = cp.y;
        lines.push(
          `<path d="M${parentX},${parentY} L${parentX},${forkY} L${childX},${forkY} L${childX},${childY}"
           stroke="#C8D8B4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        );
      } else {
        // Horizontal bus connecting all children
        const childXs = childPositions.map(cp => cp.x + W / 2);
        const busLeft = Math.min(...childXs);
        const busRight = Math.max(...childXs);

        // Vertical down from parent to fork
        lines.push(
          `<line x1="${parentX}" y1="${parentY}" x2="${parentX}" y2="${forkY}"
           stroke="#C8D8B4" stroke-width="2" stroke-linecap="round"/>`
        );
        // Horizontal bus
        lines.push(
          `<line x1="${busLeft}" y1="${forkY}" x2="${busRight}" y2="${forkY}"
           stroke="#C8D8B4" stroke-width="2" stroke-linecap="round"/>`
        );
        // Vertical down to each child
        validChildren.forEach(cid => {
          const cp = pos[cid];
          if (!cp) return;
          const cx = cp.x + W / 2;
          lines.push(
            `<line x1="${cx}" y1="${forkY}" x2="${cx}" y2="${cp.y}"
             stroke="#C8D8B4" stroke-width="2" stroke-linecap="round"/>`
          );
        });
      }
    }

    // Spouse connection: short horizontal dashed line between spouses on same row
    (m.spouses || []).forEach(sid => {
      if (sid <= m.id) return;
      const sp = pos[sid];
      if (!sp) return;
      if (Math.abs(mp.y - sp.y) > 10) return; // only same-row spouses
      const x1 = mp.x < sp.x ? mp.x + W : mp.x;
      const x2 = mp.x < sp.x ? sp.x : sp.x + W;
      const y = mp.y + H / 2 - 10;
      lines.push(
        `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
         stroke="#D4A843" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.7"/>`
      );
      // Heart symbol at midpoint
      const mx = (x1 + x2) / 2;
      lines.push(
        `<text x="${mx}" y="${y + 5}" text-anchor="middle" font-size="10" fill="#D4A843" opacity="0.8">♥</text>`
      );
    });
  });

  // Generation labels
  const genMap: Record<number, number[]> = {};
  members.forEach(m => {
    const g = genOf(m.id, members);
    if (!genMap[g]) genMap[g] = [];
    genMap[g].push(m.id);
  });
  const genLabels = ['Fondateurs', 'Enfants', 'Petits-enfants', 'Arrière-petits-enfants'];
  const genLines: string[] = [];
  Object.keys(genMap).map(Number).sort((a, b) => a - b).forEach((g, gi) => {
    const row = genMap[g];
    if (!row?.length) return;
    const firstId = row.find(id => pos[id]);
    if (!firstId) return;
    const fp = pos[firstId];
    const label = `GÉN. ${g + 1}${genLabels[g] ? ' — ' + genLabels[g].toUpperCase() : ''}`;
    genLines.push(
      `<text x="6" y="${fp.y + 14}" font-size="8" fill="#AABBAA" font-family="DM Sans,sans-serif" font-weight="600" letter-spacing="1">${label}</text>`
    );
    // Subtle horizontal rule
    genLines.push(
      `<line x1="0" y1="${fp.y - 8}" x2="${svgW}" y2="${fp.y - 8}" stroke="#E8EDE4" stroke-width="1" stroke-dasharray="4,8"/>`
    );
  });

  return (
    <div style={{
      overflowX: 'auto', overflowY: 'auto',
      maxHeight: 'calc(100vh - 260px)',
      background: '#FAFAF7',
      borderRadius: 12,
      border: '1px solid #E8EDE4',
    }}>
      <div style={{ position: 'relative', width: svgW, height: svgH, minWidth: '100%' }}>
        {/* Background SVG: lines + labels */}
        <svg
          width={svgW}
          height={svgH}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          dangerouslySetInnerHTML={{ __html: genLines.join('') + lines.join('') }}
        />
        {/* Member cards */}
        {members.map(m => {
          const p = pos[m.id];
          if (!p) return null;
          return (
            <div
              key={m.id}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                transition: 'transform 0.15s ease',
                transform: hoveredId === m.id ? 'translateY(-3px)' : 'none',
                zIndex: m.id === selectedId ? 10 : 1,
              }}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
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
