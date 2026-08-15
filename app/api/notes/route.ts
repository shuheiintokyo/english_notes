
import { NextResponse } from 'next/server';
import { listNotes } from '@/lib/nocodb';

export async function GET() {
  try {
    const notes = await listNotes();
    return NextResponse.json({ notes });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
