'use client';
import { useEffect, useState, useRef } from 'react';
import { LocalNote, saveLocal, getAllLocal, deleteLocal } from '@/lib/offline';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function calculateStreak(notesList: LocalNote[]): number {
  if (notesList.length === 0) return 0;
  const dates = Array.from(new Set(notesList.map(n => n.created_at.split('T')[0])))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  if (dates.length === 0) return 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

  let streak = 0;
  let expectedDate = new Date(dates[0]);
  for (const dateStr of dates) {
    const currentDate = new Date(dateStr);
    const diffDays = Math.round((expectedDate.getTime() - currentDate.getTime()) / 86400000);
    if (diffDays === 0) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export default function App() {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<'corrected'|'original'|'explanation'>('corrected');
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selected = notes.find(n => n.localId === selectedId) || null;
  const streak = calculateStreak(notes);

  const filteredNotes = notes.filter(n =>
    n.original_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (n.corrected_text?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const load = async () => {
    const all = await getAllLocal();
    setNotes(all);
  };

  useEffect(() => {
    load();
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [draft, selectedId]);

  useEffect(() => {
    if (online) {
      syncPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleNew = () => {
    setSelectedId(null);
    setDraft('');
    setTab('corrected');
    setView('editor');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleBack = () => {
    setSelectedId(null);
    setDraft('');
    setView('list');
  };

  const handleSelect = (id: string) => {
    const n = notes.find(x => x.localId === id);
    if (!n) return;
    setSelectedId(id);
    setDraft(n.original_text);
    setTab(n.status === 'reviewed' ? 'corrected' : 'original');
    setView('editor');
    window.scrollTo(0,0);
  };

  const handleSave = async () => {
    if (!draft.trim()) return;
    const now = new Date().toISOString();
    let note: LocalNote;
    if (selected) {
      note = { ...selected, original_text: draft, created_at: selected.created_at, dirty: true, status: 'pending' as const, corrected_text: undefined, explanation_ja: undefined, reviewed_at: null };
    } else {
      note = {
        localId: uid(),
        original_text: draft,
        status: 'pending',
        created_at: now,
        reviewed_at: null,
        dirty: true,
      };
    }
    await saveLocal(note);
    await load();
    setSelectedId(note.localId);
    showToast('保存しました - オフラインでもOK');
    if (online) {
      triggerReview(note);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const triggerReview = async (note: LocalNote) => {
    const reviewing: LocalNote = { ...note, status: 'reviewing', dirty: false };
    await saveLocal(reviewing);
    await load();

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_text: note.original_text, created_at: note.created_at }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'review failed');

      const reviewed: LocalNote = {
        ...reviewing,
        status: 'reviewed',
        corrected_text: data.corrected_text,
        explanation_ja: data.explanation_ja,
        reviewed_at: data.reviewed_at,
        remoteId: data.remoteId || reviewing.remoteId,
        dirty: false,
      };
      await saveLocal(reviewed);
      await load();
      showToast('レビューが完了しました');
    } catch (e: any) {
      console.error(e);
      const failed: LocalNote = { ...reviewing, status: 'pending', dirty: true };
      await saveLocal(failed);
      await load();
      showToast('レビューに失敗 - 後で再試行します');
    }
  };

  const syncPending = async () => {
    const all = await getAllLocal();
    const pending = all.filter(n => n.dirty && n.status === 'pending');
    if (pending.length === 0 || syncing) return;
    setSyncing(true);
    for (const p of pending) {
      await triggerReview(p);
    }
    setSyncing(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm('このノートを削除しますか？')) return;
    await deleteLocal(selected.localId);
    await load();
    setSelectedId(null);
    setDraft('');
    setView('list');
    showToast('削除しました');
  };

  const copyCorrected = async () => {
    if (!selected?.corrected_text) return;
    await navigator.clipboard.writeText(selected.corrected_text);
    showToast('コピーしました');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center">
      <div className="w-full max-w-[430px] min-h-[100dvh] bg-white shadow-sm relative flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100 px-4 h-[56px] flex items-center justify-between">
          {view === 'list' ? (
            <>
              <div>
                <h1 className="font-bold text-[17px] tracking-tight">英語添削ノート</h1>
                <p className="text-[11px] text-slate-500 -mt-0.5">書いて、後で学ぶ</p>
              </div>
              <div className="flex items-center gap-2">
                {streak > 0 && (
                  <span className="text-[10px] px-2 py-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    🔥 {streak}日連続!
                  </span>
                )}
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${online ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border'}`}>
                  {online ? '● オンライン' : '○ オフライン'}
                </span>
                <button onClick={() => setOnline(!online)} className="text-[10px] px-2 py-1 rounded-full border bg-white">切替(デモ)</button>
              </div>
            </>
          ) : (
            <>
              <button onClick={handleBack} className="text-[14px] font-medium text-slate-600">← 一覧</button>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-1 rounded-full ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{online ? 'オンライン' : 'オフライン'}</span>
                {selected && <button onClick={handleDelete} className="text-[12px] text-red-500 px-2 py-1 rounded-full border border-red-200">削除</button>}
              </div>
            </>
          )}
        </div>

        {/* List or Editor */}
        {view === 'list' ? (
          // LIST
          <div className="flex-1 flex flex-col">
            {notes.length > 0 && (
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                <input
                  type="text"
                  placeholder="過去のノートを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 transition"
                />
              </div>
            )}
            <div className="flex-1 px-4 py-4 pb-28">
              {filteredNotes.length === 0 ? (
                <div className="mt-16 text-center px-6">
                  <div className="text-4xl mb-3">✍️</div>
                  <p className="font-semibold text-[15px]">
                    {searchQuery ? '検索結果が見つかりません' : 'まだノートがありません'}
                  </p>
                  <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                    {searchQuery
                      ? 'キーワードを変えて検索するか、新しく書いてみましょう！'
                      : <>最初の英語メモを書いてみましょう。<br/>オフラインでも保存できます。</>}
                  </p>
                  {!searchQuery && (
                    <button onClick={handleNew} className="mt-6 h-11 px-6 rounded-full bg-indigo-600 text-white text-[14px] font-semibold shadow">新規作成</button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {syncing && <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">同期中... {notes.filter(n=>n.status==='pending').length}件</div>}
                  {filteredNotes.map(n => (
                    <button key={n.localId} onClick={() => handleSelect(n.localId)} className="w-full text-left rounded-[16px] border border-slate-200 p-4 bg-white hover:border-slate-300 transition">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-[11px] text-slate-400">{formatDate(n.created_at)}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          n.status==='pending' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          n.status==='reviewing' ? 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse' :
                          'bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                          {n.status==='pending' ? '未送信' : n.status==='reviewing' ? 'レビュー中' : 'レビュー済み'}
                        </span>
                      </div>
                      <p className="text-[14px] leading-[1.6] line-clamp-2">{n.original_text.slice(0,120)}</p>
                      {n.status==='reviewed' && n.corrected_text && (
                        <p className="text-[12px] text-slate-500 mt-1.5 line-clamp-1">✓ {n.corrected_text.slice(0,80)}</p>
                      )}
                    </button>
                  ))}
                  <div className="pt-6 text-center">
                    <p className="text-[11px] text-slate-400 leading-relaxed">オフラインでも保存できます。<br/>接続時に自動でレビューされます</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // EDITOR
          <div className="flex-1 px-4 py-4 pb-10">
            <div className="rounded-[16px] border border-slate-200 bg-white p-3 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="英語で書いてみよう...&#10;例: I went to Shibuya yesterday. It was very fun!"
                className="w-full min-h-[160px] max-h-[50vh] resize-none outline-none text-[16px] leading-[1.7] placeholder:text-slate-400"
                rows={5}
                autoFocus
              />
              <div className="flex justify-between items-center mt-2 px-1">
                <span className="text-[11px] text-slate-400">{draft.trim() ? `${draft.trim().split(/\s+/).filter(Boolean).length}語` : '日本語は解説に使われます'}</span>
                <span className="text-[11px] text-slate-400">{draft.length}文字</span>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              <button onClick={handleSave} disabled={!draft.trim()} className={`w-full h-12 rounded-full font-semibold text-[15px] flex items-center justify-center gap-2 transition ${!draft.trim() ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white shadow-[0_4px_16px_rgba(79,70,229,0.25)] hover:bg-indigo-700 active:scale-[0.98]'}`}>保存する</button>
              {selected && selected.status==='pending' && !online && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 flex gap-2.5">
                  <span className="text-slate-400">◍</span>
                  <p className="text-[12px] leading-[1.6] text-slate-600">オフラインです。接続時に自動でレビューされます。<br/><span className="text-slate-500">メモはこの端末に保存済みです。</span></p>
                </div>
              )}
              {selected && selected.status==='pending' && online && (
                <button onClick={() => triggerReview(selected)} className="w-full h-11 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 font-medium text-[14px]">今すぐレビューする</button>
              )}
            </div>

            {/* Tabs */}
            {(selected || draft.trim()) && (
              <div className="mt-8">
                <div className="sticky top-[56px] z-10 bg-white/95 backdrop-blur -mx-4 px-4 border-b border-slate-100">
                  <div className="flex gap-6">
                    {[
                      {id:'corrected', label:'添削文'},
                      {id:'original', label:'元の文'},
                      {id:'explanation', label:'解説'}
                    ].map(t => (
                      <button key={t.id} onClick={() => setTab(t.id as any)} className={`relative py-3 text-[13px] font-semibold tracking-wide ${tab===t.id ? 'text-slate-900' : 'text-slate-400'}`}>
                        {t.label}
                        {tab===t.id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-900 rounded-full" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  {tab==='corrected' && (
                    <div>
                      {!selected ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[13px] text-slate-500">保存すると、ここに添削文が表示されます</div> :
                       selected.status==='pending' ? <div className="rounded-2xl bg-slate-50 border p-5 text-center"><p className="text-[13px] text-slate-600">レビュー待ちです</p><p className="text-[11px] text-slate-400 mt-1">接続後に自動で処理されます</p></div> :
                       selected.status==='reviewing' ? <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5"><div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/><p className="text-[13px] font-medium text-amber-800">コーチが確認中...</p></div><p className="text-[11px] text-amber-700/70 mt-2">通常1-2秒で完了します</p></div> :
                       <div className="space-y-3">
                         <div className="rounded-[16px] bg-white border p-4 shadow-sm"><p className="text-[15px] leading-[1.8] whitespace-pre-wrap">{selected.corrected_text}</p></div>
                         <button onClick={copyCorrected} className="w-full h-10 rounded-full border bg-white text-[13px] font-medium">⎙ コピー</button>
                         {selected.reviewed_at && <p className="text-[11px] text-slate-400">レビュー完了: {formatDate(selected.reviewed_at)}</p>}
                       </div>
                      }
                    </div>
                  )}
                  {tab==='original' && (
                    <div className="rounded-[16px] bg-slate-50 border p-4"><p className="text-[14px] leading-[1.8] whitespace-pre-wrap font-mono text-slate-700">{selected ? selected.original_text : draft || '(未保存)'}</p></div>
                  )}
                  {tab==='explanation' && (
                    <div>
                      {!selected || selected.status!=='reviewed' ? <div className="rounded-2xl border border-dashed p-6 text-center text-[13px] text-slate-500">レビュー後にここに解説が表示されます<br/><span className="text-[11px] text-slate-400">文法・自然さ・覚えるポイントを日本語で解説します</span></div> :
                        <div className="rounded-[16px] bg-amber-50/70 border border-amber-200 p-4"><div className="flex items-center gap-2 mb-3"><span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-[12px]">✎</span><p className="text-[13px] font-semibold text-amber-900">コーチからの解説</p></div><pre className="whitespace-pre-wrap font-[inherit] text-[13px] leading-[1.9] text-slate-800">{selected.explanation_ja}</pre></div>
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FAB */}
        {view === 'list' && (
          <button onClick={handleNew} className="fixed bottom-6 right-[max(16px,calc(50%-195px))] w-14 h-14 rounded-full bg-indigo-600 text-white shadow-[0_8px_24px_rgba(79,70,229,0.4)] flex items-center justify-center text-2xl active:scale-95 transition">+</button>
        )}

        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[13px] px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap z-50">{toast}</div>}
      </div>
    </div>
  );
}
