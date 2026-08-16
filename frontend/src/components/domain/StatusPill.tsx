import { cn } from '@/lib/cn';
import { statusMeta, type StatusMeta, type StatusTone } from '@/lib/statusMaps';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-sky-50 text-sky-800',
  success: 'bg-emerald-50 text-emerald-800',
  warning: 'bg-amber-50 text-amber-900',
  danger: 'bg-red-50 text-red-800',
};

interface StatusPillProps {
  status: string;
  map: Record<string, StatusMeta>;
  className?: string;
}

// Every ride and booking status in the app renders through this one
// component, so a state can never be labelled two different ways on two
// different screens. Tone is carried by background+text rather than colour
// alone, so the state survives being read in greyscale.
export function StatusPill({ status, map, className }: StatusPillProps) {
  const meta = statusMeta(map, status);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

// The explanatory line that belongs next to a pill where there is room —
// trip detail headers, ride management. Renders nothing when the status has
// no hint, so callers do not need to check.
export function StatusHint({ status, map }: { status: string; map: Record<string, StatusMeta> }) {
  const meta = statusMeta(map, status);
  if (meta.hint === undefined) return null;
  return <p className="text-sm text-ink-muted">{meta.hint}</p>;
}
