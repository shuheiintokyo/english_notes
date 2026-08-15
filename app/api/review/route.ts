
import { NextRequest, NextResponse } from 'next/server';
import { createNote, updateNote } from '@/lib/nocodb';
import { reviewWithGemini } from '@/lib/ai';

export const maxDuration = 30; // Vercel hobby can be up to 60s, keep 30

export async function POST(req: NextRequest) {
  try {
    const { original_text, created_at } = await req.json();

    if (!original_text || original_text.trim().length === 0) {
      return NextResponse.json({ error: 'original_text required' }, { status: 400 });
    }

    const safeText = original_text.slice(0, 5000);

    // 1. Create NocoDB row as reviewing immediately (so client can show レビュー中 without waiting for AI)
    let remoteRow;
    try {
      remoteRow = await createNote({
        original_text: safeText,
        status: 'reviewing',
        created_at: created_at || new Date().toISOString(),
      });
    } catch (e: any) {
      // If NocoDB not configured, still do AI review (local-only fallback)
      console.warn('NocoDB create failed, continuing with AI only', e.message);
    }

    const remoteId = remoteRow?.Id || remoteRow?.id || null;

    // 2. Call Gemini 1.5 Flash
    const result = await reviewWithGemini(safeText);

    // 3. Update NocoDB to reviewed
    if (remoteId) {
      try {
        await updateNote(remoteId, {
          status: 'reviewed',
          corrected_text: result.corrected_text,
          explanation_ja: result.explanation_ja,
          reviewed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('NocoDB update failed', e);
      }
    }

    return NextResponse.json({
      remoteId,
      status: 'reviewed',
      corrected_text: result.corrected_text,
      explanation_ja: result.explanation_ja,
      reviewed_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
