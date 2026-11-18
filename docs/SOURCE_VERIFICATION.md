# Lockbox and media source verification

This guide governs contributions to Neverwinter Lockbox Vault. A working catalog interface is not proof of reward accuracy. Treat each lockbox, reward, version and image association as a distinct claim.

## Source record

For every change, record:

1. Exact lockbox name and unique identifier, distinguishing reissues and similarly named boxes.
2. Source publisher and stable URL or an inspected in-game screenshot with capture date.
3. Relevant game version, platform and observed date, if available; never fabricate missing metadata.
4. The specific claim verified: title, reward association, availability, contents, probability or artwork identity.
5. Differences from the existing record and remaining uncertainty.
6. Images' attribution, permitted use and evidence that the subject matches the record.

**Do not** infer drop rates, guarantee tiers, complete item inventories or in-game availability from a promotional headline or anecdotal sample. A match from image search alone does not establish item identity.

## Practical review workflow

- Search \`app/data/\` for an existing or duplicate record.
- Read \`app/LOCKBOX_RESEARCH.md\` before introducing a competing claim.
- Change the smallest applicable dataset and media mapping.
- Test the search and detail path, including missing images and unknown fields.
- Confirm that provenance and uncertainty are visible where a player acts on the information.
- Verify keyboard navigation and phone-sized layouts when a card, search or detail view changes.
- For version-sensitive corrections, distinguish newly observed behavior from a historical claim.

## Automated checks

From the maintained \`app/\` directory:

~~~bash
npm ci
npm run check
~~~

The app check runs tests and the production build. For changes to the root build scripts or deployment integration, also run \`npm run check\` from the repository root. Record command results and failures in the PR. Tests verify software behavior; a human must still inspect external source evidence.

## Reviewer acceptance and rollback

A PR must identify the changed records, the primary source, verification date and version, exact factual claims, image rights, and QA outcome. Explicitly mark unsupported fields as unknown. If an incorrect reward or picture reaches production, revert the smallest record/mapping change and preserve notes about what evidence was insufficient.
