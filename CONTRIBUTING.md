# Contributing

The routing patterns here are drawn from repeated practice rather than published documentation. If
your experience contradicts them, that is the most valuable thing you can contribute.

## Especially useful

- **Routing counter-examples.** A case where `description` was *not* what determined routing, or
  where tuning it didn't help. Include the descriptions verbatim and the question that misrouted.
- **Regional or version differences.** Whether routing behaves the same across Copilot Studio
  regions and releases is untested.
- **Overlap behaviour with three or more descriptions.** Documented for two; unverified beyond that.
- **Additional upload failure modes.** If a skill zip is rejected for a reason the validator doesn't
  catch, tell us the symptom and the cause.
- **Corrections.** If something here is wrong, say so plainly. A confidently stated wrong pattern is
  worse than no pattern.

## Pull requests

1. One concern per PR.
2. Skills must pass `.\scripts\Build-SkillPackage.ps1 -ValidateOnly`.
3. Write files as **UTF-8 without BOM**.
4. Keep the verified / drawn-from-practice / unverified distinction in the README accurate. If you
   add a claim, say which category it belongs to.
5. No customer names, tenant identifiers, environment URLs or real schema. Run the pre-publish scan.

## On stating certainty

This repo deliberately separates what is mechanically verified from what is behavioural observation.
Please preserve that. An unverified claim presented as fact is worse than no claim, because the next
person builds on it and loses a day when it doesn't hold.

## Code of conduct

Be constructive and assume good faith.
