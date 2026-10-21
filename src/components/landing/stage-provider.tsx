'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { STAGES, type RoleId, type StageId } from './record-data';

/**
 * Shared state for the landing page's live thing: the paper sheet on the
 * stage knows which role it is set for and which of the four stages it is
 * showing. Sections marked data-stage move the sheet as you scroll; the
 * slider and the role index drive it directly.
 */
const StageContext = createContext<{
  stage: StageId;
  role: RoleId;
  setStage: (s: StageId) => void;
  pickRole: (r: RoleId) => void;
} | null>(null);

export function useStage() {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error('useStage outside StageProvider');
  return ctx;
}

export default function StageProvider({
  children,
  initialRole,
}: {
  children: ReactNode;
  initialRole: RoleId;
}) {
  const [stage, setStage] = useState<StageId>('tailor');
  const [role, setRole] = useState<RoleId>(initialRole);

  const pickRole = useCallback((r: RoleId) => {
    setRole(r);
    setStage('tailor');
  }, []);

  // Scroll drives the sheet: the [data-stage] element nearest the top band
  // of the viewport wins.
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-stage]');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const s = (e.target as HTMLElement).dataset.stage;
            if (s && (STAGES as readonly string[]).includes(s)) setStage(s as StageId);
          }
        }
      },
      { rootMargin: '-30% 0px -55% 0px' }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const value = useMemo(
    () => ({ stage, role, setStage, pickRole }),
    [stage, role, pickRole]
  );
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}
