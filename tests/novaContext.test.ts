import { expect, it, vi } from "vitest";
vi.mock("../apps/web/src/store", () => ({
  useStore: {
    getState: () => ({
      settings: { askNova: false },
      profile: null,
      progress: { completed: [] },
      configure: () => {},
    }),
  },
}));
import { ask, setMissionContext } from "../apps/web/src/odyssey/nova/brain";
it("answers about the displayed artifact offline and intercepts distress before rate limits", async () => {
  setMissionContext({
    missionId: "moon-001",
    step: 6,
    artifactId: "retroreflector",
  });
  const request = vi.spyOn(globalThis, "fetch");
  const answer = await ask("What is this?", "eagle", [], () => {});
  expect(answer.text.toLowerCase()).toContain("reflector");
  const distress = await ask("I want to hurt myself", "eagle", [], () => {});
  expect(distress.kind).toBe("safety");
  expect(request).not.toHaveBeenCalled();
  request.mockRestore();
  setMissionContext(null);
});
