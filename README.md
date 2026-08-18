# PCF Agent Harness

A PCF component that embeds a Copilot Studio agent **inside** a Power App — with working SSO,
screen context, and an offline demo mode.

---

## The problem

"How do I put my agent inside my app?" is one of the most-asked Power Platform questions and has no
good published answer.

The default is to send users somewhere else — Teams, or a separate chat surface. That breaks the
task they were doing, and it strips the agent of everything it could have known. The user ends up
describing their own screen to an assistant that is running inside the same tenant as the record
they're looking at.

Three things make this harder than it looks:

**Auth is the hard part, and samples skip it.** Most examples use a Direct Line secret, which is
fine on a laptop and unacceptable in production — anyone who can open the app can read it. The SSO
path exists but the piece that makes it work silently is undocumented, so users who are already
signed in get asked to sign in again. Which is precisely what they wanted SSO to avoid.

**The agent has no context.** Without passing it, the agent doesn't know who the user is, what
record is open, or what screen they're on.

**Live agents make fragile demos.** Conference wifi drops. A model takes eleven seconds on the one
question the story was built around, or answers differently than in rehearsal. None of that reflects
the product, but it's what the audience remembers.

## What this solves

| Problem | How this repo solves it |
|---|---|
| Users bounced out of the app | Agent embedded in the app, in a pop-out panel |
| Direct Line secret in production | Both auth paths, with the trade-off stated plainly |
| SSO still prompts for sign-in | OAuth card interception and silent token exchange |
| Agent doesn't know the context | User, record and table passed on conversation start |
| Card buttons silently do nothing | Documented `__isBotFrameworkCardAction` requirement |
| Demos fail on the network | Offline scripted scenarios, no live connection needed |

---

## Auth: two paths, one honest recommendation

### Development — Direct Line secret

```
DirectLineSecret = <your secret>
```

Works immediately. The secret is exchanged for a short-lived token rather than handed to WebChat
directly, which limits what leaks — but **the secret is still in the app**. Anyone who can open it
can read it. Development only.

### Production — SSO

```
TokenEndpointUrl = <Copilot Studio > Settings > Advanced > Metadata>
ClientId         = <Entra app registration client id>
AgentId          = <Copilot Studio Entra agent id>
```

No secret in the app, and the agent knows who it is talking to.

### The part that is actually undocumented

When the agent needs the user's identity it sends an **OAuth card**, which by default renders a
"Sign in" button. A user already signed in to the host app is asked to sign in *again* — the exact
thing SSO was meant to prevent.

The fix is to intercept the card and complete the exchange yourself:

1. Watch `activity$` for attachments of type `application/vnd.microsoft.card.oauth`
2. Acquire a token for `api://botid-{agentId}/.default` — silently, falling back to a popup
3. `POST` a `signin/tokenExchange` invoke back to the conversation

The card resolves itself and the user sees nothing. Implementation in
[`auth.js`](AgentChatWidget/auth.js).

Silent acquisition is tried first; the popup is only reached when consent genuinely hasn't been
given. If the exchange fails, the card is left visible so the user can sign in manually rather than
hitting a dead end.

---

## Screen context

This is the reason to embed rather than link.

```
UserId      = User().Email
UserName    = User().FullName
RecordId    = ThisItem.ID
RecordTable = "your_table"
ContextJson = "{""shift"":""afternoon"",""site"":""north""}"
```

Sent to the agent when the conversation starts, so it opens already knowing who the user is and what
they're looking at. The user never has to describe their own screen.

---

## Demo mode

```
DemoMode     = true
DemoScenario = "incident"
```

Plays a scripted conversation with no network dependency. Five generic frontline scenarios ship with
it — start of shift, floor walk, incident coordination, returning from leave, and team check-in —
in [`demo.js`](AgentChatWidget/demo.js). Replace them with your own.

**On honesty:** a scripted mode is fine as long as it's labelled. The point of most demos is the
workflow, not proof that a model can form a sentence. Run the live agent for the parts where the
model's own behaviour is what you're demonstrating.

---

## Card buttons that do nothing

A common and baffling failure. WebChat's renderer branches on the shape of `data`:

```
typeof data === 'string'         -> imBack (sends the string as a message)
data.__isBotFrameworkCardAction  -> performCardAction(data.cardAction)
otherwise                        -> postBack (activity has a value but NO text)
```

The Teams `{ msteams: { type: "messageBack" } }` convention is a **Teams-client** thing. WebChat
doesn't read it, so those buttons fall into `postBack` and produce a **textless activity** — nothing
for a trigger phrase to match, and no visible user message. Hence "clicking does nothing".

Shape that works on both channels:

```js
data: {
  __isBotFrameworkCardAction: true,
  cardAction: { type: 'messageBack', text: 'Confirm incident report', displayText: 'Review and confirm' },
  msteams:    { type: 'messageBack', text: 'Confirm incident report', displayText: 'Review and confirm' }
}
```

`text` must equal a trigger phrase. `displayText` is what appears in the transcript.

---

## Contents

| Path | Purpose |
|---|---|
| `AgentChatWidget/ControlManifest.Input.xml` | Control manifest and properties |
| `AgentChatWidget/auth.js` | Both auth paths and the OAuth card interception |
| `AgentChatWidget/demo.js` | Offline scenario harness |
| `docs/setup.md` | Build, deploy and configure |

---

## Status

This is a **reference implementation of the auth and context patterns**, extracted from a working
build. The auth flow, token exchange and context passing are proven in a real deployment.

Not included: a packaged solution, or a full WebChat styling layer. The intent is that the patterns
here are the hard part, and the rest is standard PCF work.

The harness is being tracked against Copilot Studio's evolving embedding story — if the platform
ships a first-party control that does this properly, use it. Until then, this works.

---

## Licence

MIT — see [LICENSE](LICENSE).
