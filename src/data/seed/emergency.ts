import type { Bus } from "../../domain/types";
import type {
  EmergencyStudentRecord,
  Road,
  RoadCondition,
} from "../../domain/types/emergency";
import { hhmmToMinutes, minutesToHhmm } from "../../domain/calculations/time";

/**
 * Emergency demo data.
 *
 * Everything here is simulated over the existing SAFAR demo network: road
 * distances are derived from the seed stop coordinates with a documented
 * 1.25 road factor, and student groups sum to the documented baseline of 420
 * students (145 + 90 + 185). No real-world road or passenger data is implied.
 */

/** Illustrative roads: one per consecutive seed-stop pair used by R101–R104. */
export const EMERGENCY_ROADS: Road[] = [
  {
    id: "rd-puttur-panaje",
    name: "Puttur – Panaje road",
    fromStopId: "st-puttur-busstand",
    toStopId: "st-panaje",
    distanceKm: 12.5,
    travelMinutes: 30,
    provenance: "SIMULATED",
  },
  {
    id: "rd-panaje-kadaba",
    name: "Panaje – Kadaba road",
    fromStopId: "st-panaje",
    toStopId: "st-kadaba-busstand",
    distanceKm: 11,
    travelMinutes: 28,
    provenance: "SIMULATED",
  },
  {
    id: "rd-kadaba-bellare",
    name: "Kadaba – Bellare road",
    fromStopId: "st-kadaba-busstand",
    toStopId: "st-bellare",
    distanceKm: 12.5,
    travelMinutes: 30,
    provenance: "SIMULATED",
  },
  {
    id: "rd-bellare-sullia",
    name: "Bellare – Sullia road",
    fromStopId: "st-bellare",
    toStopId: "st-sullia-busstand",
    distanceKm: 16,
    travelMinutes: 39,
    provenance: "SIMULATED",
  },
  {
    id: "rd-vittal-town-cross",
    name: "Vittal Town – Vittal Cross road",
    fromStopId: "st-vittal-town",
    toStopId: "st-vittal-cross",
    distanceKm: 2.5,
    travelMinutes: 6,
    provenance: "SIMULATED",
  },
  {
    id: "rd-vittal-cross-mangalore",
    name: "Vittal Cross – Mangalore Road road",
    fromStopId: "st-vittal-cross",
    toStopId: "st-puttur-mangalore-road",
    distanceKm: 7.8,
    travelMinutes: 17,
    provenance: "SIMULATED",
  },
  {
    id: "rd-puttur-mangalore",
    name: "Puttur – Mangalore Road (Nettaravathi bridge)",
    fromStopId: "st-puttur-busstand",
    toStopId: "st-puttur-mangalore-road",
    distanceKm: 3.5,
    travelMinutes: 8,
    alternativeRoadId: "rd-puttur-ring-mangalore",
    provenance: "SIMULATED",
  },
  {
    id: "rd-puttur-ring-mangalore",
    name: "Puttur ring road – Mangalore Road detour",
    fromStopId: "st-puttur-busstand",
    toStopId: "st-puttur-mangalore-road",
    distanceKm: 6.7,
    travelMinutes: 15,
    provenance: "SIMULATED",
  },
  {
    id: "rd-mangalore-pgc",
    name: "Mangalore Road – College approach road",
    fromStopId: "st-puttur-mangalore-road",
    toStopId: "st-pgc-gate",
    distanceKm: 4.3,
    travelMinutes: 8,
    provenance: "SIMULATED",
  },
  {
    id: "rd-uppinangady-mangalore",
    name: "Uppinangady – Mangalore Road road",
    fromStopId: "st-uppinangady-busstand",
    toStopId: "st-puttur-mangalore-road",
    distanceKm: 17,
    travelMinutes: 30,
    provenance: "SIMULATED",
  },
];

/** Road reserved for the relief/replacement buses released during the emergency. */
export const EMERGENCY_RESERVE_BUSES: Bus[] = [
  {
    id: "bus-ka21np712",
    registration: "KA-21-NP-712",
    capacity: 52,
    occupiedSeats: 0,
    status: "AVAILABLE",
    lastKnownLocationLabel: "Puttur depot relief bay",
    estimatedResponseMinutes: 15,
    commitments: ["Released for emergency relief duty"],
    provenance: "SIMULATED",
  },
  {
    id: "bus-ka21qr815",
    registration: "KA-21-QR-815",
    capacity: 48,
    occupiedSeats: 0,
    status: "AVAILABLE",
    lastKnownLocationLabel: "Uppinangady depot relief bay",
    estimatedResponseMinutes: 20,
    commitments: ["Released for emergency relief duty"],
    provenance: "SIMULATED",
  },
];

export const EMERGENCY_CONFIG = {
  demandIncreasePct: 40,
  examWindowMinutes: 120,
  failedBusIds: ["bus-ka21ab102", "bus-ka21cd204"] as string[],
  blockedRoadId: "rd-puttur-mangalore",
  blockedRoadName: "Puttur – Mangalore Road (Nettaravathi bridge)",
  destinationId: "d-pgc",
} as const;

interface BaselineGroupTemplate {
  routeId: string;
  villageId: string;
  pickupStopId: string;
  /** Group sizes; each entry becomes one student group record. */
  sizes: number[];
  /** Arrival deadline offset from the scenario clock, in minutes. */
  arrivalOffsetMinutes: number;
  examOffsetsByIndex?: Record<number, number>;
}

const BASELINE_TEMPLATES: BaselineGroupTemplate[] = [
  {
    routeId: "R101",
    villageId: "v-puttur",
    pickupStopId: "st-panaje",
    sizes: [9, 8, 8],
    arrivalOffsetMinutes: 120,
  },
  {
    routeId: "R101",
    villageId: "v-kadaba",
    pickupStopId: "st-kadaba-busstand",
    sizes: [12, 11, 11, 11, 10],
    arrivalOffsetMinutes: 120,
    examOffsetsByIndex: { 0: 95, 2: 110 },
  },
  {
    routeId: "R101",
    villageId: "v-kadaba",
    pickupStopId: "st-bellare",
    sizes: [13, 12],
    arrivalOffsetMinutes: 120,
  },
  {
    routeId: "R101",
    villageId: "v-sullia",
    pickupStopId: "st-sullia-busstand",
    sizes: [10, 10, 10, 10],
    arrivalOffsetMinutes: 120,
    examOffsetsByIndex: { 1: 100 },
  },
  {
    routeId: "R102",
    villageId: "v-vittal",
    pickupStopId: "st-vittal-town",
    sizes: [10, 10, 10, 10, 10],
    arrivalOffsetMinutes: 110,
    examOffsetsByIndex: { 0: 115 },
  },
  {
    routeId: "R102",
    villageId: "v-vittal",
    pickupStopId: "st-vittal-cross",
    sizes: [13, 12],
    arrivalOffsetMinutes: 110,
  },
  {
    routeId: "R102",
    villageId: "v-puttur",
    pickupStopId: "st-puttur-mangalore-road",
    sizes: [8, 7],
    arrivalOffsetMinutes: 110,
  },
  {
    routeId: "R103",
    villageId: "v-uppinangady",
    pickupStopId: "st-uppinangady-busstand",
    sizes: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    arrivalOffsetMinutes: 120,
    examOffsetsByIndex: { 0: 90, 5: 105 },
  },
  {
    routeId: "R103",
    villageId: "v-puttur",
    pickupStopId: "st-puttur-mangalore-road",
    sizes: [10, 10, 10],
    arrivalOffsetMinutes: 120,
  },
  {
    routeId: "R103",
    villageId: "v-puttur",
    pickupStopId: "st-puttur-busstand",
    sizes: [9, 9, 9, 8],
    arrivalOffsetMinutes: 120,
  },
];

interface SurgeGroupTemplate {
  routeId: string;
  villageId: string;
  pickupStopId: string;
  sizes: number[];
}

/** Additional students implied by exactly +40% over the 420-student baseline (168). */
const SURGE_TEMPLATES: SurgeGroupTemplate[] = [
  { routeId: "R101", villageId: "v-puttur", pickupStopId: "st-panaje", sizes: [15] },
  { routeId: "R101", villageId: "v-kadaba", pickupStopId: "st-kadaba-busstand", sizes: [15, 14] },
  { routeId: "R101", villageId: "v-sullia", pickupStopId: "st-sullia-busstand", sizes: [14] },
  { routeId: "R102", villageId: "v-vittal", pickupStopId: "st-vittal-town", sizes: [12, 12] },
  { routeId: "R102", villageId: "v-vittal", pickupStopId: "st-vittal-cross", sizes: [12] },
  { routeId: "R103", villageId: "v-uppinangady", pickupStopId: "st-uppinangady-busstand", sizes: [19, 19] },
  {
    routeId: "R103",
    villageId: "v-puttur",
    pickupStopId: "st-puttur-mangalore-road",
    sizes: [18],
  },
  { routeId: "R103", villageId: "v-puttur", pickupStopId: "st-puttur-busstand", sizes: [18] },
];

export interface MaterialiseOptions {
  clockMinutes: number;
  includeSurge: boolean;
}

function materialiseRecord(
  template: {
    routeId: string;
    villageId: string;
    pickupStopId: string;
    sizes: number[];
  },
  index: number,
  options: MaterialiseOptions,
  arrivalOffset: number,
  examOffset: number | undefined,
  isSurge: boolean,
  prefix: string,
): EmergencyStudentRecord {
  const deadline = options.clockMinutes + arrivalOffset;
  const exam = examOffset === undefined ? undefined : options.clockMinutes + examOffset;
  const size = template.sizes[index];
  return {
    id: `${prefix}-${template.routeId}-${template.pickupStopId.replace("st-", "")}-${index + 1}`,
    label: `${template.pickupStopId.replace("st-", "").replace(/-/g, " ")} group ${index + 1}`,
    villageId: template.villageId,
    destinationId: EMERGENCY_CONFIG.destinationId,
    pickupStopId: template.pickupStopId,
    originalRouteId: template.routeId,
    groupSize: size,
    requiredArrivalTime: minutesToHhmm(deadline),
    requiredArrivalMinutes: deadline,
    examStartTime: exam === undefined ? undefined : minutesToHhmm(exam),
    examStartMinutes: exam,
    isSurge,
    provenance: isSurge ? "SIMULATED" : "DEMO",
  };
}

/**
 * Builds the student groups for a run of the emergency scenario.
 * Baseline groups sum to 420 students; surge groups add exactly 168 (40%).
 */
export function materialiseEmergencyStudents(
  clockMinutes: number,
): { students: EmergencyStudentRecord[]; baselineStudents: number; surgeStudents: number } {
  const students: EmergencyStudentRecord[] = [];

  for (const template of BASELINE_TEMPLATES) {
    template.sizes.forEach((_, index) => {
      students.push(
        materialiseRecord(
          template,
          index,
          { clockMinutes, includeSurge: false },
          template.arrivalOffsetMinutes,
          template.examOffsetsByIndex?.[index],
          false,
          "BASE",
        ),
      );
    });
  }

  const baselineStudents = students.reduce((sum, student) => sum + student.groupSize, 0);

  for (const template of SURGE_TEMPLATES) {
    template.sizes.forEach((_, index) => {
      students.push(
        materialiseRecord(
          template,
          index,
          { clockMinutes, includeSurge: true },
          120,
          undefined,
          true,
          "SURGE",
        ),
      );
    });
  }

  const totalStudents = students.reduce((sum, student) => sum + student.groupSize, 0);
  return {
    students,
    baselineStudents,
    surgeStudents: totalStudents - baselineStudents,
  };
}

export function baselineStudentTotal(): number {
  return BASELINE_TEMPLATES.reduce(
    (sum, template) => sum + template.sizes.reduce((inner, size) => inner + size, 0),
    0,
  );
}

export function surgeStudentTotal(): number {
  return SURGE_TEMPLATES.reduce(
    (sum, template) => sum + template.sizes.reduce((inner, size) => inner + size, 0),
    0,
  );
}

export function emergencyRoadConditions(
  blockedRoadId: string,
  affectedStopIds: string[],
  reportedAt: string,
): RoadCondition[] {
  return [
    {
      roadId: blockedRoadId,
      status: "FLOODED",
      reason:
        "Simulated flooding over the Nettaravathi bridge approach: the road is impassable for buses and the roadside stop is submerged.",
      affectedStopIds,
      reportedAt,
      provenance: "SIMULATED",
    },
    ...EMERGENCY_ROADS.filter((road) => road.id !== blockedRoadId).map<RoadCondition>((road) => ({
      roadId: road.id,
      status: "OPEN",
      provenance: "SIMULATED",
    })),
  ];
}

/** Exam times are expressed relative to the scenario clock so the demo is stable. */
export function scenarioClockFrom(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function parseClock(value: string): number {
  return hhmmToMinutes(value);
}
