import { NextRequest, NextResponse } from 'next/server';
import { listNotes, deleteNote } from '@/lib/nocodb';

export async function GET() {
  try {
    const notes = await listNotes();
    return NextResponse.json({ notes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { remoteId } = await req.json();
    if (!remoteId) {
      return NextResponse.json({ error: 'remoteId required' }, { status: 400 });
    }
    await deleteNote(remoteId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
