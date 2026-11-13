import {
  AlertTriangle,
  Bus as BusIcon,
  Clock,
  MapPin,
  Route as RouteIcon,
  Users,
  X,
} from "lucide-react";
import type { Bus, Route } from "../../../domain/types";
import { Badge, Button, Mono, cx } from "../../../components/ui";

interface BusDetailsModalProps {
  bus: Bus | null;
  route?: Route;
  onClose: () => void;
  onSimulateBreakdown?: (bus: Bus) => void;
}

export function BusDetailsModal({
  bus,
  route,
  onClose,
  onSimulateBreakdown,
}: BusDetailsModalProps) {
  if (!bus) return null;

  const remainingSeats = Math.max(0, bus.capacity - bus.occupiedSeats);
  const occupancyPercent = Math.min(100, Math.round((bus.occupiedSeats / bus.capacity) * 100));

  const statusTone: Record<string, "success" | "brand" | "critical" | "warning" | "neutral"> = {
    OPERATING: "success",
    AVAILABLE: "brand",
    UNAVAILABLE: "critical",
    MAINTENANCE: "warning",
    REPLACEMENT_ASSIGNED: "brand",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bus-details-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-line-strong bg-panel p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-brand/40 bg-brand/10 text-brand">
              <BusIcon size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="bus-details-title" className="text-base font-bold tracking-tight text-ink">
                  {bus.registration}
                </h3>
                <Badge tone={statusTone[bus.status] ?? "neutral"}>
                  {bus.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-[11px] text-muted">ID: {bus.id} · Provenance: {bus.provenance}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-lg border border-line-strong p-1 text-ink-dim hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 text-xs">
          {/* Route Info */}
          <div className="rounded-lg border border-line bg-abyss/60 p-3">
            <div className="flex items-center gap-2 text-ink">
              <RouteIcon size={14} className="text-brand" />
              <span className="font-semibold">Assigned Route:</span>
              <span>{bus.assignedRouteId ? `${bus.assignedRouteId}` : "Unassigned Reserve"}</span>
            </div>
            {route ? (
              <div className="mt-1.5 pl-5 text-[11px] leading-relaxed text-muted">
                <p className="font-medium text-ink-dim">{route.name}</p>
                <p className="mt-0.5">{route.description}</p>
                <p className="mt-1 text-[10px]">Serves {route.stops.length} stops</p>
              </div>
            ) : (
              <p className="mt-1 pl-5 text-[11px] text-muted">
                Stationed at reserve depot bay ready for deployment.
              </p>
            )}
          </div>

          {/* Capacity Breakdown */}
          <div className="rounded-lg border border-line bg-abyss/60 p-3">
            <div className="flex items-center justify-between text-ink">
              <span className="flex items-center gap-1.5 font-semibold">
                <Users size={14} className="text-brand" /> Seating Capacity & Occupancy
              </span>
              <span className="text-[11px] text-muted">{occupancyPercent}% Occupied</span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-panel-2">
              <div
                className={cx(
                  "h-full rounded-full transition-all",
                  occupancyPercent > 90
                    ? "bg-red-400"
                    : occupancyPercent > 60
                    ? "bg-amber-400"
                    : "bg-emerald-400",
                )}
                style={{ width: `${occupancyPercent}%` }}
              />
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-line-strong bg-panel p-1.5">
                <p className="text-[10px] uppercase text-muted">Total</p>
                <p className="text-sm font-bold text-ink"><Mono>{bus.capacity}</Mono></p>
              </div>
              <div className="rounded border border-line-strong bg-panel p-1.5">
                <p className="text-[10px] uppercase text-muted">Occupied</p>
                <p className="text-sm font-bold text-ink-dim"><Mono>{bus.occupiedSeats}</Mono></p>
              </div>
              <div className="rounded border border-line-strong bg-panel p-1.5">
                <p className="text-[10px] uppercase text-muted">Remaining</p>
                <p className="text-sm font-bold text-emerald-300"><Mono>{remainingSeats}</Mono></p>
              </div>
            </div>
          </div>

          {/* Location & Response Time */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-abyss/60 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <MapPin size={14} className="text-brand" /> Depot Location
              </div>
              <p className="mt-1 text-[11px] text-ink-dim leading-relaxed">
                {bus.lastKnownLocationLabel}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-muted">
                Demo coordinate reference
              </p>
            </div>

            <div className="rounded-lg border border-line bg-abyss/60 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <Clock size={14} className="text-brand" /> Estimated Response Time
              </div>
              <p className="mt-1 text-sm font-bold text-ink">
                <Mono>{bus.estimatedResponseMinutes ?? 20} min</Mono>
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-wider text-muted">
                Illustrative prototype estimate
              </p>
            </div>
          </div>

          {/* Commitments & Status Notes */}
          <div className="rounded-lg border border-line bg-abyss/60 p-3">
            <p className="font-semibold text-ink">Active Commitments & Notes:</p>
            {bus.commitments.length > 0 ? (
              <ul className="mt-1.5 space-y-1 pl-4 list-disc text-[11px] text-amber-200">
                {bus.commitments.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[11px] text-emerald-300">
                No restricting commitments. Operationally assignable.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          {bus.status === "OPERATING" && onSimulateBreakdown ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onClose();
                onSimulateBreakdown(bus);
              }}
            >
              <AlertTriangle size={14} /> Simulate Bus Breakdown
            </Button>
          ) : bus.status === "AVAILABLE" ? (
            <Badge tone="brand">Eligible for Replacement</Badge>
          ) : bus.status === "MAINTENANCE" ? (
            <Badge tone="warning">Workshop Maintenance</Badge>
          ) : (
            <Badge tone="critical">Unavailable</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
