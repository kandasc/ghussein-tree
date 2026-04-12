import { neon } from '@neondatabase/serverless';
import { Member } from './data';

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return neon(url);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMember(row: any): Member {
  return {
    id: row.id,
    name: row.name,
    gender: (row.gender || '') as 'M' | 'F' | '',
    birth: row.birth || '',
    birthPlace: row.birth_place || '',
    dead: row.dead || false,
    deathInfo: row.death_info || '',
    note: row.note || '',
    parents: row.parents || [],
    children: row.children || [],
    spouses: row.spouses || [],
    rank: row.rank || undefined,
    photoUrl: row.photo_url || undefined,
  };
}

async function ensureTable() {
  const sql = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sql as any)`
    CREATE TABLE IF NOT EXISTS family_members (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      gender VARCHAR(1) DEFAULT '',
      birth VARCHAR(20) DEFAULT '',
      birth_place VARCHAR(255) DEFAULT '',
      dead BOOLEAN DEFAULT FALSE,
      death_info VARCHAR(255) DEFAULT '',
      note TEXT DEFAULT '',
      parents INTEGER[] DEFAULT '{}',
      children INTEGER[] DEFAULT '{}',
      spouses INTEGER[] DEFAULT '{}',
      rank INTEGER DEFAULT NULL,
      photo_url TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export async function readMembers(): Promise<Member[]> {
  const sql = getDb();
  await ensureTable();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (sql as any)`SELECT * FROM family_members ORDER BY id` as any[];
  const members = rows.map(rowToMember);
  if (members.length === 0) {
    await seedInitialData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seeded = await (sql as any)`SELECT * FROM family_members ORDER BY id` as any[];
    return seeded.map(rowToMember);
  }
  return members;
}

export async function addMember(member: Omit<Member, 'id'>): Promise<Member> {
  const sql = getDb();
  await ensureTable();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (sql as any)`
    INSERT INTO family_members (name, gender, birth, birth_place, dead, death_info, note, parents, children, spouses, rank, photo_url)
    VALUES (
      ${member.name}, ${member.gender||''}, ${member.birth||''},
      ${member.birthPlace||''}, ${member.dead||false},
      ${member.deathInfo||''}, ${member.note||''},
      ${member.parents||[]}, ${member.children||[]}, ${member.spouses||[]},
      ${member.rank||null}, ${member.photoUrl||null}
    )
    RETURNING *
  ` as any[];
  return rowToMember(rows[0]);
}

export async function updateMember(id: number, updates: Partial<Member>): Promise<Member | null> {
  const sql = getDb();
  await ensureTable();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = await (sql as any)`SELECT * FROM family_members WHERE id = ${id}` as any[];
  if (!current.length) return null;
  const cur = rowToMember(current[0]);
  const m = { ...cur, ...updates };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (sql as any)`
    UPDATE family_members SET
      name=${m.name}, gender=${m.gender||''}, birth=${m.birth||''},
      birth_place=${m.birthPlace||''}, dead=${m.dead||false},
      death_info=${m.deathInfo||''}, note=${m.note||''},
      parents=${m.parents||[]}, children=${m.children||[]}, spouses=${m.spouses||[]},
      rank=${m.rank||null}, photo_url=${m.photoUrl||null}, updated_at=NOW()
    WHERE id=${id} RETURNING *
  ` as any[];
  if (!rows.length) return null;
  return rowToMember(rows[0]);
}

export async function deleteMember(id: number): Promise<boolean> {
  const sql = getDb();
  await ensureTable();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sql as any)`
    UPDATE family_members SET
      parents=array_remove(parents,${id}),
      children=array_remove(children,${id}),
      spouses=array_remove(spouses,${id}),
      updated_at=NOW()
    WHERE ${id}=ANY(parents) OR ${id}=ANY(children) OR ${id}=ANY(spouses)
  `;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (sql as any)`DELETE FROM family_members WHERE id=${id} RETURNING id` as any[];
  return result.length > 0;
}

async function seedInitialData() {
  const sql = getDb();
  const { initialMembers } = await import('./data');
  for (const m of initialMembers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sql as any)`
      INSERT INTO family_members (id, name, gender, birth, birth_place, dead, death_info, note, parents, children, spouses, rank)
      VALUES (
        ${m.id}, ${m.name}, ${m.gender||''}, ${m.birth||''}, ${m.birthPlace||''},
        ${m.dead||false}, ${m.deathInfo||''}, ${m.note||''},
        ${m.parents}, ${m.children}, ${m.spouses}, ${m.rank||null}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (sql as any)`SELECT setval('family_members_id_seq', (SELECT MAX(id) FROM family_members) + 1)`;
}
