import type { Route } from "../../domain/types";

/**
 * Four demo routes R101–R104 (docs/00, docs/10). R104 exists because the
 * central scenario names it. Stop order is the OUTBOUND direction.
 */
export const ROUTES: Route[] = [
  {
    id: "R101",
    name: "Puttur – Kadaba – Sullia",
    description:
      "Inter-village service from Puttur Bus Stand to Sullia Bus Stand via Panaje, Kadaba and Bellare.",
    importance: "PRIMARY",
    originVillageId: "v-puttur",
    destinationId: "d-sullia-college",
    stops: [
      "st-puttur-busstand",
      "st-panaje",
      "st-kadaba-busstand",
      "st-bellare",
      "st-sullia-busstand",
    ],
    stopIds: [
      "st-puttur-busstand",
      "st-panaje",
      "st-kadaba-busstand",
      "st-bellare",
      "st-sullia-busstand",
    ],
  },
  {
    id: "R102",
    name: "Vittal – Puttur",
    description: "Vittal Town to Puttur Bus Stand via Vittal Cross and Mangalore Road Junction.",
    importance: "PRIMARY",
    originVillageId: "v-vittal",
    destinationId: "d-pgc",
    stops: [
      "st-vittal-town",
      "st-vittal-cross",
      "st-puttur-mangalore-road",
      "st-puttur-busstand",
    ],
    stopIds: [
      "st-vittal-town",
      "st-vittal-cross",
      "st-puttur-mangalore-road",
      "st-puttur-busstand",
    ],
  },
  {
    id: "R103",
    name: "Uppinangady – Puttur",
    description: "Uppinangady Bus Stand to Puttur Bus Stand via Mangalore Road Junction.",
    importance: "SECONDARY",
    originVillageId: "v-uppinangady",
    destinationId: "d-pgc",
    stops: ["st-uppinangady-busstand", "st-puttur-mangalore-road", "st-puttur-busstand"],
    stopIds: ["st-uppinangady-busstand", "st-puttur-mangalore-road", "st-puttur-busstand"],
  },
  {
    id: "R104",
    name: "Puttur Town – College Feeder",
    description:
      "Short town feeder linking Puttur Bus Stand, Mangalore Road Junction and Puttur Government College Gate.",
    importance: "FEEDER",
    originVillageId: "v-puttur",
    destinationId: "d-pgc",
    stops: ["st-puttur-busstand", "st-puttur-mangalore-road", "st-pgc-gate"],
    stopIds: ["st-puttur-busstand", "st-puttur-mangalore-road", "st-pgc-gate"],
  },
];
