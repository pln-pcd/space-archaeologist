import { defineMission } from "./schema";
const content = import.meta.glob("../content/missions/*.json", {
  eager: true,
  import: "default",
});
export const MISSIONS = new Map(
  Object.values(content).map((value) => {
    const mission = defineMission(value);
    return [mission.meta.id, mission];
  }),
);
export const MOON = MISSIONS.get("moon-001")!;
