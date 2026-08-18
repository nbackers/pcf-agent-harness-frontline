/**
 * Authentication for an embedded Copilot Studio agent.
 *
 * Two modes:
 *
 *   Development - a Direct Line secret is exchanged for a token in the browser.
 *                 Simple, and unsuitable for anything real: the secret is readable
 *                 by anyone who can open the app.
 *
 *   SSO         - the Copilot Studio token endpoint issues the Direct Line token, and
 *                 the signed-in user's identity is passed to the agent through an
 *                 OAuth card exchange. The agent knows who it is talking to.
 *
 * The SSO path is the part that is poorly documented, and the token exchange in
 * exchangeOAuthToken() below is the specific piece most samples omit.
 */

const WEBCHAT_CDN = 'https://cdn.botframework.com/botframework-webchat/latest/webchat.js';
const MSAL_CDN = 'https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js';
const DIRECTLINE_HOST = 'https://directline.botframework.com';

/**
 * Load a script once, resolving when it is ready.
 *
 * @param {string} src
 * @returns {Promise<void>}
 */
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

/**
 * Development connection from a Direct Line secret.
 *
 * The secret is exchanged for a short-lived token rather than being handed to WebChat
 * directly, which at least limits what leaks if the page is inspected. It does not make
 * the secret safe - it is still present in the app.
 *
 * @param {string} secret
 * @returns {Promise<object>} A DirectLine connection.
 */
export async function connectWithSecret(secret) {
  const response = await fetch(`${DIRECTLINE_HOST}/v3/directline/tokens/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Direct Line token exchange failed: ${response.status}`);
  }

  const { token } = await response.json();

  await loadScript(WEBCHAT_CDN);
  return window.WebChat.createDirectLine({ token });
}

/**
 * SSO connection.
 *
 * The token endpoint is published by Copilot Studio under
 * Settings > Advanced > Metadata. It returns both a Direct Line token and a
 * conversation id; the conversation id is required to post the token exchange back.
 *
 * @param {object} options
 * @param {string} options.tokenEndpointUrl
 * @param {string} options.clientId  Entra app registration client id.
 * @param {string} options.agentId   Copilot Studio Entra agent id.
 * @returns {Promise<{ connection: object, cleanup: () => void }>}
 */
export async function connectWithSso({ tokenEndpointUrl, clientId, agentId }) {
  if (!tokenEndpointUrl) throw new Error('TokenEndpointUrl is required for SSO mode');
  if (!clientId) throw new Error('ClientId is required for SSO mode');
  if (!agentId) throw new Error('AgentId is required for SSO mode');

  await Promise.all([loadScript(MSAL_CDN), loadScript(WEBCHAT_CDN)]);

  const msalInstance = new window.msal.PublicClientApplication({
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin,
    },
    // sessionStorage rather than localStorage: the token should not outlive the tab.
    cache: { cacheLocation: 'sessionStorage' },
  });

  await msalInstance.initialize();

  const response = await fetch(tokenEndpointUrl);
  if (!response.ok) {
    throw new Error(`Token endpoint failed: ${response.status}`);
  }

  const { token, conversationId } = await response.json();
  const connection = window.WebChat.createDirectLine({ token });

  const cleanup = interceptOAuthCards({
    connection,
    conversationId,
    directLineToken: token,
    msalInstance,
    agentId,
  });

  return { connection, cleanup };
}

/**
 * Watch for OAuth cards and complete the exchange silently.
 *
 * This is the piece that makes SSO feel like SSO.
 *
 * When the agent needs the user's identity it sends an OAuth card, which by default
 * renders a "Sign in" button - so a user who is already signed in to the host app is
 * asked to sign in again. That is the behaviour people are trying to avoid when they
 * ask for SSO.
 *
 * Instead: intercept the card, acquire a token for the agent's scope, and post a
 * signin/tokenExchange invoke back into the conversation. The card resolves itself and
 * the user sees nothing.
 *
 * Silent acquisition is attempted first and falls back to a popup, which is only
 * reached when consent has genuinely not been given.
 *
 * @returns {() => void} Unsubscribe function.
 */
function interceptOAuthCards({ connection, conversationId, directLineToken, msalInstance, agentId }) {
  const scope = `api://botid-${agentId}/.default`;

  const subscription = connection.activity$.subscribe({
    next: async (activity) => {
      if (activity.type !== 'message' || !activity.attachments) return;

      for (const attachment of activity.attachments) {
        if (attachment.contentType !== 'application/vnd.microsoft.card.oauth') continue;

        const connectionName = attachment.content?.connectionName;
        if (!connectionName) continue;

        try {
          const account = msalInstance.getAllAccounts()[0];

          let result;
          try {
            result = await msalInstance.acquireTokenSilent({ scopes: [scope], account });
          } catch {
            // Only reached when consent has not been given.
            result = await msalInstance.acquireTokenPopup({ scopes: [scope] });
          }

          await fetch(
            `${DIRECTLINE_HOST}/v3/directline/conversations/${conversationId}/activities`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${directLineToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'invoke',
                name: 'signin/tokenExchange',
                value: {
                  id: activity.id,
                  connectionName,
                  token: result.accessToken,
                },
                from: { id: 'user' },
              }),
            }
          );
        } catch (error) {
          // Leave the card visible so the user can sign in manually rather than
          // presenting a dead end.
          console.warn('Silent token exchange failed, falling back to the card.', error);
        }
      }
    },
  });

  return () => subscription.unsubscribe();
}

/**
 * Build the screen context sent to the agent when the conversation starts.
 *
 * This is the reason to embed an agent rather than link to one. The agent starts
 * knowing who the user is and what they are looking at, so the user does not have to
 * describe their own screen.
 *
 * @param {object} props
 * @returns {object}
 */
export function buildScreenContext(props) {
  const context = {
    userId: props.userId || null,
    userName: props.userName || null,
    recordId: props.recordId || null,
    recordTable: props.recordTable || null,
  };

  if (props.contextJson) {
    try {
      Object.assign(context, JSON.parse(props.contextJson));
    } catch {
      console.warn('ContextJson is not valid JSON and was ignored.');
    }
  }

  // Drop empties so the agent is not handed a payload of nulls.
  return Object.fromEntries(Object.entries(context).filter(([, v]) => v !== null && v !== ''));
}
