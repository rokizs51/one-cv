import { describe, it, expect } from 'vitest';
import { canonicalTextFor, splitProject, stripBullet, normalizeManualText, formatDate, formatDatesInText, structureFor, structureFromText } from './canonical';

describe('structureFor', () => {
  it('experience: typed header, bullets and technologies straight from the payload', () => {
    expect(
      structureFor('experience', {
        company: 'Acme',
        role: 'Senior Engineer',
        start: '2022-03',
        end: '',
        location: 'Remote',
        employmentType: 'Full-time',
        bullets: ['- Shipped X', 'Led Y'],
        technologies: ['TypeScript', 'Postgres'],
      })
    ).toEqual({
      header: {
        title: 'Senior Engineer',
        company: 'Acme',
        dates: 'Mar 2022–present',
        location: 'Remote',
        employmentType: 'Full-time',
      },
      bullets: ['Shipped X', 'Led Y'],
      technologies: ['TypeScript', 'Postgres'],
    });
  });

  it('projects: name, description and tech from the payload', () => {
    expect(
      structureFor('projects', { name: 'Tailor', description: 'CV tailor', tech: ['Go', 'React'] })
    ).toEqual({
      header: { title: 'Tailor', company: '', dates: '' },
      description: 'CV tailor',
      technologies: ['Go', 'React'],
    });
  });

  it('one-line sections stay unstructured (empty payload → no fields)', () => {
    expect(structureFor('education', {})).toEqual({});
    expect(structureFor('experience', {})).toEqual({});
  });
});

describe('structureFromText (legacy docs)', () => {
  it('splits the canonical experience header and bullets without a payload', () => {
    expect(structureFromText('experience', 'Engineer — Acme (2022-03–2025)\n• Shipped X\nLed Y')).toEqual({
      header: { title: 'Engineer', company: 'Acme', dates: 'Mar 2022–2025' },
      bullets: ['Shipped X', 'Led Y'],
    });
  });

  it('a headerless legacy entry keeps every line as a bullet', () => {
    expect(structureFromText('experience', '• Did X\n• Did Y')).toEqual({
      bullets: ['Did X', 'Did Y'],
    });
  });

  it('inverts the one-line project canonical', () => {
    expect(structureFromText('projects', 'Tailor — CV tailor (Go, React)')).toEqual({
      header: { title: 'Tailor', company: '', dates: '' },
      description: 'CV tailor',
      technologies: ['Go', 'React'],
    });
  });
});

describe('canonicalTextFor', () => {
  it('career_snapshot is the text verbatim', () => {
    expect(canonicalTextFor('career_snapshot', { text: 'Backend engineer, 3 yrs fintech' })).toBe(
      'Backend engineer, 3 yrs fintech'
    );
  });

  it('experience: role — company (start–end) + plain bullet lines (renderer owns the marker)', () => {
    const text = canonicalTextFor('experience', {
      company: 'Acme',
      role: 'Senior Engineer',
      start: '2022',
      end: '2025',
      bullets: ['Shipped X', 'Led Y'],
    });
    expect(text).toBe('Senior Engineer — Acme (2022–2025)\nShipped X\nLed Y');
  });

  it('experience: pasted list markers are stripped so bullets never render "• -"', () => {
    const text = canonicalTextFor('experience', {
      company: 'Acme',
      role: 'Engineer',
      start: '2022',
      end: '',
      bullets: ['- Led X', '• Did Y', '* Ran Z', 'Plain W'],
    });
    expect(text).toBe('Engineer — Acme (2022–present)\nLed X\nDid Y\nRan Z\nPlain W');
  });

  it('experience: YYYY-MM dates normalize to "Mon YYYY"', () => {
    const text = canonicalTextFor('experience', {
      company: 'Acme',
      role: 'Engineer',
      start: '2022-03',
      end: '2025-12',
      bullets: [],
    });
    expect(text).toBe('Engineer — Acme (Mar 2022–Dec 2025)');
  });

  it('experience with no end date reads "present"; empty bullets render none', () => {
    const text = canonicalTextFor('experience', {
      company: 'Acme',
      role: 'Engineer',
      start: '2024',
      end: '',
      bullets: [],
    });
    expect(text).toBe('Engineer — Acme (2024–present)');
  });

  it('education: degree field — school (years)', () => {
    const text = canonicalTextFor('education', {
      school: 'MIT',
      degree: 'BSc',
      field: 'CS',
      startYear: 2016,
      endYear: 2020,
    });
    expect(text).toBe('BSc CS — MIT (2016–2020)');
  });

  it('project: name — description (tech list)', () => {
    const text = canonicalTextFor('project', {
      name: 'OpenCV-Tools',
      description: 'CLI helpers',
      tech: ['Rust', 'WASM'],
    });
    expect(text).toBe('OpenCV-Tools — CLI helpers (Rust, WASM)');
  });

  it('project: mid-sentence newlines from a pasted description fold to one line', () => {
    const text = canonicalTextFor('project', {
      name: 'BitURL',
      description: 'URL shortener that allows \n shortening a long URL with\ncustom slug',
      tech: ['Go'],
    });
    expect(text).toBe('BitURL — URL shortener that allows shortening a long URL with custom slug (Go)');
  });

  it('splitProject inverts the project canonical; pieces rejoin exactly', () => {
    const full = splitProject('BitURL — URL shortener (Go, WASM)');
    expect(full).toEqual({ name: 'BitURL', desc: ' — URL shortener', tech: ' (Go, WASM)' });
    expect(full.name + full.desc + full.tech).toBe('BitURL — URL shortener (Go, WASM)');
    expect(splitProject('Solo')).toEqual({ name: 'Solo', desc: '', tech: '' });
    // description without tech
    expect(splitProject('Final Autos — a marketplace')).toEqual({
      name: 'Final Autos',
      desc: ' — a marketplace',
      tech: '',
    });
  });

  it('award: title — issuer (year)', () => {
    expect(canonicalTextFor('award', { title: 'Hackathon 1st', issuer: 'DevConf', year: 2024 })).toBe(
      'Hackathon 1st — DevConf (2024)'
    );
  });

  it('certification: name — issuer (year)', () => {
    expect(canonicalTextFor('certification', { name: 'AWS Solutions Architect', issuer: 'Amazon', year: 2024 })).toBe(
      'AWS Solutions Architect — Amazon (2024)'
    );
  });

  it('skill and language include level when present, omit when absent', () => {
    expect(canonicalTextFor('skill', { name: 'Kubernetes' })).toBe('Kubernetes');
    expect(canonicalTextFor('skill', { name: 'Go', level: 'advanced' })).toBe('Go (advanced)');
    expect(canonicalTextFor('language', { name: 'English', level: 'native' })).toBe('English (native)');
  });

  it('tolerates missing/odd payload fields without throwing', () => {
    expect(canonicalTextFor('experience', { role: 'Dev' })).toBe('Dev');
    expect(canonicalTextFor('award', { year: '2024' })).toBe('(2024)');
  });
});

describe('stripBullet', () => {
  it('removes every leading marker variant, including stacked and spaceless ones', () => {
    expect(stripBullet('- Plain dash')).toBe('Plain dash');
    expect(stripBullet('• Spaced dot')).toBe('Spaced dot');
    expect(stripBullet('•Spacedless')).toBe('Spacedless');
    expect(stripBullet('• - Double')).toBe('Double');
    expect(stripBullet('- • Reversed double')).toBe('Reversed double');
    expect(stripBullet('▪ Squared')).toBe('Squared');
    expect(stripBullet('‣ Triangular')).toBe('Triangular');
    expect(stripBullet('   * Indented star  ')).toBe('Indented star');
  });

  it('never eats a minus sign or star that is content, not a marker', () => {
    expect(stripBullet('-5% latency')).toBe('-5% latency');
    expect(stripBullet('– — em-dash talk')).toBe('em-dash talk');
    expect(stripBullet('*bold* start')).toBe('bold* start');
  });

  it('normalizeManualText strips per line and keeps line structure', () => {
    expect(normalizeManualText('Role — Co\n• - Led X\n  Did Y')).toBe('Role — Co\nLed X\nDid Y');
  });
});

describe('dates', () => {
  it('formatDate: only exact YYYY-MM is rewritten; never guess', () => {
    expect(formatDate('2022-03')).toBe('Mar 2022');
    expect(formatDate('2022-13')).toBe('2022-13');
    expect(formatDate('2022')).toBe('2022');
    expect(formatDate('March 2022')).toBe('March 2022');
    expect(formatDate('')).toBe('');
  });

  it('formatDatesInText normalizes dates embedded in legacy rows', () => {
    expect(formatDatesInText('Lead — Acme (2022-03–2025-01)')).toBe('Lead — Acme (Mar 2022–Jan 2025)');
    expect(formatDatesInText('Cut 2022-14 goals')).toBe('Cut 2022-14 goals');
  });
});
