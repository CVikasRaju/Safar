// SAFAR — Seed Data: Destinations (Illustrative)
import type { Destination } from '../../domain/types';

export const SEED_DESTINATIONS: Destination[] = [
  {
    id: 'D001',
    name: 'Puttur Government College',
    type: 'COLLEGE',
    lat: 12.7580,
    lng: 75.2050,
    villageId: 'V001',
  },
  {
    id: 'D002',
    name: 'Puttur Government Hospital',
    type: 'HOSPITAL',
    lat: 12.7620,
    lng: 75.1980,
    villageId: 'V001',
  },
  {
    id: 'D003',
    name: 'Puttur Town Market',
    type: 'MARKET',
    lat: 12.7600,
    lng: 75.2010,
    villageId: 'V001',
  },
  {
    id: 'D004',
    name: 'Sullia Government College',
    type: 'COLLEGE',
    lat: 12.5560,
    lng: 75.3870,
    villageId: 'V002',
  },
];
