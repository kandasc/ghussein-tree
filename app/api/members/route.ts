import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readMembers, addMember, updateMember } from '@/lib/db-neon';

export async function GET() {
  try {
    const members = await readMembers();
    return NextResponse.json(members);
  } catch (e) {
    console.error('GET /api/members error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  try {
    const body = await req.json();
    const { relatedId, relType, ...memberData } = body;

    const newMember = await addMember({
      name: memberData.name,
      gender: memberData.gender || '',
      birth: memberData.birth || '',
      birthPlace: memberData.birthPlace || '',
      dead: memberData.dead || false,
      deathInfo: memberData.deathInfo || '',
      note: memberData.note || '',
      parents: memberData.parents || [],
      children: memberData.children || [],
      spouses: memberData.spouses || [],
    });

    // Apply relationship bidirectionally
    if (relatedId && relType) {
      const allMembers = await readMembers();
      const target = allMembers.find(m => m.id === relatedId);
      if (target) {
        if (relType === 'parent') {
          await updateMember(newMember.id, { children: [...(newMember.children || []), relatedId] });
          await updateMember(relatedId, { parents: [...target.parents, newMember.id] });
        } else if (relType === 'child') {
          await updateMember(newMember.id, { parents: [...(newMember.parents || []), relatedId] });
          await updateMember(relatedId, { children: [...target.children, newMember.id] });
        } else if (relType === 'spouse') {
          await updateMember(newMember.id, { spouses: [...(newMember.spouses || []), relatedId] });
          await updateMember(relatedId, { spouses: [...target.spouses, newMember.id] });
        }
      }
    }

    return NextResponse.json(newMember, { status: 201 });
  } catch (e) {
    console.error('POST /api/members error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
