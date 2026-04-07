import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readMembers, addMember } from '@/lib/db';

export async function GET() {
  const members = readMembers();
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json();
  const { relatedId, relType, ...memberData } = body;

  const newMember = addMember({
    ...memberData,
    parents: memberData.parents || [],
    children: memberData.children || [],
    spouses: memberData.spouses || [],
  });

  // Apply relationship
  if (relatedId && relType) {
    const { updateMember, readMembers: rm } = await import('@/lib/db');
    const all = rm();
    const target = all.find((m) => m.id === relatedId);
    if (target) {
      if (relType === 'parent') {
        updateMember(newMember.id, { children: [...newMember.children, relatedId] });
        updateMember(relatedId, { parents: [...target.parents, newMember.id] });
      } else if (relType === 'child') {
        updateMember(newMember.id, { parents: [...newMember.parents, relatedId] });
        updateMember(relatedId, { children: [...target.children, newMember.id] });
      } else if (relType === 'spouse') {
        updateMember(newMember.id, { spouses: [...newMember.spouses, relatedId] });
        updateMember(relatedId, { spouses: [...target.spouses, newMember.id] });
      }
    }
  }

  return NextResponse.json(newMember, { status: 201 });
}
