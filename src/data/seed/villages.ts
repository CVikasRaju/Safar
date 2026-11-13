import type { Village } from "../../domain/types";

/** Illustrative villages around Puttur, Karnataka (docs/10). Coordinates are approximate demo points. */
export const VILLAGES: Village[] = [
  {
    id: "v-puttur",
    name: "Puttur",
    taluk: "Puttur",
    coordinates: { lat: 12.759, lon: 75.201 },
  },
  {
    id: "v-sullia",
    name: "Sullia",
    taluk: "Sullia",
    coordinates: { lat: 12.556, lon: 75.39 },
  },
  {
    id: "v-uppinangady",
    name: "Uppinangady",
    taluk: "Puttur",
    coordinates: { lat: 12.847, lon: 75.246 },
  },
  {
    id: "v-kadaba",
    name: "Kadaba",
    taluk: "Kadaba",
    coordinates: { lat: 12.748, lon: 75.37 },
  },
  {
    id: "v-vittal",
    name: "Vittal",
    taluk: "Bantwal",
    coordinates: { lat: 12.766, lon: 75.106 },
  },
];
