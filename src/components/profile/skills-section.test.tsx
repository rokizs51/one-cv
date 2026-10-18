import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SkillsSection from './skills-section';
import type { ProfileItem } from '@/lib/domain/types';

function makeSkill(overrides: Partial<ProfileItem> = {}): ProfileItem {
  return {
    id: 'skill-1',
    profileId: 'profile-1',
    type: 'skill',
    payload: { name: 'Go', level: 'advanced' },
    canonicalText: 'Go (advanced)',
    source: 'manual',
    provenance: [],
    pinned: false,
    position: 0,
    ...overrides,
  };
}

function setup(items: ProfileItem[] = [makeSkill()]) {
  const onPatch = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const onCreateBatch = vi.fn().mockResolvedValue(undefined);
  render(
    <SkillsSection items={items} onPatch={onPatch} onDelete={onDelete} onCreateBatch={onCreateBatch} />
  );
  return { onPatch, onDelete, onCreateBatch };
}

const queueOne = (name: string, level = '') => {
  fireEvent.change(screen.getByLabelText(/new skill name/i), { target: { value: name } });
  if (level) fireEvent.change(screen.getByLabelText(/level for the new skill/i), { target: { value: level } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
};

beforeEach(() => cleanup());

describe('SkillsSection', () => {
  it('renders one compact row per skill with the five levels plus any legacy value', () => {
    setup();
    expect((screen.getByLabelText(/name of go/i) as HTMLInputElement).value).toBe('Go');
    const select = screen.getByLabelText(/level for go/i) as HTMLSelectElement;
    expect(select.value).toBe('advanced');
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      '', 'advanced', 'Basic', 'Novice', 'Intermediate', 'Advanced', 'Expert',
    ]);
  });

  it('queues skills locally with zero API calls, then saves the whole batch in one call', async () => {
    const { onCreateBatch, onPatch, onDelete } = setup([]);

    queueOne('Python');
    queueOne('Figma', 'Advanced');

    expect(onCreateBatch).not.toHaveBeenCalled();
    expect(onPatch).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    screen.getByText('Figma (Advanced)');

    fireEvent.click(screen.getByRole('button', { name: /save 2 skills/i }));
    await waitFor(() => expect(onCreateBatch).toHaveBeenCalledTimes(1));
    expect(onCreateBatch).toHaveBeenCalledWith([{ name: 'Python' }, { name: 'Figma', level: 'Advanced' }]);
  });

  it('refuses to queue a duplicate (case-insensitive) and says why', () => {
    const { onCreateBatch } = setup();
    queueOne('go');
    expect(screen.getByRole('alert')).toHaveTextContent(/already on your list/i);
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(onCreateBatch).not.toHaveBeenCalled();
  });

  it('a removed chip drops out of the batch', async () => {
    const { onCreateBatch } = setup([]);
    queueOne('Go');
    queueOne('Rust');
    fireEvent.click(screen.getByRole('button', { name: /remove rust/i }));

    fireEvent.click(screen.getByRole('button', { name: /save 1 skill/i }));
    await waitFor(() => expect(onCreateBatch).toHaveBeenCalledWith([{ name: 'Go' }]));
  });

  it('changing an existing level patches that item with the full payload', async () => {
    const { onPatch } = setup();
    fireEvent.change(screen.getByLabelText(/level for go/i), { target: { value: 'Expert' } });
    await waitFor(() =>
      expect(onPatch).toHaveBeenCalledWith('skill-1', { payload: { name: 'Go', level: 'Expert' } })
    );
  });

  it('clearing the level sends a payload without the level key', async () => {
    const { onPatch } = setup();
    fireEvent.change(screen.getByLabelText(/level for go/i), { target: { value: '' } });
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith('skill-1', { payload: { name: 'Go' } }));
  });

  it('pin and delete keep the per-item actions', async () => {
    const { onPatch, onDelete } = setup();
    fireEvent.click(screen.getByRole('button', { name: /pin go/i }));
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith('skill-1', { pinned: true }));
    fireEvent.click(screen.getByRole('button', { name: /delete go/i }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('skill-1'));
  });
});
