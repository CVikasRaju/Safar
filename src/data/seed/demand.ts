// SAFAR — Seed Data: Demand
// Fixed illustrative values as required by docs/08_DEMAND_AND_CAPACITY.md
// R101: 145/100, R102: 90/110, R103: 185/140 — Total: 420/350 — Shortage: 70
import type { DemandSeed } from '../../domain/types';

export const SEED_DEMAND: DemandSeed[] = [
  { routeId: 'R101', expectedStudents: 145, availableSeats: 100 },
  { routeId: 'R102', expectedStudents: 90,  availableSeats: 110 },
  { routeId: 'R103', expectedStudents: 185, availableSeats: 140 },
  // R104 not in initial demand seed (express service, supplementary)
];

// Validation constants — must always match
export const DEMAND_TOTAL_EXPECTED = 420;
export const DEMAND_TOTAL_SEATS = 350;
export const DEMAND_TOTAL_SHORTAGE = 70;
