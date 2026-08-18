import { IInputs, IOutputs } from "./generated/ManifestTypes";
import {
    connectWithSecret,
    connectWithSso,
    buildScreenContext,
    loadScript,
    DirectLineConnection,
    StoreContext,
    DispatchFn,
    StoreAction
} from "./auth";
import { playScenario, DemoTurn } from "./demo";

const WEBCHAT_CDN = "https://cdn.botframework.com/botframework-webchat/latest/webchat.js";

export class AgentChatWidget implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container!: HTMLDivElement;
    private panel!: HTMLDivElement;
    private body!: HTMLDivElement;
    private launcher!: HTMLButtonElement;

    private context!: ComponentFramework.Context<IInputs>;
    private notifyOutputChanged!: () => void;

    private isOpen = false;
    private isInitialised = false;

    /** Cancels the demo playback, or unsubscribes the SSO interceptor. */
    private cancelDemo?: () => void;
    private cleanupAuth?: () => void;

    /** Used to detect a configuration change that requires reconnecting. */
    private lastAuthSignature = "";

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.context = context;
        this.notifyOutputChanged = notifyOutputChanged;
        this.container = container;

        this.render();
    }

    private render(): void {
        this.container.classList.add("ach-root");

        this.launcher = document.createElement("button");
        this.launcher.className = "ach-launcher";
        this.launcher.type = "button";
        this.launcher.setAttribute("aria-label", "Open assistant");
        this.launcher.textContent = "Ask";
        this.launcher.addEventListener("click", () => this.toggle());

        this.panel = document.createElement("div");
        this.panel.className = "ach-panel ach-hidden";

        const header = document.createElement("div");
        header.className = "ach-header";

        const title = document.createElement("span");
        title.className = "ach-title";
        title.textContent = this.context.parameters.AgentName.raw || "Assistant";

        const close = document.createElement("button");
        close.className = "ach-close";
        close.type = "button";
        close.setAttribute("aria-label", "Close assistant");
        close.textContent = "\u00d7";
        close.addEventListener("click", () => this.toggle());

        header.appendChild(title);
        header.appendChild(close);

        this.body = document.createElement("div");
        this.body.className = "ach-body";

        this.panel.appendChild(header);
        this.panel.appendChild(this.body);

        this.container.appendChild(this.launcher);
        this.container.appendChild(this.panel);

        this.applyTheme();
    }

    private applyTheme(): void {
        const colour = this.context.parameters.PrimaryColor.raw || "#0f6cbd";
        this.container.style.setProperty("--ach-primary", colour);
    }

    private toggle(): void {
        this.isOpen = !this.isOpen;
        this.panel.classList.toggle("ach-hidden", !this.isOpen);

        if (this.isOpen && !this.isInitialised) {
            void this.startConversation();
        }
    }

    /**
     * Connect, or play a scripted scenario when demo mode is on.
     *
     * Demo mode is checked first deliberately - it must not require any network call,
     * which is the entire reason it exists.
     */
    private async startConversation(): Promise<void> {
        this.isInitialised = true;
        this.setStatus("Getting your assistant ready\u2026");

        try {
            if (this.context.parameters.DemoMode.raw === true) {
                this.runDemo();
                return;
            }

            const connection = await this.connect();
            await this.renderChat(connection);
        } catch (error) {
            this.setStatus(String(error instanceof Error ? error.message : error), true);
            this.isInitialised = false;
        }
    }

    private async connect(): Promise<DirectLineConnection> {
        const p = this.context.parameters;

        const tokenEndpointUrl = p.TokenEndpointUrl.raw ?? "";
        const clientId = p.ClientId.raw ?? "";
        const agentId = p.AgentId.raw ?? "";
        const secret = p.DirectLineSecret.raw ?? "";

        // SSO is selected by having the three SSO properties set. The secret is only
        // used when SSO is not configured.
        if (tokenEndpointUrl && clientId && agentId) {
            const { connection, cleanup } = await connectWithSso({ tokenEndpointUrl, clientId, agentId });
            this.cleanupAuth = cleanup;
            return connection;
        }

        if (secret) {
            return connectWithSecret(secret);
        }

        throw new Error(
            "Not configured. Set TokenEndpointUrl, ClientId and AgentId for SSO, or DirectLineSecret for development."
        );
    }

    private async renderChat(connection: DirectLineConnection): Promise<void> {
        await loadScript(WEBCHAT_CDN);

        if (!window.WebChat) {
            throw new Error("WebChat did not load. Check the allowed domains in the manifest.");
        }

        const WebChat = window.WebChat;
        this.body.innerHTML = "";

        const host = document.createElement("div");
        host.className = "ach-chat";
        this.body.appendChild(host);

        const screenContext = buildScreenContext({
            userId: this.context.parameters.UserId.raw,
            userName: this.context.parameters.UserName.raw,
            recordId: this.context.parameters.RecordId.raw,
            recordTable: this.context.parameters.RecordTable.raw,
            contextJson: this.context.parameters.ContextJson.raw
        });

        // Send the screen context once, when the connection is established. This is what
        // lets the agent open already knowing who the user is and what they are viewing.
        const store = WebChat.createStore(
            {},
            (context: StoreContext) => (next: DispatchFn) => (action: StoreAction) => {
                if (action.type === "DIRECT_LINE/CONNECT_FULFILLED") {
                    context.dispatch({
                        type: "WEB_CHAT/SEND_EVENT",
                        payload: { name: "startConversation", value: screenContext }
                    });
                }
                return next(action);
            }
        );

        WebChat.renderWebChat({ directLine: connection, store }, host);
    }

    /** Play a scripted conversation with no network dependency. */
    private runDemo(): void {
        this.body.innerHTML = "";

        const transcript = document.createElement("div");
        transcript.className = "ach-transcript";
        this.body.appendChild(transcript);

        const scenario = this.context.parameters.DemoScenario.raw || "daily";

        this.cancelDemo = playScenario(scenario, (turn: DemoTurn) => {
            const el = this.buildTurnElement(turn);
            if (!el) return;

            // A typing indicator is replaced by the turn that follows it.
            const previous = transcript.querySelector(".ach-typing");
            if (previous && turn.role !== "typing") previous.remove();

            transcript.appendChild(el);
            transcript.scrollTop = transcript.scrollHeight;
        });
    }

    private buildTurnElement(turn: DemoTurn): HTMLElement | null {
        if (turn.role === "typing") {
            const el = document.createElement("div");
            el.className = "ach-bubble ach-agent ach-typing";
            el.textContent = "\u2026";
            return el;
        }

        if (turn.role === "card") {
            const el = document.createElement("div");
            el.className = "ach-bubble ach-agent ach-card";
            // Rendered as text rather than a live Adaptive Card so demo mode has no
            // dependency on the card renderer being loaded.
            el.textContent = turn.text ?? "Card";
            return el;
        }

        const el = document.createElement("div");
        el.className = `ach-bubble ach-${turn.role}`;
        el.textContent = turn.text ?? "";
        return el;
    }

    private setStatus(message: string, isError = false): void {
        this.body.innerHTML = "";
        const el = document.createElement("div");
        el.className = isError ? "ach-status ach-error" : "ach-status";
        el.textContent = message;
        this.body.appendChild(el);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.context = context;
        this.applyTheme();

        const p = context.parameters;
        const signature = [
            p.DirectLineSecret.raw,
            p.TokenEndpointUrl.raw,
            p.ClientId.raw,
            p.AgentId.raw,
            String(p.DemoMode.raw)
        ].join("|");

        // Reconnect only when the auth configuration actually changed, so an unrelated
        // property update does not tear down a live conversation.
        if (this.lastAuthSignature && signature !== this.lastAuthSignature && this.isInitialised) {
            this.teardownConversation();
            this.isInitialised = false;
            if (this.isOpen) void this.startConversation();
        }

        this.lastAuthSignature = signature;
    }

    public getOutputs(): IOutputs {
        return { sampleProperty: this.context.parameters.sampleProperty.raw ?? undefined };
    }

    private teardownConversation(): void {
        this.cancelDemo?.();
        this.cancelDemo = undefined;
        this.cleanupAuth?.();
        this.cleanupAuth = undefined;
    }

    public destroy(): void {
        this.teardownConversation();
    }
}
