/**
 * Google Sheets helpers. Works with three kinds of input:
 *  - a normal sheet link  (docs.google.com/spreadsheets/d/<id>/edit#gid=123)
 *  - a "Publish to web" link (docs.google.com/spreadsheets/d/e/<pubId>/pubhtml)
 *  - any direct https link to a .csv file
 * A bare sheet id is accepted too.
 */
export class SheetError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

export function parseSheetUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new SheetError('Paste a Google Sheet link first.', 'empty');

  const gidMatch = raw.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  const pub = raw.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
  if (pub) return { kind: 'published', id: pub[1], gid };

  const normal = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (normal) return { kind: 'sheet', id: normal[1], gid };

  if (/^[a-zA-Z0-9_-]{30,}$/.test(raw)) return { kind: 'sheet', id: raw, gid: '0' };

  if (/^https:\/\/\S+$/i.test(raw) && !/docs\.google\.com/.test(raw)) return { kind: 'csv', url: raw };

  throw new SheetError("That doesn't look like a Google Sheet link. Copy the link from your browser's address bar.", 'invalid');
}

export function csvUrlFor(src) {
  if (src.kind === 'sheet') return `https://docs.google.com/spreadsheets/d/${src.id}/export?format=csv&gid=${src.gid}`;
  if (src.kind === 'published') return `https://docs.google.com/spreadsheets/d/e/${src.id}/pub?output=csv&gid=${src.gid}`;
  return src.url;
}

export function sheetLinkFor(src) {
  if (src.kind === 'sheet') return `https://docs.google.com/spreadsheets/d/${src.id}/edit#gid=${src.gid}`;
  if (src.kind === 'published') return `https://docs.google.com/spreadsheets/d/e/${src.id}/pubhtml?gid=${src.gid}`;
  return src.url;
}

export function deckIdFor(src) {
  if (src.kind === 'csv') return `csv-${simpleHash(src.url)}`;
  return `${src.kind === 'published' ? 'p' : 's'}-${src.id}-${src.gid}`;
}

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Pull a readable title out of a Content-Disposition header, if the browser exposes it. */
export function titleFromDisposition(disposition) {
  if (!disposition) return '';
  const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  let name = '';
  if (utf) { try { name = decodeURIComponent(utf[1]); } catch { name = utf[1]; } }
  if (!name) { const m = disposition.match(/filename="?([^";]+)"?/i); if (m) name = m[1]; }
  return name.replace(/\.csv$/i, '').trim();
}

const PRIVATE_MSG = 'This sheet is private. In Google Sheets click Share, then set General access to "Anyone with the link".';

export async function fetchSheet(src, fetchImpl = globalThis.fetch) {
  let response;
  try {
    response = await fetchImpl(csvUrlFor(src), { redirect: 'follow' });
  } catch {
    throw new SheetError("We couldn't reach that sheet. Check your internet, and make sure the sheet is shared as \"Anyone with the link\".", 'network');
  }
  if (response.status === 401 || response.status === 403) throw new SheetError(PRIVATE_MSG, 'private');
  if (response.status === 404) throw new SheetError("That sheet doesn't exist anymore, or the link is incomplete.", 'missing');
  if (!response.ok) throw new SheetError(`Google Sheets returned an error (${response.status}). Try again in a moment.`, 'http');

  const text = await response.text();
  const type = response.headers.get('content-type') || '';
  if (/text\/html/i.test(type) || /^\s*<(!doctype|html)/i.test(text)) throw new SheetError(PRIVATE_MSG, 'private');
  return { text, title: titleFromDisposition(response.headers.get('content-disposition')) };
}
