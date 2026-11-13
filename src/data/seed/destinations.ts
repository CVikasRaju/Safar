import type { Destination } from "../../domain/types";

/** At least three destinations including Puttur Government College (docs/10). */
export const DESTINATIONS: Destination[] = [
  {
    id: "d-pgc",
    name: "Puttur Government College",
    villageId: "v-puttur",
    stopId: "st-pgc-gate",
    coordinates: { lat: 12.771, lon: 75.2095 },
  },
  {
    id: "d-sullia-college",
    name: "Sullia Government PU College",
    villageId: "v-sullia",
    stopId: "st-sullia-college",
    coordinates: { lat: 12.5622, lon: 75.3985 },
  },
  {
    id: "d-uppinangady-college",
    name: "Uppinangady Government First Grade College",
    villageId: "v-uppinangady",
    stopId: "st-uppinangady-college",
    coordinates: { lat: 12.8522, lon: 75.254 },
  },
  {
    id: "d-kadaba-pu",
    name: "Kadaba Government PU College",
    villageId: "v-kadaba",
    stopId: "st-kadaba-colony",
    coordinates: { lat: 12.7515, lon: 75.3605 },
  },
];
