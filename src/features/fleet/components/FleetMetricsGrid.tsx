import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Clock,
  Route as RouteIcon,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import type { FleetIndicators } from "../../../domain/calculations/fleetRanking";
import { StatCard } from "../../../components/ui";

interface FleetMetricsGridProps {
  indicators: FleetIndicators;
  onFilterStatus?: (status: string) => void;
}

export function FleetMetricsGrid({ indicators, onFilterStatus }: FleetMetricsGridProps) {
  return (
    <div className="space-y-3">
      {/* Primary fleet & disruption indicators */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onFilterStatus?.("ALL")}
          className="text-left transition-transform hover:scale-[1.01]"
        >
          <StatCard
            label="Total Fleet Size"
            value={indicators.totalBuses}
            hint="Seed prototype rural fleet"
            tone="brand"
            icon={<Bus size={16} />}
          />
        </button>

        <button
          type="button"
          onClick={() => onFilterStatus?.("OPERATING")}
          className="text-left transition-transform hover:scale-[1.01]"
        >
          <StatCard
            label="Operating Buses"
            value={indicators.operatingBuses}
            hint="Active on assigned routes"
            tone="success"
            icon={<CheckCircle2 size={16} />}
          />
        </button>

        <button
          type="button"
          onClick={() => onFilterStatus?.("AVAILABLE")}
          className="text-left transition-transform hover:scale-[1.01]"
        >
          <StatCard
            label="Available Reserve"
            value={indicators.availableBuses}
            hint="Eligible for rapid deployment"
            tone="brand"
            icon={<Clock size={16} />}
          />
        </button>

        <button
          type="button"
          onClick={() => onFilterStatus?.("UNAVAILABLE")}
          className="text-left transition-transform hover:scale-[1.01]"
        >
          <StatCard
            label="Unavailable / Breakdown"
            value={indicators.unavailableBuses + indicators.maintenanceBuses}
            hint={`${indicators.unavailableBuses} broken down, ${indicators.maintenanceBuses} maintenance`}
            tone={indicators.unavailableBuses > 0 ? "critical" : "muted"}
            icon={<Wrench size={16} />}
          />
        </button>
      </div>

      {/* Demand, capacity & operational indicators */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Expected Student Demand"
          value={indicators.expectedStudentDemand}
          hint="Aggregated route demand"
          tone="neutral"
          icon={<Users size={16} />}
        />

        <StatCard
          label="Available Fleet Seats"
          value={indicators.availableSeats}
          hint="Operating bus capacity"
          tone="neutral"
          icon={<Bus size={16} />}
        />

        <StatCard
          label="Capacity Shortage"
          value={indicators.capacityShortage}
          hint={
            indicators.capacityShortage > 0
              ? `${indicators.capacityShortage} seats deficit (R101 & R103)`
              : "Capacity meets demand"
          }
          tone={indicators.capacityShortage > 0 ? "warning" : "success"}
          icon={<AlertTriangle size={16} />}
        />

        <StatCard
          label="Active Disruptions"
          value={indicators.activeDisruptions}
          hint={`${indicators.routesRequiringAttention.length} routes require attention`}
          tone={indicators.activeDisruptions > 0 ? "critical" : "muted"}
          icon={<ShieldAlert size={16} />}
        />
      </div>

      {/* Routes requiring operational attention banner */}
      {indicators.routesRequiringAttention.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-amber-300">
            <RouteIcon size={14} /> Routes Requiring Authority Attention:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {indicators.routesRequiringAttention.map((routeId) => (
              <span
                key={routeId}
                className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-200"
              >
                {routeId}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-muted">
            (Includes active disruption, unverified student report, or initial seat shortage)
          </span>
        </div>
      ) : null}
    </div>
  );
}
