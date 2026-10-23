import type { ItemType, ResumeEntryHeader, SectionId } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Render-time date normalization: "2022-03" → "Mar 2022". Anything that isn't
 * exactly YYYY-MM passes through — never guess a format the user didn't give.
 */
export function formatDate(s: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(s.trim());
  if (!m) return s.trim();
  const month = Number(m[2]);
  if (month < 1 || month > 12) return s.trim();
  return `${MONTHS[month - 1]} ${m[1]}`;
}

/** Rows stored before formatDate normalize their dates keep "2022-03" inline;
 * display them the same way as fresh canonical text. */
export function formatDatesInText(s: string): string {
  return s.replace(/\b(\d{4})-(\d{2})\b/g, (all, y: string, m: string) => {
    const n = Number(m);
    return n >= 1 && n <= 12 ? `${MONTHS[n - 1]} ${y}` : all;
  });
}

// A hyphen/dash counts as a list marker only with trailing whitespace after it
// ("-5%" is a number, "- Item" is a bullet). The dot/star family counts either
// way ("•Title" is still a bullet).
const MARKER_DASH = /^\s*[-–—]\s+/;
const MARKER_DOT = /^\s*[•▪·‣*]\s*/;

/** Normalize a whole multi-line manual text: one marker rule for every
 * boundary that accepts user- or model-typed canonical text. */
export function normalizeManualText(text: string): string {
  return text
    .split('\n')
    .map(stripBullet)
    .join('\n')
    .trim();
}

/**
 * Remove every leading list marker from a bullet line, repeatably, so "• - x",
 * "•• x" and "•x" all land on the same plain text. The renderer owns the one
 * marker it draws; storage keeps none.
 */
export function stripBullet(line: string): string {
  let s = line;
  for (;;) {
    const next = s.replace(MARKER_DASH, '').replace(MARKER_DOT, '');
    if (next === s) return s.trim();
    s = next;
  }
}

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
      // Bullets are stored as plain text — the renderer owns the marker, so a
      // pasted "• - Designed…" can never stack a second one at display time.
      const bullets = list('bullets').map(stripBullet).filter((b) => b !== '');
      return bullets.length > 0 ? `${head}\n${bullets.join('\n')}` : head;
    }
    case 'education': {
      const what = [str('degree'), str('field')].filter(Boolean).join(' ');
      const years = dateRange(num('startYear'), num('endYear'));
      return `${what}${str('school') ? ` — ${str('school')}` : ''}${years}`;
    }
    case 'project': {
      const tech = list('tech');
      // A project canonical is ONE line; a pasted description with mid-sentence
      // newlines would split it and trick the renderer's title/bullet heuristic
      // into bolding half a sentence — fold whitespace runs to single spaces.
      const oneLine = (s: string): string => s.replace(/\s+/g, ' ');
      const body = oneLine(str('description'));
      const suffix = `${body ? ` — ${body}` : ''}${tech.length ? ` (${tech.join(', ')})` : ''}`;
      return `${oneLine(str('name'))}${suffix}`;
    }
    case 'award': {
      const issuer = str('issuer');
      const year = num('year');
      return `${str('title')}${issuer ? ` — ${issuer}` : ''}${year ? ` (${year})` : ''}`;
    }
    case 'certification': {
      const issuer = str('issuer');
      const year = num('year');
      return `${str('name')}${issuer ? ` — ${issuer}` : ''}${year ? ` (${year})` : ''}`;
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

/**
 * Inverts the project canonical for rendering: name and tech come back bold,
 * the description stays plain. Returns the pieces as slices of the original
 * string (separators ride along) so re-joining reproduces `text` exactly.
 * shortcut: parses the " — " / " (...)" separators textually — a project NAME
 * containing " — " splits early; upgrade if real profiles hit it.
 */
export function splitProject(text: string): { name: string; desc: string; tech: string } {
  const open = text.endsWith(')') ? text.lastIndexOf(' (') : -1;
  const tech = open > 0 ? text.slice(open) : '';
  const head = tech ? text.slice(0, open) : text;
  const sep = head.indexOf(' — ');
  return {
    name: sep > 0 ? head.slice(0, sep) : head,
    desc: sep > 0 ? head.slice(sep) : '',
    tech,
  };
}

function dateSpan(start: string, end: string): string {
  if (!start && !end) return '';
  return `${start ? formatDate(start) : '—'}–${end ? formatDate(end) : 'present'}`;
}

function dateRange(start: string, end: string): string {
  const span = dateSpan(start, end);
  return span ? ` (${span})` : '';
}

/** The entry parts the PDF lays out separately (header, bullets, tech). */
export interface DocStructure {
  header?: ResumeEntryHeader;
  description?: string;
  bullets?: string[];
  technologies?: string[];
}

/**
 * Structured entry fields straight from the profile payload — the
 * uncorrupted source. Generated docs carry these so the renderer never has
 * to re-parse canonical text; only stored legacy docs go through
 * structureFromText. Returns {} for one-line sections.
 */
export function structureFor(section: SectionId, payload: Record<string, unknown>): DocStructure {
  const str = (key: string): string => {
    const v = payload[key];
    return typeof v === 'string' ? v.trim() : '';
  };
  const list = (key: string): string[] => {
    const v = payload[key];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  };

  if (section === 'projects') {
    const out: DocStructure = {};
    const title = str('name').replace(/\s+/g, ' ');
    if (title) out.header = { title, company: '', dates: '' };
    const description = str('description').replace(/\s+/g, ' ');
    if (description) out.description = description;
    const technologies = list('tech');
    if (technologies.length > 0) out.technologies = technologies;
    return out;
  }

  if (section === 'experience') {
    const out: DocStructure = {};
    const location = str('location');
    const employmentType = str('employmentType');
    const header: ResumeEntryHeader = {
      title: str('role'),
      company: str('company'),
      dates: dateSpan(str('start'), str('end')),
      ...(location ? { location } : {}),
      ...(employmentType ? { employmentType } : {}),
    };
    if (header.title || header.company || header.dates || header.location || header.employmentType) {
      out.header = header;
    }
    const bullets = list('bullets').map(stripBullet).filter((b) => b !== '');
    if (bullets.length > 0) out.bullets = bullets;
    const technologies = list('technologies');
    if (technologies.length > 0) out.technologies = technologies;
    return out;
  }

  return {};
}

/**
 * Derives the same fields from canonical text — for docs stored before the
 * structured change and for accepted suggestion text. The canonical header
 * format is deterministic ("Role — Company (dates)"), so this is exact for
 * rows this codebase wrote; hand-edited legacy text is the only guess.
 */
export function structureFromText(section: SectionId, text: string): DocStructure {
  if (section === 'projects') {
    const { name, desc, tech } = splitProject(text);
    const out: DocStructure = {};
    if (name) out.header = { title: name, company: '', dates: '' };
    const description = desc.replace(/^ — /, '');
    if (description) out.description = description;
    const technologies = tech
      .replace(/^ \(/, '')
      .replace(/\)$/, '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    if (technologies.length > 0) out.technologies = technologies;
    return out;
  }

  if (section === 'experience') {
    const lines = text.split('\n');
    const head = (lines[0] ?? '').trim();
    const bullets = lines.slice(1).map(stripBullet).filter((l) => l !== '');
    const out: DocStructure = {};
    // A first line that is itself a bullet means the entry never had a
    // header line — every line is a bullet.
    if (head !== '' && !/^\s*[-–—]\s+/.test(head) && !/^\s*[•▪·‣*]\s*/.test(head)) {
      out.header = parseHeaderLine(head);
    } else if (head !== '') {
      bullets.unshift(stripBullet(head));
    }
    if (bullets.length > 0) out.bullets = bullets;
    return out;
  }

  return {};
}

function parseHeaderLine(head: string): ResumeEntryHeader {
  const datesMatch = / \(([^()]*)\)\s*$/.exec(head);
  const dates = datesMatch ? formatDatesInText(datesMatch[1]) : '';
  const rest = datesMatch ? head.slice(0, datesMatch.index) : head;
  const sep = rest.indexOf(' — ');
  return {
    title: (sep >= 0 ? rest.slice(0, sep) : rest).trim(),
    company: sep >= 0 ? rest.slice(sep + 3).trim() : '',
    dates,
  };
}
