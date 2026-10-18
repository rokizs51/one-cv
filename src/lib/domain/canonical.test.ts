import { describe, it, expect } from 'vitest';
import { canonicalTextFor } from './canonical';

describe('canonicalTextFor', () => {
  it('career_snapshot is the text verbatim', () => {
    expect(canonicalTextFor('career_snapshot', { text: 'Backend engineer, 3 yrs fintech' })).toBe(
      'Backend engineer, 3 yrs fintech'
    );
  });

  it('experience: role — company (start–end) + bulleted lines', () => {
    const text = canonicalTextFor('experience', {
      company: 'Acme',
      role: 'Senior Engineer',
      start: '2022',
      end: '2025',
      bullets: ['Shipped X', 'Led Y'],
    });
    expect(text).toBe('Senior Engineer — Acme (2022–2025)\n• Shipped X\n• Led Y');
  });

  it('experience: pasted list markers are stripped so bullets never render "• -"', () => {
    const text = canonicalTextFor('experience', {
      company: 'Acme',
      role: 'Engineer',
      start: '2022',
      end: '',
      bullets: ['- Led X', '• Did Y', '* Ran Z', 'Plain W'],
    });
    expect(text).toBe('Engineer — Acme (2022–present)\n• Led X\n• Did Y\n• Ran Z\n• Plain W');
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

  it('award: title — issuer (year)', () => {
    expect(canonicalTextFor('award', { title: 'Hackathon 1st', issuer: 'DevConf', year: 2024 })).toBe(
      'Hackathon 1st — DevConf (2024)'
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
