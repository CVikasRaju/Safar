import type { DemandSeedRecord } from "../../domain/types";

/**
 * Required illustrative demand values (docs/08). Totals: 420 expected
 * students, 350 available seats, 70 seat potential shortage.
 */
export const DEMAND_SEED: DemandSeedRecord[] = [
  {
    routeId: "R101",
    expectedStudents: 145,
    availableSeats: 100,
    provenance: "DEMO",
    note: "Illustrative seed demand, not a measured passenger count.",
  },
  {
    routeId: "R102",
    expectedStudents: 90,
    availableSeats: 110,
    provenance: "DEMO",
    note: "Illustrative seed demand, not a measured passenger count.",
  },
  {
    routeId: "R103",
    expectedStudents: 185,
    availableSeats: 140,
    provenance: "DEMO",
    note: "Illustrative seed demand, not a measured passenger count.",
  },
];

export const SEED_DEMAND = DEMAND_SEED;

export const DEMAND_TOTAL_EXPECTED = 420;
export const DEMAND_TOTAL_SEATS = 350;
export const DEMAND_TOTAL_SHORTAGE = 70;

export const DEMAND_SEED_TOTALS = DEMAND_SEED.reduce(
  (totals, record) => ({
    expectedStudents: totals.expectedStudents + record.expectedStudents,
    availableSeats: totals.availableSeats + record.availableSeats,
  }),
  { expectedStudents: 0, availableSeats: 0 },
);
