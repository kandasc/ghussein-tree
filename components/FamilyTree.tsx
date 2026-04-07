'use client';
import { useRef, useEffect } from 'react';
import { Member } from '@/lib/data';
import MemberCard from './MemberCard';

interface Props {
  members: Member[];
  selectedId: number | null;
  isAdmin: boolean;
  onSelect: (id: number) => void;
  onAddRelative: (id: number, type: 'parent' | 'child' | 'spouse') => void;
}

const W = 158, H = 152, GAP_X = 20, GAP_Y = 28, PAD = 24;

function genOf(id: number, members: Member[], visited = new Set<number>()): number {
  if (visited.has(id)) return 0;
  visited.add(id);
  const m = members.find(x => x.id === id);
  if (!m || !m.parents.length) return 0;
  const validParents = m.parents.filter(p => members.find(x => x.id === p));
  if (!validParents.length) return 0;
  const pg = validParents.map(p => genOf(p, members, new Set(visited)));
  return Math.max(...pg) + 1;
}

function computeLayout(members: Member[]) {
  const genMap: Record<number, Member[]> = {};
  members.forEach(m => {
    const g = genOf(m.id, members);
    if (!genMap[g]) genMap[g] = [];
    genMap[g].push(m);
  });
  const genKeys = Object.keys(genMap).map(Number).sort((a, b) => a - b);
  const positions: Record<number, { x: number; y: number }> = {};
  genKeys.forEach((g, gi) => {
    genMap[g].forEach((m, i) => {
      positions[m.id] = {
        x: PAD + i * (W + GAP_X),
        y: PAD + gi * (H + GAP_Y),
      };
    });
  });
  return { positions, genKeys, genMap };
}

export default function FamilyTree({ members, selectedId, isAdmin, onSelect, onAddRelative }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { positions, genKeys, genMap } = computeLayout(members);

  const allX = Object.values(positions).map(p => p.x);
  const allY = Object.values(positions).map(p => p.y);
  const svgW = allX.length ? Math.max(...allX) + W + PAD : 800;
  const svgH = allY.length ? Math.max(...allY) + H + PAD : 600;

  // Build SVG paths
  const lines: string[] = [];
  members.forEach(m => {
    const pos = positions[m.id];
    if (!pos) return;
    // Children lines
    (m.children || []).forEach(cid => {
      const cp = positions[cid];
      if (!cp) return;
      const x1 = pos.x + W / 2, y1 = pos.y + H - 30;
      const x2 = cp.x + W / 2, y2 = cp.y + 20;
      const my = (y1 + y2) / 2;
      lines.push(`<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" stroke="#D1D5DB" stroke-width="1.5" fill="none"/>`);
    });
    // Spouse lines
    (m.spouses || []).forEach(sid => {
      if (sid <= m.id) return;
      const sp = positions[sid];
      if (!sp) return;
      const x1 = pos.x + W, y1 = pos.y + H / 2 - 12;
      const x2 = sp.x, y2 = sp.y + H / 2 - 12;
      if (Math.abs(y1 - y2) < 80) {
        lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#B8860B" stroke-width="1" stroke-dasharray="5,3" opacity="0.6"/>`);
      }
    });
  });

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
      <div id="tree-canvas" style={{ position: 'relative', width: svgW, height: svgH, minWidth: '100%' }}>
        {/* SVG lines */}
        <svg
          ref={svgRef}
          width={svgW}
          height={svgH}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          dangerouslySetInnerHTML={{ __html: lines.join('') + genKeys.map((g) => {
            const row = genMap[g];
            if (!row?.length) return '';
            const fp = positions[row[0].id];
            if (!fp) return '';
            const labels: Record<number, string> = { 0: 'GÉN. 1 — FONDATEURS', 1: 'GÉN. 2 — ENFANTS', 2: 'GÉN. 3 — PETITS-ENFANTS', 3: 'GÉN. 4', 4: 'GÉN. 5' };
            return `<text x="6" y="${fp.y + 11}" font-size="8" fill="#9CA3AF" font-family="DM Sans,sans-serif" font-weight="500" letter-spacing="0.8">${labels[g] || `GÉN. ${g + 1}`}</text>`;
          }).join('') }}
        />
        {/* Member cards */}
        {members.map(m => {
          const pos = positions[m.id];
          if (!pos) return null;
          return (
            <div key={m.id} className="member-card" style={{ left: pos.x, top: pos.y }}>
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
