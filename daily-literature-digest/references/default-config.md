# Default Literature Digest Configuration

Use these defaults when the user asks for a starter daily literature digest.

## Schedule And Delivery

- Frequency: daily
- Time: `09:00`
- Timezone: ask the user; if unclear, use the user's local timezone.
- Recipient: ask the user.
- Email connector: Gmail when connected.
- Local archive:
  - `daily-literature-digests/YYYY-MM-DD.md`
  - `daily-literature-digests/YYYY-MM-DD.docx` only when requested
  - `daily-literature-digests/fulltext-inbox/to-download-YYYY-MM-DD.md`
  - `daily-literature-digests/fulltext-summaries/`
  - `daily-literature-digests/data/YYYY-MM-DDTHHMMSSZ.json`
  - `daily-literature-digests/state.json`

## Default Config Shape

```json
{
  "recipient_email": "user@example.com",
  "crossref_mailto": "user@example.com",
  "language": "zh-CN",
  "timezone": "Europe/London",
  "schedule_time": "09:00",
  "output_dir": "daily-literature-digests",
  "include_arxiv": true,
  "rows": 20,
  "arxiv_rows": 25,
  "max_papers": 30,
  "keyword_groups": [
    {
      "label": "AI for architectural design",
      "terms": [
        "AI in architecture",
        "artificial intelligence in architecture",
        "artificial intelligence architectural design",
        "machine learning architectural design",
        "deep learning architectural design",
        "LLM architectural design",
        "large language model architectural design",
        "generative AI architecture",
        "diffusion model architecture design",
        "generative design architecture",
        "computational design architecture",
        "graph neural network architecture design"
      ]
    },
    {
      "label": "AI for building energy and performance",
      "terms": [
        "artificial intelligence building energy",
        "machine learning building energy",
        "deep learning building energy",
        "reinforcement learning building energy",
        "graph neural network building energy",
        "large language model building energy",
        "AI building performance",
        "machine learning building performance",
        "deep learning building performance",
        "building energy prediction machine learning",
        "building energy prediction deep learning",
        "building energy consumption prediction",
        "building performance simulation machine learning",
        "surrogate model building performance",
        "Bayesian optimization building performance"
      ]
    },
    {
      "label": "AI for HVAC and building operation",
      "terms": [
        "AI HVAC control",
        "machine learning HVAC control",
        "deep learning HVAC control",
        "reinforcement learning HVAC",
        "deep reinforcement learning HVAC",
        "reinforcement learning building control",
        "multi-agent reinforcement learning building control",
        "occupant-centric HVAC control",
        "building operation machine learning",
        "building operation deep learning",
        "smart building control",
        "multi-zone building control",
        "digital twin building operation",
        "fault detection diagnosis HVAC machine learning"
      ]
    },
    {
      "label": "AI for LCA and sustainable buildings",
      "terms": [
        "machine learning building life cycle assessment",
        "deep learning building life cycle assessment",
        "AI building life cycle assessment",
        "building LCA machine learning",
        "building LCA deep learning",
        "life cycle assessment buildings artificial intelligence",
        "embodied carbon machine learning building",
        "embodied carbon prediction deep learning",
        "carbon emission prediction buildings machine learning",
        "sustainable building design machine learning",
        "low carbon building design AI",
        "surrogate assisted optimization sustainable building"
      ]
    },
    {
      "label": "AI for construction and digital delivery",
      "terms": [
        "artificial intelligence construction",
        "machine learning construction management",
        "large language model construction management",
        "deep learning construction safety",
        "reinforcement learning construction scheduling",
        "AI prefabricated construction",
        "machine learning modular construction",
        "BIM artificial intelligence",
        "BIM machine learning",
        "BIM deep learning",
        "BIM large language model",
        "computer vision construction",
        "NLP construction documents",
        "construction robotics AI"
      ]
    }
  ]
}
```

## Default Sources

If the user does not customize publishers, omit the `publishers` key and the script will use:

- Elsevier through Crossref member `78`; uses Crossref created-date because some records have future issue dates.
- Springer Nature through Crossref member `297`.
- Wiley through Crossref member `311`.
- Taylor & Francis / Routledge through Crossref member `301`.
- arXiv through `https://export.arxiv.org/api/query`.
- OpenAlex enrichment by DOI when available.

arXiv results must be labeled as preprints.

## Interpretation Rules

- Summarize from title, abstract, keywords, subjects, and metadata only.
- If the abstract is unavailable, include the paper as a title-only candidate when the title or query term matches the user's keywords.
- Clearly state that no abstract/full text was read for title-only candidates.
- Do not infer goal, method, or result without an abstract or explicit full text.
- Create a separate follow-up list for title-only candidates. The user logs in themselves; Codex can then process that explicit batch using the active session or local PDFs.
- Do not auto-login to school libraries or publisher websites.
