import { AlertTriangle, Bus as BusIcon, ShieldAlert, Users, X } from "lucide-react";
import type { Bus, Route } from "../../../domain/types";
import { Button, Mono } from "../../../components/ui";

interface BreakdownModalProps {
  bus: Bus | null;
  route?: Route;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (busId: string) => void;
}

export function BreakdownModal({
  bus,
  route,
  isOpen,
  onClose,
  onConfirm,
}: BreakdownModalProps) {
  if (!isOpen || !bus) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakdown-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-panel p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-red-400/50 bg-red-500/10 text-red-300">
              <ShieldAlert size={20} />
            </span>
            <div>
              <h3 id="breakdown-modal-title" className="text-base font-bold tracking-tight text-ink">
                Simulate Bus Breakdown
              </h3>
              <p className="text-[11px] text-muted">Authority Incident Simulation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel breakdown simulation"
            className="rounded-lg border border-line-strong p-1 text-ink-dim hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Breakdown Context */}
        <div className="mt-4 space-y-3 text-xs leading-relaxed">
          <div className="rounded-lg border border-line bg-abyss/70 p-3">
            <div className="flex items-center justify-between font-semibold text-ink">
              <span className="flex items-center gap-1.5">
                <BusIcon size={14} className="text-brand" /> {bus.registration}
              </span>
              <span className="rounded bg-panel-2 px-2 py-0.5 text-[10px] text-ink-dim">
                Route: {bus.assignedRouteId ?? "Unassigned"}
              </span>
            </div>
            {route ? (
              <p className="mt-1 text-[11px] text-muted">
                {route.name} ({route.stops.length} stops)
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-2 border-t border-line/60 pt-2 text-[11px] text-ink-dim">
              <Users size={13} className="text-amber-300" />
              <span>
                <strong><Mono>{bus.occupiedSeats}</Mono></strong> students / passengers currently onboard.
              </span>
            </div>
          </div>

          {/* Operational consequences callout */}
          <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-[11px] text-red-200">
            <p className="font-semibold text-red-300">Operational Consequences of this Simulation:</p>
            <ul className="mt-1.5 space-y-1 pl-4 list-disc text-ink-dim">
              <li>Marks <strong>{bus.registration}</strong> as <span className="text-red-300">UNAVAILABLE</span>.</li>
              <li>Generates a confirmed active incident in shared state.</li>
              <li>Calculates affected capacity ({bus.capacity} seats, {bus.occupiedSeats} occupied).</li>
              <li>Evaluates candidate replacements using the 35/30/25/10 weighted formula.</li>
              <li>Propagates critical disruption alerts immediately to the Student Portal.</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onConfirm(bus.id);
              onClose();
            }}
          >
            <AlertTriangle size={14} /> Confirm Simulated Breakdown
          </Button>
        </div>
      </div>
    </div>
  );
}
