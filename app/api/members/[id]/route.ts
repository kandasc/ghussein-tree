import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateMember, deleteMember } from '@/lib/db-neon';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await updateMember(Number(id), body);
    if (!updated) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('PUT /api/members/[id] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  try {
    const { id } = await params;
    const ok = await deleteMember(Number(id));
    if (!ok) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/members/[id] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
