/**
 * Offline demo harness.
 *
 * Plays a scripted conversation with no network dependency.
 *
 * This exists because live agents make poor demonstrations. Conference wifi drops, a
 * model takes eleven seconds to answer the one question the story was built around, or
 * it answers differently than it did in rehearsal. None of that reflects the product,
 * but it is what the audience remembers.
 *
 * A scripted mode is not dishonest as long as it is labelled - the point of a demo is
 * usually the workflow, not proof that the model can form a sentence. Run the live agent
 * for the parts where the model's own behaviour is what you are showing.
 *
 * The scenarios below are a generic frontline set. Replace them with your own.
 */

export type DemoRole = "user" | "agent" | "card" | "typing";

export interface DemoTurn {
    role: DemoRole;
    text?: string;
    card?: Record<string, unknown>;
    delayMs?: number;
}

/** Default pauses. Long enough to read, short enough not to stall a demo. */
const DEFAULT_DELAYS: Record<DemoRole, number> = {
    user: 400,
    agent: 900,
    card: 1100,
    typing: 700
};

export const SCENARIOS: Record<string, DemoTurn[]> = {
    /** Start of shift: what needs attention today. */
    daily: [
        { role: "user", text: "What do I need to know today?" },
        { role: "typing" },
        {
            role: "agent",
            text:
                "Morning. Three things need you today.\n\n" +
                "**Needs a decision**\n" +
                "A priority-one fault is open and unassigned - it has been sitting for 40 minutes.\n\n" +
                "**Stock**\n" +
                "Two lines are below reorder level. One has a delayed inbound order, so it will not " +
                "cover the weekend.\n\n" +
                "**People**\n" +
                "Two team members are away, both approved. You are one short on the afternoon shift.\n\n" +
                "The unassigned fault is the one that will hurt if it waits."
        }
    ],

    /** Walking the floor, capturing issues hands-free. */
    walk: [
        { role: "user", text: "Starting my walk" },
        { role: "typing" },
        { role: "agent", text: "I'll log as you go. Describe what you see, or send a photo." },
        { role: "user", text: "Shelf is empty in aisle four" },
        { role: "typing" },
        {
            role: "agent",
            text:
                "Logged a replenishment task for aisle four and assigned it to the team member on " +
                "that section. Anything else?"
        },
        { role: "user", text: "There is water on the floor near the entrance" },
        { role: "typing" },
        {
            role: "agent",
            text:
                "Raised a hazard, marked it urgent and notified the duty manager. Put a sign out " +
                "now - I've added it to the task so the follow-up is recorded."
        }
    ],

    /** Something has gone wrong and several things must happen at once. */
    incident: [
        { role: "user", text: "A customer slipped near the entrance" },
        { role: "typing" },
        { role: "agent", text: "I'll coordinate this. First - is anyone hurt, and have they been attended to?" },
        { role: "user", text: "Minor, first aid given, they are okay" },
        { role: "typing" },
        {
            role: "card",
            text: "Incident coordination",
            card: {
                type: "AdaptiveCard",
                version: "1.5",
                body: [
                    { type: "TextBlock", text: "Incident coordination", weight: "Bolder", size: "Medium" },
                    {
                        type: "FactSet",
                        facts: [
                            { title: "Report", value: "Drafted, awaiting your confirmation" },
                            { title: "Safety", value: "Hazard raised, area marked" },
                            { title: "First aid", value: "Recorded" },
                            { title: "Notification", value: "Duty manager informed" },
                            { title: "Follow-up", value: "Scheduled for tomorrow" }
                        ]
                    },
                    {
                        type: "TextBlock",
                        text: "Nothing is submitted until you confirm.",
                        wrap: true,
                        isSubtle: true
                    }
                ],
                actions: [
                    {
                        type: "Action.Submit",
                        title: "Review and confirm",
                        // Without __isBotFrameworkCardAction this button produces a textless
                        // activity and appears to do nothing. See the README.
                        data: {
                            __isBotFrameworkCardAction: true,
                            cardAction: {
                                type: "messageBack",
                                text: "Confirm incident report",
                                displayText: "Review and confirm"
                            },
                            msteams: {
                                type: "messageBack",
                                text: "Confirm incident report",
                                displayText: "Review and confirm"
                            }
                        }
                    }
                ]
            }
        }
    ],

    /** Returning after time off. */
    away: [
        { role: "user", text: "I have been off for a week, what did I miss?" },
        { role: "typing" },
        {
            role: "agent",
            text:
                "Here's the week, shortest useful version.\n\n" +
                "**Still open for you**\n" +
                "One escalation is waiting on your decision. It was raised Tuesday.\n\n" +
                "**Handled while you were away**\n" +
                "Two faults were resolved and a delivery shortfall was rebooked.\n\n" +
                "**Changed**\n" +
                "The weekend roster moved - you have a different opening team.\n\n" +
                "Want the escalation first?"
        }
    ],

    /** Recognising and supporting the team. */
    team: [
        { role: "user", text: "How is my team doing?" },
        { role: "typing" },
        {
            role: "agent",
            text:
                "Two things worth your attention.\n\n" +
                "Someone on your team has had three customer compliments this fortnight and has " +
                "not been recognised for any of them. Worth a word today.\n\n" +
                "Someone else has worked six days straight because of the cover gap. They have not " +
                "flagged it. Their next scheduled break is Thursday.\n\n" +
                "Want me to draft the recognition note?"
        }
    ]
};

/**
 * Play a scenario, calling back for each turn.
 *
 * Returns a cancel function. Call it when the widget closes, or turns keep arriving
 * after the user has moved on.
 */
export function playScenario(
    scenarioKey: string,
    onTurn: (turn: DemoTurn) => void,
    onComplete?: () => void
): () => void {
    const turns = SCENARIOS[scenarioKey];

    if (!turns) {
        console.warn(`Unknown demo scenario: ${scenarioKey}`);
        return () => { /* nothing to cancel */ };
    }

    let cancelled = false;
    let timer: number | undefined;

    const step = (index: number): void => {
        if (cancelled || index >= turns.length) {
            if (!cancelled && onComplete) onComplete();
            return;
        }

        const turn = turns[index];
        const delay = turn.delayMs ?? DEFAULT_DELAYS[turn.role] ?? 600;

        timer = window.setTimeout(() => {
            if (cancelled) return;
            onTurn(turn);
            step(index + 1);
        }, delay);
    };

    step(0);

    return () => {
        cancelled = true;
        if (timer !== undefined) window.clearTimeout(timer);
    };
}

/** List available scenarios, for building conversation starters. */
export function listScenarios(): string[] {
    return Object.keys(SCENARIOS);
}
