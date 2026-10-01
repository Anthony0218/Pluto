import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { ui } from "@/i18n/ui";

/* Small, consistent building blocks for the Chess Custom editor. */

export const labelClass = "text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500";
export const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/15";

export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-white/[0.08] bg-[#0d1014]/85 shadow-[0_18px_40px_rgba(0,0,0,.25)] ${className}`}>
      {(title || actions || eyebrow) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="min-w-0">
            {eyebrow && <p className={labelClass}>{eyebrow}</p>}
            {title && <h3 className="truncate text-sm font-bold text-zinc-100">{title}</h3>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/80">{ui(eyebrow)}</p>
        <h2 className="mt-1.5 font-serif text-[28px] leading-tight text-white sm:text-[32px]">{ui(title)}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  tone = "ghost",
  disabled,
  title,
  type = "button",
  className = "",
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "ghost" | "danger" | "blue";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
  size?: "sm" | "md";
}) {
  const tones = {
    primary: "border-amber-300/60 bg-amber-300 text-zinc-950 hover:bg-amber-200",
    ghost: "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
    danger: "border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/20",
    blue: "border-sky-400/40 bg-sky-400/15 text-sky-100 hover:bg-sky-400/25",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
  active,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-amber-300 ${
        active ? "border-sky-400/50 bg-sky-400/15 text-sky-100" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-100">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline-2 focus-visible:outline-amber-300 ${checked ? "border-amber-300/70 bg-amber-300/80" : "border-white/15 bg-white/10"}`}
      >
        <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  label,
}: {
  value: T;
  options: { id: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-xl border border-white/10 bg-black/30 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          title={option.title && ui(option.title)}
          onClick={() => onChange(option.id)}
          className={`rounded-lg font-semibold transition focus-visible:outline-2 focus-visible:outline-amber-300 ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
            value === option.id ? "bg-amber-300/90 text-zinc-950 shadow" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          {typeof option.label === "string" ? ui(option.label) : option.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs leading-5 text-zinc-500">{hint}</span>}
    </label>
  );
}

export function NumberField({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, Number.isFinite(next) ? next : min));
  return (
    <div className="inline-flex items-center rounded-lg border border-white/10 bg-black/40">
      <button type="button" aria-label={`Decrease ${label ?? "value"}`} onClick={() => onChange(clamp(value - step))} className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-white">
        <Minus size={14} />
      </button>
      <input
        aria-label={label}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
        className="h-8 w-12 bg-transparent text-center text-sm font-semibold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="pr-1 text-xs text-zinc-500">{suffix}</span>}
      <button type="button" aria-label={`Increase ${label ?? "value"}`} onClick={() => onChange(clamp(value + step))} className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-white">
        <Plus size={14} />
      </button>
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
  label?: string;
  className?: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)} className={`${inputClass} cursor-pointer py-1.5 ${className}`}>
      {options.map((option) => (
        <option key={option.id} value={option.id} className="bg-zinc-900">
          {ui(option.label)}
        </option>
      ))}
    </select>
  );
}

export function Chip({ children, tone = "zinc", title }: { children: ReactNode; tone?: "zinc" | "amber" | "sky" | "red" | "emerald" | "violet"; title?: string }) {
  const tones = {
    zinc: "border-white/10 bg-white/[0.05] text-zinc-300",
    amber: "border-amber-300/30 bg-amber-300/10 text-amber-200",
    sky: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    red: "border-red-400/30 bg-red-400/10 text-red-200",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-200">{icon}</div>
      <p className="font-semibold text-zinc-100">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm leading-6 text-zinc-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
