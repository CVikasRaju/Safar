import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  Eye,
  MapPin,
  Search,
} from "lucide-react";
import type { Bus, Route } from "../../../domain/types";
import { Badge, Button, Mono, cx } from "../../../components/ui";

interface FleetTableProps {
  buses: Bus[];
  routes: Route[];
  onSelectBus: (bus: Bus) => void;
  onSimulateBreakdown: (bus: Bus) => void;
  initialStatusFilter?: string;
}

export function FleetTable({
  buses,
  routes,
  onSelectBus,
  onSimulateBreakdown,
  initialStatusFilter = "ALL",
}: FleetTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [routeFilter, setRouteFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredBuses = buses.filter((bus) => {
    if (statusFilter !== "ALL" && bus.status !== statusFilter) return false;
    if (routeFilter !== "ALL" && bus.assignedRouteId !== routeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchReg = bus.registration.toLowerCase().includes(q);
      const matchRoute = bus.assignedRouteId?.toLowerCase().includes(q) ?? false;
      const matchLoc = bus.lastKnownLocationLabel.toLowerCase().includes(q);
      if (!matchReg && !matchRoute && !matchLoc) return false;
    }
    return true;
  });

  const statusBadgeTone = (status: string): "success" | "brand" | "critical" | "warning" | "neutral" => {
    switch (status) {
      case "OPERATING":
        return "success";
      case "AVAILABLE":
        return "brand";
      case "UNAVAILABLE":
        return "critical";
      case "MAINTENANCE":
        return "warning";
      case "REPLACEMENT_ASSIGNED":
        return "brand";
      default:
        return "neutral";
    }
  };

  return (
    <div className="space-y-3">
      {/* Filters and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-line bg-panel p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search registration, depot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="safar-input py-1.5 pl-8 text-xs"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase text-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="safar-input py-1 text-xs"
            >
              <option value="ALL">All Statuses ({buses.length})</option>
              <option value="OPERATING">Operating ({buses.filter((b) => b.status === "OPERATING").length})</option>
              <option value="AVAILABLE">Available Reserve ({buses.filter((b) => b.status === "AVAILABLE").length})</option>
              <option value="UNAVAILABLE">Unavailable ({buses.filter((b) => b.status === "UNAVAILABLE").length})</option>
              <option value="MAINTENANCE">Maintenance ({buses.filter((b) => b.status === "MAINTENANCE").length})</option>
              <option value="REPLACEMENT_ASSIGNED">Replacement Assigned ({buses.filter((b) => b.status === "REPLACEMENT_ASSIGNED").length})</option>
            </select>
          </div>

          {/* Route filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase text-muted">Route:</span>
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="safar-input py-1 text-xs"
            >
              <option value="ALL">All Routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[11px] text-muted">
          Showing <strong>{filteredBuses.length}</strong> of {buses.length} buses
        </p>
      </div>

      {/* Fleet Table */}
      <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line bg-abyss/40 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3.5 py-3">Registration & Status</th>
              <th className="px-3.5 py-3">Assigned Route</th>
              <th className="px-3.5 py-3">Capacity & Occupancy</th>
              <th className="px-3.5 py-3">Depot Location</th>
              <th className="px-3.5 py-3">Response Time</th>
              <th className="px-3.5 py-3">Availability</th>
              <th className="px-3.5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredBuses.map((bus) => {
              const route = routes.find((r) => r.id === bus.assignedRouteId);
              const remaining = Math.max(0, bus.capacity - bus.occupiedSeats);
              const occupancyPct = Math.min(100, Math.round((bus.occupiedSeats / bus.capacity) * 100));

              return (
                <tr key={bus.id} className="transition-colors hover:bg-panel-2/60">
                  {/* Registration & Status */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink tracking-tight">{bus.registration}</span>
                    </div>
                    <div className="mt-1">
                      <Badge tone={statusBadgeTone(bus.status)}>
                        {bus.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </td>

                  {/* Route */}
                  <td className="px-3.5 py-3">
                    {bus.assignedRouteId ? (
                      <div>
                        <span className="font-bold text-brand">{bus.assignedRouteId}</span>
                        {route ? (
                          <p className="mt-0.5 max-w-[150px] truncate text-[10px] text-muted">
                            {route.name}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted">Reserve Depot</span>
                    )}
                  </td>

                  {/* Capacity & Progress */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">
                        <Mono>{bus.capacity}</Mono> seats
                      </span>
                      <span className="text-[10px] text-muted">
                        (<Mono>{remaining}</Mono> remaining)
                      </span>
                    </div>
                    {/* Visual bar */}
                    <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-panel-3">
                      <div
                        className={cx(
                          "h-full rounded-full",
                          occupancyPct > 90 ? "bg-red-400" : occupancyPct > 60 ? "bg-amber-400" : "bg-emerald-400",
                        )}
                        style={{ width: `${occupancyPct}%` }}
                      />
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1 text-[11px] text-ink-dim">
                      <MapPin size={12} className="text-muted shrink-0" />
                      <span className="max-w-[140px] truncate" title={bus.lastKnownLocationLabel}>
                        {bus.lastKnownLocationLabel}
                      </span>
                    </div>
                  </td>

                  {/* Response Time */}
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-muted shrink-0" />
                      <span className="font-semibold text-ink">
                        <Mono>{bus.estimatedResponseMinutes ?? 20} min</Mono>
                      </span>
                    </div>
                    <p className="text-[9px] text-muted">Illustrative ETA</p>
                  </td>

                  {/* Availability / Commitments */}
                  <td className="px-3.5 py-3">
                    {bus.commitments.length > 0 ? (
                      <span className="text-[10px] text-amber-300 font-medium truncate block max-w-[130px]" title={bus.commitments.join(", ")}>
                        {bus.commitments[0]}
                      </span>
                    ) : bus.status === "AVAILABLE" ? (
                      <span className="text-[10px] text-emerald-300 font-medium">Ready for dispatch</span>
                    ) : bus.status === "OPERATING" ? (
                      <span className="text-[10px] text-ink-dim">In service</span>
                    ) : (
                      <span className="text-[10px] text-red-300">Unavailable</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSelectBus(bus)}
                        title="View complete bus specifications"
                      >
                        <Eye size={12} /> View
                      </Button>

                      {bus.status === "OPERATING" ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onSimulateBreakdown(bus)}
                          title="Simulate mechanical breakdown"
                        >
                          <AlertTriangle size={12} /> Breakdown
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
