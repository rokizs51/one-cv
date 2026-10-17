import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { JdChips } from './jd-chips';
import type { JdExtraction } from '@/lib/domain/types';

describe('JdChips', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders chips for requiredSkills, preferredSkills, tools, and keywords', () => {
    const extraction: JdExtraction = {
      requiredSkills: ['TypeScript', 'React'],
      preferredSkills: ['Next.js'],
      keywords: ['frontend'],
      seniority: 'mid',
      domain: 'software',
      tools: ['VS Code'],
      responsibilities: ['Build UI'],
    };

    render(<JdChips extraction={extraction} />);

    // Check that all chips are rendered
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('VS Code')).toBeInTheDocument();
  });

  it('renders section labels', () => {
    const extraction: JdExtraction = {
      requiredSkills: ['TypeScript'],
      preferredSkills: ['Next.js'],
      keywords: ['frontend'],
      seniority: 'mid',
      domain: 'software',
      tools: ['VS Code'],
      responsibilities: ['Build UI'],
    };

    render(<JdChips extraction={extraction} />);

    expect(screen.getByText(/Required/)).toBeInTheDocument();
    expect(screen.getByText(/Preferred/)).toBeInTheDocument();
    expect(screen.getByText(/Tools/)).toBeInTheDocument();
    expect(screen.getByText(/Keywords/)).toBeInTheDocument();
  });

  it('handles empty arrays gracefully', () => {
    const extraction: JdExtraction = {
      requiredSkills: [],
      preferredSkills: [],
      keywords: [],
      seniority: 'mid',
      domain: 'software',
      tools: [],
      responsibilities: [],
    };

    // Should render without crashing
    const { container } = render(<JdChips extraction={extraction} />);
    
    // No chips should be rendered
    expect(container.querySelector('.space-y-2')).toBeInTheDocument();
    
    // No overflow indicator when all empty
    expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
  });

  it('renders exactly 24 chips without overflow', () => {
    const extraction: JdExtraction = {
      requiredSkills: Array.from({ length: 8 }, (_, i) => `req-${i}`),
      preferredSkills: Array.from({ length: 8 }, (_, i) => `pref-${i}`),
      keywords: Array.from({ length: 4 }, (_, i) => `key-${i}`),
      seniority: 'mid',
      domain: 'software',
      tools: Array.from({ length: 4 }, (_, i) => `tool-${i}`),
      responsibilities: [],
    };

    render(<JdChips extraction={extraction} />);

    // Should render all 24 chips
    for (let i = 0; i < 8; i++) {
      expect(screen.getByText(`req-${i}`)).toBeInTheDocument();
      expect(screen.getByText(`pref-${i}`)).toBeInTheDocument();
    }
    for (let i = 0; i < 4; i++) {
      expect(screen.getByText(`key-${i}`)).toBeInTheDocument();
      expect(screen.getByText(`tool-${i}`)).toBeInTheDocument();
    }

    // No overflow indicator
    expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
  });

  it('renders max 24 chips with overflow indicator', () => {
    const extraction: JdExtraction = {
      requiredSkills: Array.from({ length: 10 }, (_, i) => `req-${i}`),
      preferredSkills: Array.from({ length: 10 }, (_, i) => `pref-${i}`),
      keywords: Array.from({ length: 10 }, (_, i) => `key-${i}`),
      seniority: 'mid',
      domain: 'software',
      tools: Array.from({ length: 10 }, (_, i) => `tool-${i}`),
      responsibilities: [],
    };

    render(<JdChips extraction={extraction} />);

    // Total chips: 40, should show 24 + overflow indicator
    // Order: Required(10) + Preferred(10) + Tools(10) + Keywords(10)
    // First 24: Required(10) + Preferred(10) + Tools(4)
    for (let i = 0; i < 10; i++) {
      expect(screen.getByText(`req-${i}`)).toBeInTheDocument();
      expect(screen.getByText(`pref-${i}`)).toBeInTheDocument();
    }
    for (let i = 0; i < 4; i++) {
      expect(screen.getByText(`tool-${i}`)).toBeInTheDocument();
    }

    // Overflow indicator should show +16 (40 - 24 = 16)
    expect(screen.getByText('+16')).toBeInTheDocument();
  });

  it('renders overflow when exactly 25 chips', () => {
    const extraction: JdExtraction = {
      requiredSkills: Array.from({ length: 13 }, (_, i) => `req-${i}`),
      preferredSkills: Array.from({ length: 12 }, (_, i) => `pref-${i}`),
      keywords: [],
      seniority: 'mid',
      domain: 'software',
      tools: [],
      responsibilities: [],
    };

    render(<JdChips extraction={extraction} />);

    // Total: 25, should show 24 + +1
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});
