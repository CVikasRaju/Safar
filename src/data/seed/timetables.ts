// SAFAR — Seed Data: Timetables (Illustrative)
// All times are for the morning student shift (required arrival ≤09:00 at college).
import type { TimetableService } from '../../domain/types';

const WEEKDAYS: TimetableService['operatingDays'] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const SEED_TIMETABLES: TimetableService[] = [
  // R101 — Sullia → Puttur via Kadaba — Bus B001 (KA-21-AB-102)
  {
    id: 'T101A',
    routeId: 'R101',
    busId: 'B001',
    operatingDays: WEEKDAYS,
    stopTimes: [
      { stopId: 'S004', scheduledArrival: '06:30', scheduledDeparture: '06:30' },
      { stopId: 'S005', scheduledArrival: '06:35', scheduledDeparture: '06:36' },
      { stopId: 'S009', scheduledArrival: '07:05', scheduledDeparture: '07:06' },
      { stopId: 'S008', scheduledArrival: '07:12', scheduledDeparture: '07:13' },
      { stopId: 'S012', scheduledArrival: '07:45', scheduledDeparture: '07:46' },
      { stopId: 'S001', scheduledArrival: '08:15', scheduledDeparture: '08:16' },
      { stopId: 'S002', scheduledArrival: '08:25', scheduledDeparture: '08:25' },
    ],
    provenance: 'DEMO',
  },
  // R102 — Uppinangady → Puttur — Bus B002
  {
    id: 'T102A',
    routeId: 'R102',
    busId: 'B002',
    operatingDays: WEEKDAYS,
    stopTimes: [
      { stopId: 'S006', scheduledArrival: '07:00', scheduledDeparture: '07:00' },
      { stopId: 'S007', scheduledArrival: '07:05', scheduledDeparture: '07:06' },
      { stopId: 'S012', scheduledArrival: '07:50', scheduledDeparture: '07:51' },
      { stopId: 'S001', scheduledArrival: '08:20', scheduledDeparture: '08:21' },
      { stopId: 'S002', scheduledArrival: '08:30', scheduledDeparture: '08:30' },
    ],
    provenance: 'DEMO',
  },
  // R103 — Vittal → Puttur via Kadaba — Bus B003
  {
    id: 'T103A',
    routeId: 'R103',
    busId: 'B003',
    operatingDays: WEEKDAYS,
    stopTimes: [
      { stopId: 'S010', scheduledArrival: '06:45', scheduledDeparture: '06:45' },
      { stopId: 'S011', scheduledArrival: '06:48', scheduledDeparture: '06:49' },
      { stopId: 'S008', scheduledArrival: '07:10', scheduledDeparture: '07:11' },
      { stopId: 'S012', scheduledArrival: '07:40', scheduledDeparture: '07:41' },
      { stopId: 'S001', scheduledArrival: '08:10', scheduledDeparture: '08:11' },
      { stopId: 'S002', scheduledArrival: '08:20', scheduledDeparture: '08:20' },
    ],
    provenance: 'DEMO',
  },
  // R104 — Sullia → Puttur Express — Bus B004
  {
    id: 'T104A',
    routeId: 'R104',
    busId: 'B004',
    operatingDays: WEEKDAYS,
    stopTimes: [
      { stopId: 'S004', scheduledArrival: '07:00', scheduledDeparture: '07:00' },
      { stopId: 'S012', scheduledArrival: '07:55', scheduledDeparture: '07:56' },
      { stopId: 'S001', scheduledArrival: '08:25', scheduledDeparture: '08:26' },
      { stopId: 'S002', scheduledArrival: '08:35', scheduledDeparture: '08:35' },
    ],
    provenance: 'DEMO',
  },
];
