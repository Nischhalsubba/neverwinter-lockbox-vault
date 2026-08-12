<div align="center">

# Neverwinter Lockbox Vault

**A Neverwinter lockbox reference and discovery project for organizing lockbox information, contents, rewards, and source-aware game data.**

![Top language](https://img.shields.io/github/languages/top/Nischhalsubba/neverwinter-lockbox-vault?style=flat-square)
![Last commit](https://img.shields.io/github/last-commit/Nischhalsubba/neverwinter-lockbox-vault?style=flat-square)
![Repo size](https://img.shields.io/github/repo-size/Nischhalsubba/neverwinter-lockbox-vault?style=flat-square)

[Browse source](https://github.com/Nischhalsubba/neverwinter-lockbox-vault/tree/main) · [Issues](https://github.com/Nischhalsubba/neverwinter-lockbox-vault/issues)

</div>

## Overview

**Neverwinter Lockbox Vault** is documented as a reference product. Players should be able to find a lockbox, inspect organized information, understand where the data came from, and distinguish verified facts from missing or version-sensitive details.

<details open>
<summary><strong>🏗️ Interactive reference architecture</strong></summary>

```mermaid
flowchart LR
    PLAYER["Player"] --> UI["Lockbox Vault UI"]
    DATA["Lockbox / reward data"] --> UI
    SOURCE["Sources / verification notes"] --> DATA
    UI --> SEARCH["Search / filter"]
    SEARCH --> LOCKBOX["Lockbox detail"]
    LOCKBOX --> REWARDS["Contents / rewards"]
    LOCKBOX --> PROVENANCE["Source / version context"]
```

</details>

## Player flow

```mermaid
flowchart TD
    NEED["Find lockbox information"] --> SEARCH["Search / browse"] --> OPEN["Open lockbox"] --> REVIEW["Review contents / rewards"] --> VERIFY["Check source / version context"] --> COMPARE["Compare or continue browsing"]
```

## Audience guide

| Audience | Focus |
|---|---|
| Players | Fast, understandable lockbox lookup |
| Developers | Data model, search/filtering and detail presentation |
| Designers | Dense catalog UX, comparison, empty states and mobile behavior |
| Maintainers | Provenance, verification dates and game-version changes |

## Getting started

```bash
git clone https://github.com/Nischhalsubba/neverwinter-lockbox-vault.git
cd neverwinter-lockbox-vault
```

Use the repository manifests/lockfiles to determine the current runtime and commands.

## Data quality

Do not invent reward tables, drop rates, probabilities, dates, or availability. Keep source confidence and version notes close to the data they qualify, especially when game updates may have changed a lockbox.

## SEO & discoverability

Use accurate terms such as **Neverwinter lockboxes, Neverwinter lockbox rewards, lockbox contents, Neverwinter items, lockbox guide, and Neverwinter reference** only where supported by the maintained dataset.

## Contribution flow

```mermaid
flowchart LR
    DATA["New / corrected lockbox data"] --> SOURCE["Verify source"] --> UPDATE["Update catalog"] --> CHECK["Check search/detail views"] --> DOCS["Record provenance"] --> PR["Pull request"]
```
