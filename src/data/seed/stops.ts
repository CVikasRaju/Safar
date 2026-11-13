// SAFAR — Seed Data: Stops (Illustrative, ≥10 stops)
import type { Stop } from '../../domain/types';

export const SEED_STOPS: Stop[] = [
  // Puttur area
  { id: 'S001', name: 'Puttur Bus Stand', villageId: 'V001', lat: 12.7600, lng: 75.2000 },
  { id: 'S002', name: 'Puttur College Gate', villageId: 'V001', lat: 12.7580, lng: 75.2050 },
  { id: 'S003', name: 'Puttur Town Centre', villageId: 'V001', lat: 12.7610, lng: 75.2020 },

  // Sullia area
  { id: 'S004', name: 'Sullia Bus Stand', villageId: 'V002', lat: 12.5547, lng: 75.3864 },
  { id: 'S005', name: 'Sullia Junction', villageId: 'V002', lat: 12.5560, lng: 75.3850 },

  // Uppinangady area
  { id: 'S006', name: 'Uppinangady Bus Stop', villageId: 'V003', lat: 12.8505, lng: 75.2612 },
  { id: 'S007', name: 'Uppinangady Market', villageId: 'V003', lat: 12.8510, lng: 75.2620 },

  // Kadaba area
  { id: 'S008', name: 'Kadaba Junction', villageId: 'V004', lat: 12.7000, lng: 75.1500 },
  { id: 'S009', name: 'Kadaba School Stop', villageId: 'V004', lat: 12.7010, lng: 75.1510 },

  // Vittal area
  { id: 'S010', name: 'Vittal Bus Stop', villageId: 'V005', lat: 12.7700, lng: 75.1100 },
  { id: 'S011', name: 'Vittal Temple Stop', villageId: 'V005', lat: 12.7705, lng: 75.1095 },

  // Mid-route stops
  { id: 'S012', name: 'Kombettu Cross', villageId: 'V001', lat: 12.7400, lng: 75.1800 },
];
