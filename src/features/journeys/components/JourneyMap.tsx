import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Layers, MapPin, WifiOff } from "lucide-react";
import type { JourneyOption } from "../../../domain/types/journey";
import type { SafarEvent } from "../../../domain/types";
import { useSafarState } from "../../../state/SafarStateContext";
import { cx } from "../../../components/ui";
import {
  buildJourneyMapPlan,
  buildSchematicLayout,
  type JourneyMapMarkerKind,
  type JourneyMapPlan,
} from "../mapLayout";

const MARKER_STYLES: Record<JourneyMapMarkerKind, { color: string; glyph: string; size: number }> = {
  ORIGIN: { color: "#22d3ee", glyph: "A", size: 22 },
  DESTINATION: { color: "#34d399", glyph: "B", size: 22 },
  STOP: { color: "#93c5fd", glyph: "•", size: 16 },
  TRANSFER: { color: "#fbbf24", glyph: "T", size: 20 },
  EVENT: { color: "#f87171", glyph: "!", size: 20 },
};

const LEGEND: Array<{ label: string; className: string }> = [
  { label: "Bus leg (schematic)", className: "bg-brand" },
  { label: "Walking segment (approximate)", className: "bg-amber-300" },
  { label: "Transfer point", className: "bg-amber-300" },
  { label: "Predicted event", className: "bg-red-400" },
];

function SchematicMap({ plan }: { plan: JourneyMapPlan }) {
  const layout = useMemo(() => buildSchematicLayout(plan), [plan]);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-abyss">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-[300px] w-full sm:h-[340px]"
        role="img"
        aria-label="Schematic journey map connecting stops with straight lines"
      >
        <defs>
          <pattern id="safar-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#142135" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={layout.width} height={layout.height} fill="url(#safar-grid)" />

        {layout.paths.map((path) => (
          <polyline
            key={path.id}
            points={path.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={path.kind === "BUS" ? "#22d3ee" : "#fbbf24"}
            strokeWidth={path.kind === "BUS" ? 3.5 : 2}
            strokeDasharray={path.kind === "WALK" ? "6 6" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        ))}

        {layout.markers.map((marker) => {
          const style = MARKER_STYLES[marker.kind];
          return (
            <g key={marker.id}>
              <circle
                cx={marker.x}
                cy={marker.y}
                r={style.size / 2}
                fill={style.color}
                stroke="#050a12"
                strokeWidth="2"
              />
              <text
                x={marker.x}
                y={marker.y + 3.5}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#050a12"
              >
                {style.glyph}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-brand" /> Bus leg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 border-t-2 border-dashed border-amber-300" /> Walking (approx.)
        </span>
        <span>Lines connect stop points — schematic, not road geometry.</span>
      </div>
    </div>
  );
}

export function JourneyMap({ journey }: { journey: JourneyOption }) {
  const { state } = useSafarState();
  const [mode, setMode] = useState<"map" | "schematic">("map");
  const [tilesFailed, setTilesFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const plan = useMemo(() => {
    const stopsById = new Map(state.stops.map((stop) => [stop.id, stop]));
    const eventsOnDate: SafarEvent[] = state.events.filter(
      (event) => event.date === journey.travelDate,
    );
    return buildJourneyMapPlan(journey, stopsById, eventsOnDate);
  }, [journey, state.stops, state.events]);

  useEffect(() => {
    if (mode !== "map" || tilesFailed) return;
    const container = containerRef.current;
    if (!container) return;

    let map: L.Map | undefined;
    try {
      map = L.map(container, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });

      const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
      tiles.on("tileerror", () => setTilesFailed(true));
      tiles.addTo(map);

      for (const path of plan.paths) {
        L.polyline(
          path.points.map((point) => [point.lat, point.lon] as [number, number]),
          {
            color: path.kind === "BUS" ? "#22d3ee" : "#fbbf24",
            weight: path.kind === "BUS" ? 4 : 2,
            dashArray: path.kind === "WALK" ? "6 6" : undefined,
            opacity: 0.9,
          },
        ).addTo(map);
      }

      for (const marker of plan.markers) {
        const style = MARKER_STYLES[marker.kind];
        const icon = L.divIcon({
          className: "",
          html: `<div class="safar-map-marker" style="width:${style.size}px;height:${style.size}px;background:${style.color}">${style.glyph}</div>`,
          iconSize: [style.size, style.size],
          iconAnchor: [style.size / 2, style.size / 2],
        });
        L.marker([marker.coordinates.lat, marker.coordinates.lon], { icon })
          .bindPopup(
            `<strong>${marker.label}</strong>${marker.note ? `<br/><span>${marker.note}</span>` : ""}`,
          )
          .addTo(map);
      }

      const points = plan.paths.flatMap((path) =>
        path.points.map((point) => [point.lat, point.lon] as [number, number]),
      );
      if (points.length > 0) {
        map.fitBounds(L.latLngBounds(points), { padding: [26, 26] });
      } else {
        map.setView([plan.center.lat, plan.center.lon], 13);
      }

      const resizeTimer = window.setTimeout(() => map?.invalidateSize(), 60);
      return () => {
        window.clearTimeout(resizeTimer);
        map?.remove();
      };
    } catch {
      setTilesFailed(true);
      return () => {
        map?.remove();
      };
    }
  }, [plan, mode, tilesFailed]);

  const showSchematic = mode === "schematic" || tilesFailed;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <MapPin size={13} className="text-brand" />
          <span>Journey map</span>
          {tilesFailed ? (
            <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <WifiOff size={11} /> Map tiles unavailable
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-0.5">
          <button
            type="button"
            onClick={() => setMode("map")}
            className={cx(
              "rounded-md px-2 py-1 text-[11px] font-medium",
              mode === "map" && !tilesFailed ? "bg-brand/15 text-brand" : "text-muted hover:text-ink",
            )}
          >
            Map tiles
          </button>
          <button
            type="button"
            onClick={() => setMode("schematic")}
            className={cx(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
              showSchematic ? "bg-brand/15 text-brand" : "text-muted hover:text-ink",
            )}
          >
            <Layers size={11} /> Schematic
          </button>
        </div>
      </div>

      {showSchematic ? (
        <SchematicMap plan={plan} />
      ) : (
        <div
          ref={containerRef}
          className="h-[300px] w-full overflow-hidden rounded-lg border border-line bg-abyss sm:h-[340px]"
          aria-label="Map of the planned journey"
        />
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
        {LEGEND.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1.5">
            <span className={cx("h-2 w-2 rounded-full", entry.className)} />
            {entry.label}
          </li>
        ))}
      </ul>
      <p className="text-[10px] leading-relaxed text-muted">
        Bus lines connect the demo stop coordinates; they are not digitisable road geometry.
        Walking lines are straight-line approximations, not pedestrian routing. Base map ©
        OpenStreetMap contributors.
      </p>
    </div>
  );
}
