---
name: paper-vault
description: Create, update, or troubleshoot a local visual Paper Vault for saved research papers. Use when the user wants to import High or Medium papers from a daily literature digest, connect the vault with the daily-literature-digest skill, classify papers into no more than five broad research categories with drill-down subtopics, build a searchable card-style paper dashboard, add bilingual notes, attach local PDF paths, or share a reusable Paper Vault workflow across different research fields.
---

# Paper Vault

## Purpose

Use this skill to turn selected papers from `$daily-literature-digest` into a local static web vault. The daily digest finds and prioritizes papers; Paper Vault keeps the important ones visible, categorized, searchable, and revisitable.

The skill must generalize to any field. Never reuse the creator's example categories unless the user's keywords actually match them.

## Core Workflow

1. Locate the user's digest workspace:
   - Prefer `daily-literature-digest.config.json` in the current workspace.
   - Prefer digest JSON under `daily-literature-digests/data`.
   - Use a user-provided path if they name one.
2. Decide what to import:
   - "High papers" means `priority: High`.
   - "Medium and above" means `priority: High` and `priority: Medium`.
   - Do not import Low unless explicitly requested.
   - Default rule: only import papers after Codex has read an accessible full text, local PDF, or user-provided article text. Papers without accessible full text go to `sources/fulltext-inbox` first.
3. Initialize the vault if needed:
   ```powershell
   python paper-vault\scripts\paper_vault.py init --vault-dir paper-vault-site
   ```
4. Import selected papers:
   ```powershell
   python paper-vault\scripts\paper_vault.py import-high `
     --vault-dir paper-vault-site `
     --digest-data-dir daily-literature-digests\data `
     --config daily-literature-digest.config.json `
     --priority Medium `
     --max-areas 5 `
     --download-arxiv-pdfs
   ```
   This command defaults to `--require-fulltext`. It imports only papers with a local PDF or extracted full-text source file. Use `--no-require-fulltext` only when the user explicitly asks for temporary abstract/title cards.
5. Review the generated site:
   - Broad categories must be no more than 5.
   - Subtopics can be more specific and should sit under a broad category.
   - Paper cards should show title, tags, short summary first; objective, method, result, usefulness, and next step only after expanding details.
   - DOI/arXiv and journal links should be clickable.
   - Local PDFs should display as copyable local paths, not hidden browser downloads.
6. Run locally:
   ```powershell
   cd paper-vault-site
   python -m http.server 8766 --bind 127.0.0.1
   ```
   Open `http://127.0.0.1:8766/index.html`.

## Classification Rules

- Use the user's own keyword groups as the first signal.
- If keyword groups are too granular, merge them into broader research areas.
- Keep at most 5 broad `area` values. If more exist, merge smaller/rare areas into `Other Research`.
- Keep one `primarySubtopic` per paper for counted drill-down filters.
- Keep `subtopics` and `tags` as descriptive secondary labels; they may overlap.
- Primary subtopic counts should add up cleanly within the selected broad category.
- Deduplicate by DOI, arXiv id, source key, URL, then normalized title.

Examples of acceptable broad categories:

- For building research: `Building Energy`, `HVAC Control`, `Low-Carbon Construction`, `Optimization Methods`, `Occupant Comfort`.
- For biomedical research: `Clinical Evidence`, `Molecular Mechanisms`, `Imaging and Diagnostics`, `Therapeutics`, `Data Methods`.
- For social science: `Policy`, `Behavior`, `Institutions`, `Methods`, `Equity`.

These are examples only. Infer categories from the user's papers.

## AI Fields

For each card, maintain:

- `summary`: one skimmable paragraph.
- `objective`: the research problem or question.
- `method`: algorithms, models, data, experiments, or framework.
- `result`: findings explicitly supported by abstract/full text.
- `usefulness`: why this matters for the user's stated research interests.
- `nextAction`: what to read, extract, compare, or reproduce next.

## Full-Text Requirement

Before adding a paper as a normal Paper Vault card:

- Read the full PDF, article HTML, or user-provided full-text file.
- Base `objective`, `method`, `result`, `usefulness`, and `nextAction` on that full text.
- Set `readingStatus` honestly, e.g. `fulltext-read`, `article-page-read`, or `preview-read`.
- Attach `pdfPath` when a local PDF exists, or `fullTextPath`/`sourcePath` when article text was extracted.

If only title, metadata, or abstract is available:

- Do not import it as a normal card by default.
- Write it to `sources/fulltext-inbox/to-download-YYYY-MM-DD.md` with DOI/URL and why it is worth following up.
- Actively tell the user how many High/Medium papers need full text and ask whether they want to log in through the active browser now.
- If the user logs in, use only that explicit current browser session to open the paper pages, download/read the PDF or full article text, then summarize from the full text before importing.
- If the user does not want to log in now, keep the papers in `sources/fulltext-inbox` and do not show them as normal cards.
- Only create a temporary card if the user explicitly says to save it before full-text reading; set `readingStatus: needs-fulltext`, keep limitations visible, and do not infer method or results.

Paywalled access rules:

- Use an active user-logged-in browser session or PDFs the user manually downloads.
- Do not store passwords, cookies, HTML login pages, or institutional session traces.
- Do not create unattended publisher-login download automation.

## Bilingual Notes

The frontend supports bilingual display through `data/paper-bilingual.js`.

- If the user wants bilingual notes, add translations under `window.PAPER_VAULT_BILINGUAL`.
- Preserve UTF-8 encoding.
- Prefer `apply_patch` for manual edits containing Chinese. Do not pipe Chinese source text through PowerShell into Python/Node; Windows console encoding can turn Chinese into `????`.
- If using scripts to write Chinese, keep Chinese in UTF-8 files or JSON inputs, not inline PowerShell heredocs.
- After editing, validate generated HTML/JS/JSON for mojibake and replacement text. Search for `????`, `锟`, `鐮`, `浼`, `寤`, `璁`, `鎽`, `涓`, `娑`, `閻`, `閸`, and `瀵`.
- If mojibake already exists in a user's data file, repair it by mapping known labels/text back to valid UTF-8 or by adding a UTF-8 override file loaded after the damaged data.
## Vault Structure

Generated runtime files belong in the user's workspace, not inside the skill folder:

```text
paper-vault-site/
  index.html
  styles.css
  app.js
  data/
    papers.js
    vault-settings.js
    paper-bilingual.js
  notes/
  pdfs/
  sources/
```

Do not commit generated papers, PDFs, notes, source pages, cookies, or login traces unless the user explicitly wants to publish that vault.

## Script Reference

Use `scripts/paper_vault.py` for deterministic setup and import. Read or patch it only for custom behavior.

Common commands:

```powershell
python paper-vault\scripts\paper_vault.py init --vault-dir paper-vault-site
python paper-vault\scripts\paper_vault.py import-high --vault-dir paper-vault-site --digest-data-dir daily-literature-digests\data --priority High --max-areas 5
python paper-vault\scripts\paper_vault.py import-high --vault-dir paper-vault-site --digest-data-dir daily-literature-digests\data --priority Medium --max-areas 5
python paper-vault\scripts\paper_vault.py import-high --vault-dir paper-vault-site --digest-data-dir daily-literature-digests\data --priority Medium --min-impact-factor 5 --download-arxiv-pdfs
python paper-vault\scripts\paper_vault.py import-high --vault-dir paper-vault-site --digest-data-dir daily-literature-digests\data --priority Medium --no-require-fulltext
```

`--priority Medium` imports Medium and High. `--priority Low` imports all priority levels.

`--min-impact-factor 5` skips numeric peer-reviewed journal IF values below 5 while keeping arXiv/preprints by default. Add `--no-keep-preprints` only if the user wants to exclude preprints too.

`--require-fulltext` is the default. It skips papers that do not already have a local PDF or extracted full-text source and writes them to `sources/fulltext-inbox`. `--no-require-fulltext` is only for explicit temporary abstract/title cards.

## Safety

- Do not store passwords, cookies, or login state in the vault.
- Do not run unattended publisher login/download workflows.
- For paywalled papers, use explicit user-provided PDFs or an active user-logged-in browser session for that batch only.
- Keep institutional-access artifacts out of the shareable skill repository.
