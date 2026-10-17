import { describe, expect, it } from 'vitest';
import type { JdExtraction, ProfileItem } from '@/lib/domain/types';
import { isEarlyCareer, keywordScore, orderSections, sectionOf } from './scoring';

// Helper to create a minimal ProfileItem
function makeItem(overrides: Partial<ProfileItem> = {}): ProfileItem {
  return {
    id: 'item-1',
    profileId: 'profile-1',
    type: 'experience',
    payload: {},
    canonicalText: '',
    source: 'manual',
    provenance: [],
    pinned: false,
    position: 0,
    ...overrides,
  };
}

describe('sectionOf', () => {
  it('maps experience type to experience section', () => {
    const item = makeItem({ type: 'experience' });
    expect(sectionOf(item)).toBe('experience');
  });

  it('maps career_snapshot type to summary section', () => {
    const item = makeItem({ type: 'career_snapshot' });
    expect(sectionOf(item)).toBe('summary');
  });

  it('maps education type to education section', () => {
    const item = makeItem({ type: 'education' });
    expect(sectionOf(item)).toBe('education');
  });
});

describe('keywordScore', () => {
  it('scores required skill Kubernetes (weight 3) higher than keyword teamwork (weight 1)', () => {
    const jd: JdExtraction = {
      requiredSkills: ['Kubernetes'],
      preferredSkills: [],
      keywords: ['teamwork'],
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const kubernetesItem = makeItem({
      id: 'k8s-item',
      canonicalText: 'Built and deployed services using Kubernetes in production',
    });

    const teamworkItem = makeItem({
      id: 'teamwork-item',
      canonicalText: 'Demonstrated strong teamwork and collaboration skills',
    });

    const kubernetesScored = keywordScore(kubernetesItem, jd);
    const teamworkScored = keywordScore(teamworkItem, jd);

    expect(kubernetesScored.score).toBeGreaterThan(teamworkScored.score);
    expect(kubernetesScored.score).toBe(3);
    expect(teamworkScored.score).toBe(1);
    expect(kubernetesScored.matchedKeywords).toContain('Kubernetes');
    expect(teamworkScored.matchedKeywords).toContain('teamwork');
  });

  it('scores tools with weight 2', () => {
    const jd: JdExtraction = {
      requiredSkills: [],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: ['Docker'],
      responsibilities: [],
    };

    const item = makeItem({
      canonicalText: 'Containerized applications using Docker',
    });

    const scored = keywordScore(item, jd);
    expect(scored.score).toBe(2);
    expect(scored.matchedKeywords).toContain('Docker');
  });

  it('matches case-insensitively', () => {
    const jd: JdExtraction = {
      requiredSkills: ['Kubernetes'],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const item = makeItem({
      canonicalText: 'Experienced with kubernetes and container orchestration',
    });

    const scored = keywordScore(item, jd);
    expect(scored.score).toBe(3);
    expect(scored.matchedKeywords).toContain('Kubernetes');
  });

  it('does not match partial words (word boundary)', () => {
    const jd: JdExtraction = {
      requiredSkills: ['Kubernetes'],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const item = makeItem({
      canonicalText: 'Built KubernetesOperator for custom resource management',
    });

    const scored = keywordScore(item, jd);
    // Should NOT match because "Kubernetes" is part of "KubernetesOperator"
    expect(scored.score).toBe(0);
    expect(scored.matchedKeywords).not.toContain('Kubernetes');
  });

  it('searches payload values as well as canonicalText', () => {
    const jd: JdExtraction = {
      requiredSkills: ['PostgreSQL'],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const item = makeItem({
      canonicalText: 'Managed relational databases',
      payload: {
        technologies: ['PostgreSQL', 'MySQL'],
        description: 'Database administration',
      },
    });

    const scored = keywordScore(item, jd);
    expect(scored.score).toBe(3);
    expect(scored.matchedKeywords).toContain('PostgreSQL');
  });

  it('deduplicates matchedKeywords within a single list', () => {
    const jd: JdExtraction = {
      requiredSkills: ['Kubernetes'],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const item = makeItem({
      canonicalText: 'Kubernetes Kubernetes Kubernetes deployment',
    });

    const scored = keywordScore(item, jd);
    expect(scored.matchedKeywords.filter((k) => k === 'Kubernetes')).toHaveLength(1);
  });

  it('deduplicates matchedKeywords across JD lists and sums weights', () => {
    const jd: JdExtraction = {
      requiredSkills: ['Kubernetes'],
      preferredSkills: [],
      keywords: ['Kubernetes'], // same keyword in both lists
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const item = makeItem({
      canonicalText: 'Deployed applications with Kubernetes',
    });

    const scored = keywordScore(item, jd);
    // Should appear once in matchedKeywords despite being in two lists
    expect(scored.matchedKeywords.filter((k) => k === 'Kubernetes')).toHaveLength(1);
    // Score should reflect both weights: 3 (requiredSkills) + 1 (keywords) = 4
    expect(scored.score).toBe(4);
  });

  it('combines scores from multiple keywords', () => {
    const jd: JdExtraction = {
      requiredSkills: ['Kubernetes'],
      preferredSkills: ['Docker'],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: ['Jenkins'],
      responsibilities: [],
    };

    const item = makeItem({
      canonicalText: 'Deployed with Kubernetes, Docker, and Jenkins',
    });

    const scored = keywordScore(item, jd);
    expect(scored.score).toBe(3 + 1 + 2); // Kubernetes(3) + Docker(1) + Jenkins(2)
    expect(scored.matchedKeywords).toContain('Kubernetes');
    expect(scored.matchedKeywords).toContain('Docker');
    expect(scored.matchedKeywords).toContain('Jenkins');
  });
});

describe('orderSections', () => {
  it('returns base order when earlyCareer is false', () => {
    const items: ProfileItem[] = [
      makeItem({ type: 'career_snapshot', id: '1' }),
      makeItem({ type: 'skill', id: '2' }),
      makeItem({ type: 'experience', id: '3' }),
      makeItem({ type: 'project', id: '4' }),
      makeItem({ type: 'education', id: '5' }),
      makeItem({ type: 'award', id: '6' }),
      makeItem({ type: 'language', id: '7' }),
    ];

    const jd: JdExtraction = {
      requiredSkills: [],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const scoredItems = items.map((item) => keywordScore(item, jd));
    const sections = orderSections(scoredItems, { earlyCareer: false });

    expect(sections.map((s) => s.id)).toEqual([
      'summary',
      'skills',
      'experience',
      'projects',
      'education',
      'awards',
      'languages',
    ]);
  });

  it('moves education and projects before experience when earlyCareer is true', () => {
    const items: ProfileItem[] = [
      makeItem({ type: 'career_snapshot', id: '1' }),
      makeItem({ type: 'skill', id: '2' }),
      makeItem({ type: 'experience', id: '3' }),
      makeItem({ type: 'project', id: '4' }),
      makeItem({ type: 'education', id: '5' }),
      makeItem({ type: 'award', id: '6' }),
      makeItem({ type: 'language', id: '7' }),
    ];

    const jd: JdExtraction = {
      requiredSkills: [],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const scoredItems = items.map((item) => keywordScore(item, jd));
    const sections = orderSections(scoredItems, { earlyCareer: true });

    expect(sections.map((s) => s.id)).toEqual([
      'summary',
      'skills',
      'education',
      'projects',
      'experience',
      'awards',
      'languages',
    ]);
  });

  it('omits empty sections', () => {
    const items: ProfileItem[] = [
      makeItem({ type: 'experience', id: '1' }),
      makeItem({ type: 'skill', id: '2' }),
    ];

    const jd: JdExtraction = {
      requiredSkills: [],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'engineering',
      tools: [],
      responsibilities: [],
    };

    const scoredItems = items.map((item) => keywordScore(item, jd));
    const sections = orderSections(scoredItems, { earlyCareer: false });

    expect(sections.map((s) => s.id)).toEqual(['skills', 'experience']);
  });
});

describe('isEarlyCareer', () => {
  it('returns true when no experience items exist', () => {
    const items: ProfileItem[] = [
      makeItem({ type: 'education', id: '1' }),
      makeItem({ type: 'skill', id: '2' }),
    ];

    expect(isEarlyCareer(items)).toBe(true);
  });

  it('returns false when experience ended recently (last year)', () => {
    const currentYear = new Date().getFullYear();
    const items: ProfileItem[] = [
      makeItem({
        type: 'experience',
        id: '1',
        payload: { end: `${currentYear - 1}` }, // ended last year
      }),
    ];

    expect(isEarlyCareer(items)).toBe(false);
  });

  it('returns false when an experience item has no end date (ongoing)', () => {
    const items: ProfileItem[] = [
      makeItem({
        type: 'experience',
        id: '1',
        payload: { start: '2020' }, // no end date means ongoing
      }),
    ];

    expect(isEarlyCareer(items)).toBe(false);
  });

  it('returns false when an experience item has end date >= current year - 2', () => {
    const currentYear = new Date().getFullYear();
    const items: ProfileItem[] = [
      makeItem({
        type: 'experience',
        id: '1',
        payload: { end: `${currentYear - 2}` }, // ended 2 years ago
      }),
    ];

    expect(isEarlyCareer(items)).toBe(false);
  });

  it('returns true when all experience ended more than 2 years ago', () => {
    const currentYear = new Date().getFullYear();
    const items: ProfileItem[] = [
      makeItem({
        type: 'experience',
        id: '1',
        payload: { end: `${currentYear - 3}` }, // ended 3 years ago
      }),
    ];

    expect(isEarlyCareer(items)).toBe(true);
  });

  it('returns true when graduation within 3 years', () => {
    const currentYear = new Date().getFullYear();
    const items: ProfileItem[] = [
      makeItem({
        type: 'education',
        id: '1',
        payload: { endYear: currentYear - 1 }, // graduated last year
      }),
      makeItem({
        type: 'experience',
        id: '2',
        payload: { end: `${currentYear - 3}` }, // experience ended 3 years ago
      }),
    ];

    expect(isEarlyCareer(items)).toBe(true);
  });

  it('returns false when graduation more than 3 years ago and recent experience', () => {
    const currentYear = new Date().getFullYear();
    const items: ProfileItem[] = [
      makeItem({
        type: 'education',
        id: '1',
        payload: { endYear: currentYear - 5 }, // graduated 5 years ago
      }),
      makeItem({
        type: 'experience',
        id: '2',
        payload: { start: '2020' }, // ongoing experience
      }),
    ];

    expect(isEarlyCareer(items)).toBe(false);
  });
});
