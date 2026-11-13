// SAFAR — Seed Data: Routes (Illustrative)
// R101, R102, R103, R104 — required by specification
import type { Route } from '../../domain/types';

export const SEED_ROUTES: Route[] = [
  {
    id: 'R101',
    name: 'Sullia → Puttur (via Kadaba)',
    stopIds: ['S004', 'S005', 'S009', 'S008', 'S012', 'S001', 'S002'],
    originVillageId: 'V002',
    destinationId: 'D001',
    description: 'Main route from Sullia to Puttur Government College via Kadaba.',
    provenance: 'DEMO',
  },
  {
    id: 'R102',
    name: 'Uppinangady → Puttur',
    stopIds: ['S006', 'S007', 'S012', 'S001', 'S002'],
    originVillageId: 'V003',
    destinationId: 'D001',
    description: 'Route from Uppinangady to Puttur Government College.',
    provenance: 'DEMO',
  },
  {
    id: 'R103',
    name: 'Vittal → Puttur (via Kadaba)',
    stopIds: ['S010', 'S011', 'S008', 'S012', 'S001', 'S002'],
    originVillageId: 'V005',
    destinationId: 'D001',
    description: 'Route from Vittal to Puttur Government College via Kadaba.',
    provenance: 'DEMO',
  },
  {
    id: 'R104',
    name: 'Sullia → Puttur (Express)',
    stopIds: ['S004', 'S012', 'S001', 'S002'],
    originVillageId: 'V002',
    destinationId: 'D001',
    description: 'Express route from Sullia to Puttur — fewer stops. Passes event area.',
    provenance: 'DEMO',
  },
];
