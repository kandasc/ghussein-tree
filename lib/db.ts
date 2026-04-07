import fs from 'fs';
import path from 'path';
import { Member, initialMembers } from './data';

const DB_PATH = path.join(process.cwd(), 'data', 'members.json');

function ensureDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(initialMembers, null, 2));
  }
}

export function readMembers(): Member[] {
  try {
    ensureDB();
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [...initialMembers];
  }
}

export function writeMembers(members: Member[]): void {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(members, null, 2));
}

export function addMember(member: Omit<Member, 'id'>): Member {
  const members = readMembers();
  const maxId = members.reduce((m, c) => Math.max(m, c.id), 0);
  const newMember: Member = { ...member, id: maxId + 1 };
  
  // Update related members
  if (newMember.parents) {
    newMember.parents.forEach(pid => {
      const parent = members.find(m => m.id === pid);
      if (parent && !parent.children.includes(newMember.id)) {
        parent.children.push(newMember.id);
      }
    });
  }
  if (newMember.spouses) {
    newMember.spouses.forEach(sid => {
      const spouse = members.find(m => m.id === sid);
      if (spouse && !spouse.spouses.includes(newMember.id)) {
        spouse.spouses.push(newMember.id);
      }
    });
  }
  
  members.push(newMember);
  writeMembers(members);
  return newMember;
}

export function updateMember(id: number, updates: Partial<Member>): Member | null {
  const members = readMembers();
  const idx = members.findIndex(m => m.id === id);
  if (idx === -1) return null;
  members[idx] = { ...members[idx], ...updates };
  writeMembers(members);
  return members[idx];
}

export function deleteMember(id: number): boolean {
  const members = readMembers();
  const idx = members.findIndex(m => m.id === id);
  if (idx === -1) return false;
  
  // Remove references
  members.forEach(m => {
    m.parents = m.parents.filter(p => p !== id);
    m.children = m.children.filter(c => c !== id);
    m.spouses = m.spouses.filter(s => s !== id);
  });
  
  members.splice(idx, 1);
  writeMembers(members);
  return true;
}
