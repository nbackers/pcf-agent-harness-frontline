# Setup

Build, deploy and configure the control.

---

## Prerequisites
- Node.js 18+
- Power Platform CLI (`pac`)
- A Copilot Studio agent, published

```powershell
npm install -g pac
```

## Build

```powershell
pac pcf init --namespace AgentHarness --name AgentChatWidget --template field
npm install
npm run build
```

For a solution to import:

```powershell
pac solution init --publisher-name yourpublisher --publisher-prefix yourprefix
pac solution add-reference --path ..\AgentChatWidget
dotnet build
```

## Configure - development

Fastest path to something on screen. **Not for production.**

1. Copilot Studio → your agent → **Channels** → **Direct Line** → copy a secret.
2. Add the control to a screen and set `DirectLineSecret`.

The secret is readable by anyone who can open the app. Use it to prove the wiring, then move to SSO.

## Configure - SSO

### 1. App registration

Entra admin centre → **App registrations** → **New registration**.
- Redirect URI: **Single-page application**, set to your app's origin
- API permissions: delegated access to your Copilot Studio agent
- Note the **Application (client) ID**

### 2. Agent metadata

Copilot Studio → your agent → **Settings** → **Advanced** → **Metadata**. Copy:
- **Token endpoint URL**
- **Entra agent ID**

### 3. Authentication

Copilot Studio → **Settings** → **Security** → **Authentication** → **Authenticate with Microsoft**,
with your app registration.

### 4. Control properties

```
TokenEndpointUrl = <token endpoint URL>
ClientId         = <application (client) ID>
AgentId          = <Entra agent ID>
DirectLineSecret = (leave blank)
```

Leaving `DirectLineSecret` blank is what selects SSO mode.

## Pass screen context

```
UserId      = User().Email
UserName    = User().FullName
RecordId    = ThisItem.ID
RecordTable = "your_table_logical_name"
```

Extra context as JSON - note the doubled quotes in Power Fx:

```
ContextJson = "{""shift"":""afternoon"",""site"":""north""}"
```

## Demo mode

```
DemoMode     = true
DemoScenario = "daily"
```

Scenarios: `daily`, `walk`, `incident`, `away`, `team`. Edit `AgentChatWidget/demo.js` to add your
own - keep them short, and make each land on a decision rather than a status readout.

---

## Troubleshooting

**"Set the DirectLineSecret property"** - neither auth mode is configured. Set `DirectLineSecret`,
or all three SSO properties.

**Token endpoint returns 401/403** - the agent isn't published, or authentication isn't configured
in Copilot Studio.

**User is asked to sign in despite SSO** - the OAuth card interception isn't running. Check the
browser console for `Silent token exchange failed`. Usual causes: `AgentId` wrong, so the scope
`api://botid-{agentId}/.default` doesn't match; or admin consent not granted.

**Card buttons do nothing** - missing `__isBotFrameworkCardAction` on the button's `data`. See the
README.

**Agent doesn't know the user** - check the context properties are populated. `User()` returns empty
in some embedded contexts; test with a literal first.

**Nothing renders** - the WebChat CDN is likely blocked. Check `external-service-usage` in the
manifest lists every domain you call.

## Security notes
- Never ship a Direct Line secret in a production app.
- Tokens are cached in `sessionStorage` deliberately, so they don't outlive the tab.
- The token exchange posts the user's access token to the Direct Line conversation. That is the
  documented mechanism, but it does mean the agent receives a token scoped to itself - scope the app
  registration to exactly what the agent needs, and no more.
