import type { ItemType } from './types';

/**
 * Derives the canonical text for a profile item from its payload.
 *
 * canonicalText is what the resume renders (ResumeDocItem.text) and what
 * keyword scoring searches, so it must carry the item's full human-readable
 * content — dates, roles and bullets included, not just a title. The server
 * derives it on create; a payload edit on PATCH re-derives it; a manual text
 * edit overrides it directly (canonicalText sent explicitly).
 *
 * career_snapshot is special: it renders as the doc's top-level summary
 * (orchestrate reads snapshotItem.canonicalText), never as a section.
 */
export function canonicalTextFor(type: ItemType, payload: Record<string, unknown>): string {
  const str = (key: string): string => {
    const v = payload[key];
    return typeof v === 'string' ? v.trim() : '';
  };
  const num = (key: string): string => {
    const v = payload[key];
    return typeof v === 'number' && Number.isFinite(v) ? String(v) : typeof v === 'string' ? v.trim() : '';
  };
  const list = (key: string): string[] => {
    const v = payload[key];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  };

  return assemble(type, payload, str, num, list).trim();
}

function assemble(
  type: ItemType,
  payload: Record<string, unknown>,
  str: (key: string) => string,
  num: (key: string) => string,
  list: (key: string) => string[],
): string {
  switch (type) {
    case 'career_snapshot':
      return str('text');
    case 'experience': {
      const head = `${str('role')}${str('company') ? ` — ${str('company')}` : ''}${dateRange(str('start'), str('end'))}`;
      // Users paste bullets with their own list markers; keep one marker (the
      // "• " added below) instead of rendering "• - Designed…".
      const bullets = list('bullets')
        .map((b) => b.replace(/^[-–—•*]\s+/, '').trim())
        .filter((b) => b !== '');
      return bullets.length > 0 ? `${head}\n${bullets.map((b) => `• ${b}`).join('\n')}` : head;
    }
    case 'education': {
      const what = [str('degree'), str('field')].filter(Boolean).join(' ');
      const years = dateRange(num('startYear'), num('endYear'));
      return `${what}${str('school') ? ` — ${str('school')}` : ''}${years}`;
    }
    case 'project': {
      const tech = list('tech');
      const body = str('description');
      const suffix = `${body ? ` — ${body}` : ''}${tech.length ? ` (${tech.join(', ')})` : ''}`;
      return `${str('name')}${suffix}`;
    }
    case 'award': {
      const issuer = str('issuer');
      const year = num('year');
      return `${str('title')}${issuer ? ` — ${issuer}` : ''}${year ? ` (${year})` : ''}`;
    }
    case 'skill': {
      const level = str('level');
      return level ? `${str('name')} (${level})` : str('name');
    }
    case 'language': {
      const level = str('level');
      return level ? `${str('name')} (${level})` : str('name');
    }
  }
}

function dateRange(start: string, end: string): string {
  if (!start && !end) return '';
  return ` (${start || '—'}–${end || 'present'})`;
}
