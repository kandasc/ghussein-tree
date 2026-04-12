import { NextResponse } from 'next/server';
import { getDb } from '@/lib/neon';
import { initialMembers } from '@/lib/data';

export async function GET() {
  try {
    const sql = getDb();
    await (sql as any)`DROP TABLE IF EXISTS family_members`;
    await (sql as any)`
      CREATE TABLE family_members (
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
    for (const m of initialMembers) {
      await (sql as any)`
        INSERT INTO family_members (id, name, gender, birth, birth_place, dead, death_info, note, parents, children, spouses, rank, photo_url)
        VALUES (
          ${m.id}, ${m.name}, ${m.gender||''}, ${m.birth||''}, ${m.birthPlace||''},
          ${m.dead||false}, ${m.deathInfo||''}, ${m.note||''},
          ${m.parents}, ${m.children}, ${m.spouses}, ${m.rank||null}, ${m.photoUrl||null}
        )
      `;
    }
    await (sql as any)`SELECT setval('family_members_id_seq', (SELECT MAX(id) FROM family_members) + 1)`;
    return NextResponse.json({ success: true, count: initialMembers.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
