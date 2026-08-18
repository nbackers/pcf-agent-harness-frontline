import { buildScreenContext } from "../AgentChatWidget/auth";
import { SCENARIOS, listScenarios, playScenario } from "../AgentChatWidget/demo";

describe("buildScreenContext", () => {
    it("includes populated values", () => {
        const result = buildScreenContext({
            userId: "user@example.com",
            userName: "Sample User",
            recordId: "123",
            recordTable: "sample_table"
        });

        expect(result).toEqual({
            userId: "user@example.com",
            userName: "Sample User",
            recordId: "123",
            recordTable: "sample_table"
        });
    });

    it("drops nulls and empty strings so the agent is not sent a payload of nulls", () => {
        const result = buildScreenContext({
            userId: "user@example.com",
            userName: null,
            recordId: "",
            recordTable: undefined
        });

        expect(result).toEqual({ userId: "user@example.com" });
        expect(Object.keys(result)).not.toContain("userName");
        expect(Object.keys(result)).not.toContain("recordId");
    });

    it("merges extra context from ContextJson", () => {
        const result = buildScreenContext({
            userId: "user@example.com",
            contextJson: '{"shift":"afternoon","site":"north"}'
        });

        expect(result).toEqual({
            userId: "user@example.com",
            shift: "afternoon",
            site: "north"
        });
    });

    it("ignores invalid ContextJson rather than throwing", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

        const result = buildScreenContext({
            userId: "user@example.com",
            contextJson: "{not valid json"
        });

        expect(result).toEqual({ userId: "user@example.com" });
        expect(warn).toHaveBeenCalled();

        warn.mockRestore();
    });

    it("returns an empty object when nothing is supplied", () => {
        expect(buildScreenContext({})).toEqual({});
    });
});

describe("demo scenarios", () => {
    it("exposes the documented scenarios", () => {
        expect(listScenarios().sort()).toEqual(["away", "daily", "incident", "team", "walk"]);
    });

    it("gives every turn a role, and text or a card where applicable", () => {
        for (const [name, turns] of Object.entries(SCENARIOS)) {
            expect(turns.length).toBeGreaterThan(0);

            for (const turn of turns) {
                expect(["user", "agent", "card", "typing"]).toContain(turn.role);

                if (turn.role === "user" || turn.role === "agent") {
                    expect(typeof turn.text).toBe("string");
                    expect((turn.text ?? "").length).toBeGreaterThan(0);
                }

                if (turn.role === "card") {
                    expect(turn.card).toBeDefined();
                }
            }

            expect(name).toMatch(/^[a-z]+$/);
        }
    });

    it("gives card buttons __isBotFrameworkCardAction, without which they silently do nothing", () => {
        const cardTurns = Object.values(SCENARIOS)
            .flat()
            .filter((t) => t.role === "card" && t.card);

        expect(cardTurns.length).toBeGreaterThan(0);

        for (const turn of cardTurns) {
            const actions = (turn.card as { actions?: { data?: Record<string, unknown> }[] }).actions ?? [];

            for (const action of actions) {
                expect(action.data?.__isBotFrameworkCardAction).toBe(true);
                expect(action.data?.cardAction).toBeDefined();
            }
        }
    });
});

describe("playScenario", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("emits every turn in order", () => {
        const seen: string[] = [];
        const done = jest.fn();

        playScenario("daily", (turn) => seen.push(turn.role), done);
        jest.runAllTimers();

        expect(seen).toEqual(SCENARIOS.daily.map((t) => t.role));
        expect(done).toHaveBeenCalledTimes(1);
    });

    it("stops emitting once cancelled", () => {
        const onTurn = jest.fn();
        const done = jest.fn();

        const cancel = playScenario("walk", onTurn, done);
        jest.advanceTimersByTime(500);
        const emittedBeforeCancel = onTurn.mock.calls.length;

        cancel();
        jest.runAllTimers();

        expect(onTurn.mock.calls.length).toBe(emittedBeforeCancel);
        expect(done).not.toHaveBeenCalled();
    });

    it("warns and no-ops for an unknown scenario", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        const onTurn = jest.fn();

        const cancel = playScenario("does-not-exist", onTurn);
        jest.runAllTimers();

        expect(onTurn).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalled();
        expect(() => cancel()).not.toThrow();

        warn.mockRestore();
    });
});
