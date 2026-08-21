# Contributing

This is sample code. Contributions that make it a better reference are welcome.

## Especially useful

- **Live agent results.** The auth flow and token exchange are not verified end to end in this repo.
  If you connect it to a real agent, say whether the silent token exchange worked and what you had
  to change.
- **Platform changes.** If Copilot Studio or WebChat changes the OAuth card flow, or ships a
  first-party embedding control, that is worth knowing.
- **Additional failure modes.** Card buttons doing nothing, tokens failing silently, embedding
  problems in specific hosts.
- **Corrections.** If something here is wrong, say so plainly.

## Pull requests

1. One concern per PR.
2. `npm run lint`, `npm test` and `npm run build` must all pass. CI runs them.
3. Do not add a manifest resource without adding the file. CI checks this, because a manifest
   pointing at a missing file builds from a warm cache locally and fails for anyone cloning fresh.
4. Never commit a Direct Line secret, client ID, tenant ID, token or environment URL. Use
   placeholders.
5. Keep the verified/unverified distinction in the README accurate. If you add a claim, say how it
   was established.

## Security

Never open a public issue containing a secret, token or tenant identifier. If you find a security
problem in this sample, raise it privately through GitHub's security advisory feature.

## Code of conduct

Be constructive and assume good faith.
