import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type Tone = "neutral" | "brand" | "success" | "warning" | "critical" | "muted";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "border-line-strong bg-panel-2 text-ink-dim",
  brand: "border-brand/40 bg-brand/10 text-brand",
  success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  critical: "border-red-400/40 bg-red-400/10 text-red-300",
  muted: "border-line bg-panel text-muted",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 tracking-tight",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <section className={cx("safar-card", padded && "p-4 sm:p-5", className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-brand">{icon}</span> : null}
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-abyss hover:bg-cyan-300 focus-visible:bg-cyan-300 border border-brand/60 font-semibold",
  secondary: "border border-line-strong bg-panel-2 text-ink hover:border-brand/60 hover:text-brand",
  ghost: "border border-transparent text-ink-dim hover:border-line-strong hover:text-ink",
  danger: "border border-red-400/50 bg-red-400/10 text-red-200 hover:bg-red-400/20",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  required,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="safar-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("safar-input", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("safar-input appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("safar-input min-h-[88px] resize-y", className)} {...props} />;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const accent: Record<Tone, string> = {
    neutral: "text-ink",
    brand: "text-brand",
    success: "text-emerald-300",
    warning: "text-amber-300",
    critical: "text-red-300",
    muted: "text-ink-dim",
  };
  return (
    <div className="safar-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
        {icon ? <span className={accent[tone]}>{icon}</span> : null}
      </div>
      <p className={cx("safar-mono mt-2 text-2xl font-semibold leading-none", accent[tone])}>{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

const NOTICE_TONES = {
  info: {
    wrapper: "border-brand/30 bg-brand/5",
    icon: <Info size={15} className="text-brand" />,
    title: "text-brand",
  },
  success: {
    wrapper: "border-emerald-400/30 bg-emerald-400/5",
    icon: <CheckCircle2 size={15} className="text-emerald-300" />,
    title: "text-emerald-300",
  },
  warning: {
    wrapper: "border-amber-400/30 bg-amber-400/5",
    icon: <AlertTriangle size={15} className="text-amber-300" />,
    title: "text-amber-300",
  },
  critical: {
    wrapper: "border-red-400/30 bg-red-400/5",
    icon: <XCircle size={15} className="text-red-300" />,
    title: "text-red-300",
  },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  onDismiss,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const style = NOTICE_TONES[tone];
  return (
    <div className={cx("flex gap-2.5 rounded-lg border p-3 text-xs leading-relaxed", style.wrapper, className)}>
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title ? <p className={cx("font-semibold", style.title)}>{title}</p> : null}
        {children ? <div className="mt-1 text-ink-dim">{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 rounded p-0.5 text-muted hover:text-ink"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
      {icon ? <span className="text-muted">{icon}</span> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? <p className="max-w-md text-xs leading-relaxed text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Disclaimer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-[11px] leading-relaxed text-muted", className)}>{children}</p>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("safar-mono", className)}>{children}</span>;
}
