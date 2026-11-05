import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export const formatPesos = (val: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val);

/** Escape text before it is placed into an HTML string (Leaflet popups, generated documents). */
export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/* ---------- Brand ---------- */

export const Logo: React.FC<{ tone?: 'light' | 'dark'; caption?: string; onClick?: () => void }> = ({
  tone = 'light',
  caption,
  onClick
}) => {
  const content = (
    <>
      <img
        src={tone === 'dark' ? './logos/icon-white-transparent.png' : './logos/Icon.png'}
        alt=""
        className="w-8 h-8 object-contain"
      />
      <span className="text-left leading-tight">
        <span className={cx('block font-extrabold text-lg tracking-tight', tone === 'dark' ? 'text-white' : 'text-brand')}>
          Enterseed
        </span>
        {caption && (
          <span className={cx('block text-xs', tone === 'dark' ? 'text-white/60' : 'text-muted')}>{caption}</span>
        )}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5 rounded-lg" aria-label="Enterseed home">
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-2.5">{content}</div>
  );
};

/* ---------- Layout ---------- */

export const PageHeader: React.FC<{ title: React.ReactNode; lead?: React.ReactNode; actions?: React.ReactNode }> = ({
  title,
  lead,
  actions
}) => (
  <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      <h1 className="text-2xl sm:text-[1.75rem] font-extrabold tracking-tight text-ink leading-tight">{title}</h1>
      {lead && <p className="mt-2 text-[15px] leading-relaxed text-muted">{lead}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </header>
);

export const Panel: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }> = ({
  as: Tag = 'section',
  className,
  children,
  ...rest
}) => (
  <Tag className={cx('bg-surface rounded-2xl border border-line p-5 sm:p-6', className)} {...rest}>
    {children}
  </Tag>
);

export const PanelHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  as?: 'h2' | 'h3';
}> = ({ title, description, action, as: Tag = 'h2' }) => (
  <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <Tag className="text-lg font-bold text-ink leading-snug">{title}</Tag>
      {description && <p className="mt-1 text-sm leading-relaxed text-muted max-w-prose">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/* ---------- Controls ---------- */

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-deep',
  accent: 'bg-accent text-ink hover:bg-[#F7772A]',
  secondary: 'bg-surface text-brand border border-line-strong hover:bg-brand-soft',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'text-danger hover:bg-danger-soft'
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-8 py-1 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'min-h-10 py-2 px-4 text-sm gap-2 rounded-xl',
  lg: 'min-h-12 py-2.5 px-5 text-[15px] gap-2 rounded-xl'
};

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) =>
  cx(
    'inline-flex items-center justify-center text-center leading-tight font-semibold transition-colors duration-150 disabled:opacity-50 [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0',
    buttonVariants[variant],
    buttonSizes[size],
    extra
  );

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
> = ({ variant = 'primary', size = 'md', className, type = 'button', ...rest }) => (
  <button type={type} className={buttonClass(variant, size, className)} {...rest} />
);

export const inputClass =
  'w-full h-10 bg-surface border border-line-strong rounded-xl px-3.5 text-sm text-ink placeholder:text-muted/70 transition-colors hover:border-muted/50 focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand/30 focus-visible:outline-offset-0 disabled:bg-sunken';

export const textareaClass = cx(inputClass, 'h-auto py-2.5 leading-relaxed resize-y');

export const Field: React.FC<{
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: (id: string) => React.ReactNode;
}> = ({ label, hint, className, children }) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink mb-1.5">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
};

export const CheckField: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  required?: boolean;
}> = ({ checked, onChange, children, required }) => (
  <label className="flex items-start gap-3 cursor-pointer select-none">
    <input
      type="checkbox"
      checked={checked}
      required={required}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 w-4 h-4 shrink-0 rounded border-line-strong"
    />
    <span className="text-[13px] leading-relaxed text-muted">{children}</span>
  </label>
);

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className
}: {
  options: Array<{ value: NoInfer<T>; label: React.ReactNode }>;
  value: T;
  onChange: (v: NoInfer<T>) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-grid grid-flow-col auto-cols-fr gap-1 p-1 bg-sunken border border-line rounded-xl', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'min-h-8 px-3 py-1 rounded-lg text-[13px] leading-tight font-semibold transition-colors',
              active ? 'bg-surface text-brand shadow-[0_1px_2px_rgb(43_28_51/0.12)]' : 'text-muted hover:text-ink'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Feedback ---------- */

const noticeTones = {
  success: { cls: 'bg-good-soft text-good', Icon: CheckCircle2 },
  error: { cls: 'bg-danger-soft text-danger', Icon: AlertTriangle },
  info: { cls: 'bg-brand-soft text-brand', Icon: Info }
} as const;

export const Notice: React.FC<{ tone?: keyof typeof noticeTones; children: React.ReactNode; className?: string }> = ({
  tone = 'info',
  children,
  className
}) => {
  const { cls, Icon } = noticeTones[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed font-medium', cls, className)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
};

export const Stat: React.FC<{ label: React.ReactNode; value: React.ReactNode; tone?: 'ink' | 'good' | 'danger' | 'brand' }> = ({
  label,
  value,
  tone = 'ink'
}) => (
  <div>
    <dt className="text-[13px] text-muted">{label}</dt>
    <dd
      className={cx(
        'mt-1 text-xl sm:text-2xl font-bold tracking-tight tnum',
        tone === 'good' && 'text-good',
        tone === 'danger' && 'text-danger',
        tone === 'brand' && 'text-brand',
        tone === 'ink' && 'text-ink'
      )}
    >
      {value}
    </dd>
  </div>
);

/* ---------- Dismissable layers ---------- */

/** Close a popover on outside pointer-down or Escape. */
export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: 'md' | 'lg';
  children: React.ReactNode;
  dismissable?: boolean;
}> = ({ open, onClose, title, description, size = 'md', children, dismissable = true }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-night/55"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'pop-in relative w-full bg-surface rounded-t-2xl sm:rounded-2xl shadow-[0_24px_60px_-20px_rgb(36_23_43/0.5)] max-h-[92vh] overflow-y-auto p-5 sm:p-7',
          size === 'lg' ? 'sm:max-w-xl' : 'sm:max-w-md'
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-ink leading-snug">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted leading-relaxed">{description}</p>}
          </div>
          {dismissable && (
            <button
              type="button"
              data-close
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-sunken"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
};
