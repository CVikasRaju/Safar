import type { Stop } from "../../domain/types";

/** Illustrative stop points (docs/10). At least ten stops are required by the specification. */
export const STOPS: Stop[] = [
  {
    id: "st-puttur-busstand",
    name: "Puttur Bus Stand",
    villageId: "v-puttur",
    coordinates: { lat: 12.759, lon: 75.201 },
  },
  {
    id: "st-puttur-mangalore-road",
    name: "Mangalore Road Junction",
    villageId: "v-puttur",
    coordinates: { lat: 12.748, lon: 75.178 },
  },
  {
    id: "st-pgc-gate",
    name: "Puttur Government College Gate",
    villageId: "v-puttur",
    coordinates: { lat: 12.771, lon: 75.2095 },
  },
  {
    id: "st-panaje",
    name: "Panaje",
    villageId: "v-puttur",
    coordinates: { lat: 12.712, lon: 75.286 },
  },
  {
    id: "st-kadaba-busstand",
    name: "Kadaba Bus Stand",
    villageId: "v-kadaba",
    coordinates: { lat: 12.748, lon: 75.37 },
  },
  {
    id: "st-kadaba-colony",
    name: "Kadaba Colony",
    villageId: "v-kadaba",
    coordinates: { lat: 12.7515, lon: 75.3605 },
  },
  {
    id: "st-bellare",
    name: "Bellare",
    villageId: "v-sullia",
    coordinates: { lat: 12.662, lon: 75.321 },
  },
  {
    id: "st-sullia-busstand",
    name: "Sullia Bus Stand",
    villageId: "v-sullia",
    coordinates: { lat: 12.556, lon: 75.39 },
  },
  {
    id: "st-sullia-college",
    name: "Sullia Government PU College",
    villageId: "v-sullia",
    coordinates: { lat: 12.5622, lon: 75.3985 },
  },
  {
    id: "st-uppinangady-busstand",
    name: "Uppinangady Bus Stand",
    villageId: "v-uppinangady",
    coordinates: { lat: 12.847, lon: 75.246 },
  },
  {
    id: "st-uppinangady-college",
    name: "Uppinangady Government First Grade College",
    villageId: "v-uppinangady",
    coordinates: { lat: 12.8522, lon: 75.254 },
  },
  {
    id: "st-vittal-town",
    name: "Vittal Town",
    villageId: "v-vittal",
    coordinates: { lat: 12.7648, lon: 75.1078 },
  },
  {
    id: "st-vittal-cross",
    name: "Vittal Cross",
    villageId: "v-vittal",
    coordinates: { lat: 12.7645, lon: 75.124 },
  },
];
