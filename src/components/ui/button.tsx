import type { ComponentPropsWithoutRef } from 'react';

/**
 * Pill button — the single elevation language is "background shift + thin
 * border", never drop shadows. Press feedback is a subtle scale (0.97) that
 * doesn't shift layout. Variants: primary (the only accent on a surface),
 * secondary (white + border), soft (pastel wash for in-context actions),
 * ghost (bare text), danger (soft red, used only for destructive actions).
 */
type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'dangerSolid';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-press active:bg-primary-press',
  secondary:
    'bg-surface text-ink border border-line-2 hover:bg-surface-2',
  soft:
    'bg-wash-blue text-tone-blue hover:brightness-95',
  ghost:
    'text-mute hover:text-ink hover:bg-surface-2',
  danger:
    'bg-wash-red text-tone-red hover:brightness-95',
  dangerSolid:
    'bg-tone-red text-white hover:brightness-90',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5 min-h-9',
  md: 'px-4 py-2 text-sm gap-2 min-h-10',
  lg: 'px-5 py-2.5 text-sm gap-2 min-h-11',
};

export const pillCls = 'rounded-full';

export const baseCls =
  'inline-flex items-center justify-center font-medium transition-all duration-150 ' +
  'active:scale-[0.97] cursor-pointer select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100';

export function buttonCls(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${baseCls} ${pillCls} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonCls(variant, size, className)} {...rest} />;
}

export default Button;
