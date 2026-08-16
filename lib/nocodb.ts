
export type NocoRow = {
  Id?: number;
  id?: number;
  original_text: string;
  status: 'pending' | 'reviewing' | 'reviewed';
  corrected_text?: string;
  explanation_ja?: string;
  created_at: string;
  reviewed_at?: string;
};

function getConfig() {
  const url = process.env.NOCODB_URL!;
  const token = process.env.NOCODB_TOKEN!;
  const tableId = process.env.NOCODB_TABLE_ID!;
  if (!url || !token || !tableId) throw new Error('NocoDB env missing');
  return { url, token, tableId };
}

export async function createNote(row: NocoRow) {
  const { url, token, tableId } = getConfig();
  const res = await fetch(`${url}/api/v2/tables/${tableId}/records`, {
    method: 'POST',
    headers: { 'xc-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`NocoDB create failed ${res.status}: ${t}`);
  }
  return res.json();
}

export async function updateNote(id: number, patch: Partial<NocoRow>) {
  const { url, token, tableId } = getConfig();
  const res = await fetch(`${url}/api/v2/tables/${tableId}/records`, {
    method: 'PATCH',
    headers: { 'xc-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Id: id, ...patch }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`NocoDB update failed ${res.status}: ${t}`);
  }
  return res.json();
}

export async function listNotes() {
  const { url, token, tableId } = getConfig();
  const res = await fetch(`${url}/api/v2/tables/${tableId}/records?limit=100&sort=-created_at`, {
    headers: { 'xc-token': token },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('NocoDB list failed');
  const data = await res.json();
  return data.list as NocoRow[];
}

export async function deleteNote(id: number) {
  const { url, token, tableId } = getConfig();
  const res = await fetch(`${url}/api/v2/tables/${tableId}/records`, {
    method: 'DELETE',
    headers: { 'xc-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Id: id }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`NocoDB delete failed ${res.status}: ${t}`);
  }
  return res.json();
}
