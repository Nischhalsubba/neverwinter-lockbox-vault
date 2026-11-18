# Lockbox data and media verification

The application under \`app/\` is a game-reference catalog. Data correctness must be judged independently from whether the interface renders. This playbook defines what reviewers need before promoting a new or corrected lockbox claim.

## What can be asserted

A lockbox name, availability period, reward association, image, guaranteed mechanic, and probability are **separate claims**. Evidence for one never proves the others. Record the relevant Neverwinter version, platform or observation date when available; leave fields unknown when the source does not establish them.

## Per-record evidence checklist

- Confirm the exact lockbox name, distinguishing it from similarly named or reissued boxes.
- Link the primary source or a directly inspected in-game screenshot; identify who published it and when it was observed.
- Match each reward/item to that specific lockbox and version, not merely to a generic catalog search result.
- Verify that an image depicts the named subject and that its usage is permitted; record attribution and the original source path.
- Separate a marketing headline reward from a complete obtainable-items list.
- Do **not** infer drop rates or guaranteed outcomes from a promotional image, anecdotal opening results or popularity.
- Mark disputed, incomplete or stale records visibly instead of silently inventing a value.
- When a game patch changes a record, retain enough old/new context for maintainers to review the transition.

## Review workflow

1. Search for existing records in \`app/data/\` to avoid creating near-duplicates.
2. Consult \`app/LOCKBOX_RESEARCH.md\` for existing research and limitations.
3. Modify the smallest affected dataset and any relevant media mapping.
4. Check search and detail views with and without an image, with narrow layouts and keyboard navigation.
5. Verify the displayed evidence label and version context match the record; a successful search is not evidence of reward accuracy.
6. Capture a before/after screenshot for visually meaningful changes and note the tested device/browser.

## Reproducible checks

The maintained workspace is \`app/\`; root scripts provide a separate entrypoint:

~~~bash
cd app
npm ci
npm run check
~~~

\`npm run check\` runs the app tests and production build. If editing root build/deployment integration, also run \`npm run check\` from repository root. Report any failing command and the relevant log excerpt; do not claim that passing tests prove the external facts are correct.

## Submission and rollback

Each PR should identify the changed records, original sources, verified versus unverified claims, game version/date, media rights considerations, build evidence, and user-visible behavior. When a claim cannot be verified, keep it explicitly unconfirmed. If a false association reaches production, revert the offending record or image mapping promptly and reopen research with the inaccurate claim documented.
