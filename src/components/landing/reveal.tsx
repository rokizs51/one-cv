'use client';

import { useEffect } from 'react';

/**
 * One-shot entrance for the landing page's .reveal nodes (styles in
 * globals.css; hidden states only apply when html.js is present, so
 * with script off everything renders visible).
 */
export default function Reveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -10%' }
    );
    const nodes = document.querySelectorAll<HTMLElement>('.reveal');
    nodes.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 5) * 80}ms`;
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return null;
}
