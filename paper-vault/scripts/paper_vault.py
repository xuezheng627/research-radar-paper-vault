#!/usr/bin/env python3
"""Create and update a local static Paper Vault from literature digest data."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import textwrap
import time
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / "assets" / "frontend-template"
PRIORITY_ORDER = {"High": 3, "Medium": 2, "Low": 1}
KNOWN_JOURNALS = {
    "Energy and Buildings": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/energy-and-buildings",
        "impactFactor": "7.1",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Energy Conversion and Management: X": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/energy-conversion-and-management-x",
        "impactFactor": "7.6",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Environmental Progress & Sustainable Energy": {
        "journalSourceName": "Wiley / AIChE",
        "journalSourceUrl": "https://aiche.onlinelibrary.wiley.com/journal/19447450",
        "impactFactor": "2.3",
        "impactYear": "JIF 2024",
        "impactSource": "Public JCR summary",
    },
    "Reliability Engineering & System Safety": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/reliability-engineering-and-system-safety",
        "impactFactor": "11.0",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Applied Thermal Engineering": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/applied-thermal-engineering",
        "impactFactor": "6.9",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Applied Surface Science": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/applied-surface-science",
        "impactFactor": "6.9",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Journal of Energy Storage": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/journal-of-energy-storage",
        "impactFactor": "9.8",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Biomass and Bioenergy": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/biomass-and-bioenergy",
        "impactFactor": "5.8",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Cognitive Computation": {
        "journalSourceName": "Springer Nature",
        "journalSourceUrl": "https://link.springer.com/journal/12559",
        "impactFactor": "4.3",
        "impactYear": "JIF 2024",
        "impactSource": "Springer Nature",
    },
    "Fuzzy Sets and Systems": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/fuzzy-sets-and-systems",
        "impactFactor": "2.7",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Communications in Nonlinear Science and Numerical Simulation": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/communications-in-nonlinear-science-and-numerical-simulation",
        "impactFactor": "3.8",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Atmospheric Pollution Research": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/atmospheric-pollution-research",
        "impactFactor": "3.5",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "iScience": {
        "journalSourceName": "ScienceDirect",
        "journalSourceUrl": "https://www.sciencedirect.com/journal/iscience",
        "impactFactor": "4.1",
        "impactYear": "JIF 2024",
        "impactSource": "ScienceDirect",
    },
    "Carbon Balance and Management": {
        "journalSourceName": "Springer Nature",
        "journalSourceUrl": "https://link.springer.com/journal/13021",
        "impactFactor": "5.8",
        "impactYear": "JIF 2024",
        "impactSource": "Springer Nature",
    },
    "arXiv preprint": {
        "journalSourceName": "arXiv",
        "journalSourceUrl": "https://arxiv.org/",
        "impactFactor": "N/A",
        "impactYear": "preprint",
        "impactSource": "No journal impact factor",
    },
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def slugify(value: str, fallback: str = "paper") -> str:
    value = value.lower()
    value = re.sub(r"https?://", "", value)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value[:90] or fallback


def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title or "").strip().lower()


def split_authors(authors: Any) -> list[str]:
    if isinstance(authors, list):
        return [str(a).strip() for a in authors if str(a).strip()]
    if isinstance(authors, str):
        parts = re.split(r";|, and | and ", authors)
        return [p.strip() for p in parts if p.strip()]
    return []


def first_sentences(text: str, limit: int = 2) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        return ""
    pieces = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(pieces[:limit]).strip()


def pick_sentences(text: str, keywords: list[str], fallback: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        return fallback
    pieces = re.split(r"(?<=[.!?])\s+", text)
    selected = [
        sentence
        for sentence in pieces
        if any(keyword.lower() in sentence.lower() for keyword in keywords)
    ]
    if selected:
        return " ".join(selected[:2]).strip()
    return fallback


def load_keyword_groups(config_path: Path | None) -> list[dict[str, Any]]:
    if not config_path or not config_path.exists():
        return []
    data = read_json(config_path)
    groups = data.get("keyword_groups", [])
    if not isinstance(groups, list):
        return []
    cleaned = []
    for group in groups:
        if not isinstance(group, dict):
            continue
        label = str(group.get("label", "")).strip()
        terms = [str(term).strip() for term in group.get("terms", []) if str(term).strip()]
        if label or terms:
            cleaned.append({"label": label or terms[0], "terms": terms})
    return cleaned


def text_blob(paper: dict[str, Any]) -> str:
    values = [
        paper.get("title", ""),
        paper.get("abstract", ""),
        paper.get("journal", ""),
        paper.get("publisher", ""),
        " ".join(paper.get("subjects", []) or []),
        " ".join(paper.get("keyword_hits", []) or []),
    ]
    return " ".join(str(v) for v in values).lower()


def matching_keyword_groups(paper: dict[str, Any], groups: list[dict[str, Any]]) -> list[str]:
    blob = text_blob(paper)
    hits = set(str(hit).lower() for hit in (paper.get("keyword_hits") or []))
    matched = []
    for group in groups:
        terms = [str(term).lower() for term in group.get("terms", [])]
        label = str(group.get("label", "")).strip()
        if any(term in blob or term in hits for term in terms):
            matched.append(label)
    return matched


def infer_area_and_subtopics(paper: dict[str, Any], groups: list[dict[str, Any]]) -> tuple[str, list[str]]:
    matched_groups = matching_keyword_groups(paper, groups)
    keyword_hits = [str(hit).strip() for hit in (paper.get("keyword_hits") or []) if str(hit).strip()]
    subjects = [str(subject).strip() for subject in (paper.get("subjects") or []) if str(subject).strip()]
    blob = text_blob(paper)

    if matched_groups:
        area = matched_groups[0]
        subtopics = list(dict.fromkeys(keyword_hits + matched_groups[1:] + subjects[:2]))
        return area, subtopics[:4] or [area]

    domain_rules = [
        ("AI / Machine Learning", ["reinforcement learning", "machine learning", "deep learning", "neural", "agent", "llm"]),
        ("Energy and Built Environment", ["building", "hvac", "thermal", "energy", "insulation", "comfort"]),
        ("Sustainability and Climate", ["carbon", "climate", "sustainab", "emission", "pollution"]),
        ("Engineering and Optimization", ["optimization", "control", "design", "scheduling", "manufacturing"]),
        ("Health and Biomedical", ["health", "clinical", "biomedical", "disease", "patient", "cell"]),
        ("Social Systems", ["social", "policy", "education", "team", "organization"]),
    ]
    for area, terms in domain_rules:
        if any(term in blob for term in terms):
            subtopics = list(dict.fromkeys(keyword_hits + subjects[:3]))
            return area, subtopics[:4] or [area]
    return "General Research", list(dict.fromkeys(keyword_hits + subjects[:3]))[:4] or ["General"]


def enforce_area_limit(cards: list[dict[str, Any]], max_areas: int) -> list[dict[str, Any]]:
    """Keep broad research areas readable by merging smaller areas if needed."""
    if max_areas <= 0:
        return cards
    counts: dict[str, int] = {}
    for card in cards:
        area = str(card.get("area") or "General Research")
        counts[area] = counts.get(area, 0) + 1
    if len(counts) <= max_areas:
        return cards

    keep_count = max(1, max_areas - 1)
    kept = {
        area
        for area, _count in sorted(
            counts.items(),
            key=lambda item: (-item[1], item[0].lower()),
        )[:keep_count]
    }
    fallback_area = "Other Research"
    for card in cards:
        area = str(card.get("area") or "General Research")
        if area in kept:
            continue
        original_area = area
        card["area"] = fallback_area
        subtopics = [str(item) for item in (card.get("subtopics") or []) if str(item).strip()]
        card["subtopics"] = list(dict.fromkeys([original_area] + subtopics))[:4]
        card["primarySubtopic"] = original_area
        card["categories"] = list(dict.fromkeys([fallback_area] + card["subtopics"]))
    return cards


def make_paper_id(paper: dict[str, Any]) -> str:
    for key in ("state_key", "doi", "arxiv_id", "url", "title"):
        value = str(paper.get(key, "") or "").strip()
        if value:
            return slugify(value)
    return f"paper-{int(time.time())}"


def paper_key(paper: dict[str, Any]) -> str:
    for key in ("doi", "arxiv_id", "state_key", "url"):
        value = str(paper.get(key, "") or "").strip().lower()
        if value:
            return f"{key}:{value}"
    return f"title:{normalize_title(paper.get('title', ''))}"


def existing_papers(vault_dir: Path) -> list[dict[str, Any]]:
    data_path = vault_dir / "data" / "papers.js"
    if not data_path.exists():
        return []
    text = data_path.read_text(encoding="utf-8")
    match = re.search(r"window\.PAPER_VAULT_DATA\s*=\s*(\[.*\]);?\s*$", text, re.S)
    if not match:
        raise SystemExit(f"Could not parse {data_path}")
    body = match.group(1)
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        # Older hand-written vaults may use a JavaScript object literal with
        # unquoted keys. Normalize the simple object syntax so users can still
        # upgrade those vaults with this script.
        body = re.sub(r"([\{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', body)
        body = re.sub(r",\s*([}\]])", r"\1", body)
        return json.loads(body)


def save_papers(vault_dir: Path, papers: list[dict[str, Any]]) -> None:
    papers = sorted(
        papers,
        key=lambda item: (
            str(item.get("area", "")),
            -(PRIORITY_ORDER.get(str(item.get("priority", "")), 0)),
            str(item.get("title", "")),
        ),
    )
    payload = json.dumps(papers, ensure_ascii=False, indent=2)
    write_text(vault_dir / "data" / "papers.js", f"window.PAPER_VAULT_DATA = {payload};\n")


def save_bilingual_stub(vault_dir: Path) -> None:
    target = vault_dir / "data" / "paper-bilingual.js"
    if not target.exists():
        write_text(target, "window.PAPER_VAULT_BILINGUAL = { generic: {}, papers: {} };\n")


def save_vault_settings(vault_dir: Path, min_impact_factor: float, keep_preprints: bool) -> None:
    settings_path = vault_dir / "data" / "vault-settings.js"
    lines = [
        f"window.PAPER_VAULT_MIN_IMPACT_FACTOR = {json.dumps(min_impact_factor)};",
        f"window.PAPER_VAULT_KEEP_PREPRINTS = {json.dumps(keep_preprints)};",
        "window.PAPER_VAULT_ROOT = window.PAPER_VAULT_ROOT || '';",
    ]
    write_text(settings_path, "\n".join(lines) + "\n")
    index_path = vault_dir / "index.html"
    if index_path.exists():
        html = index_path.read_text(encoding="utf-8")
        marker = '<script src="./data/papers.js"></script>'
        settings_script = '<script src="./data/vault-settings.js"></script>'
        if settings_script not in html and marker in html:
            html = html.replace(marker, f"{settings_script}\n    {marker}")
            write_text(index_path, html)


def numeric_impact_factor(card: dict[str, Any]) -> float | None:
    try:
        return float(str(card.get("impactFactor", "")).strip())
    except ValueError:
        return None


def passes_impact_threshold(card: dict[str, Any], min_impact_factor: float, keep_preprints: bool) -> bool:
    if min_impact_factor <= 0:
        return True
    impact = numeric_impact_factor(card)
    if impact is None:
        return keep_preprints and card.get("impactFactor") == "N/A"
    return impact >= min_impact_factor


def ensure_vault(vault_dir: Path) -> None:
    if (vault_dir / "SKILL.md").exists():
        raise SystemExit(
            f"{vault_dir} looks like a skill folder. Choose a runtime vault directory such as paper-vault-site."
        )
    vault_dir.mkdir(parents=True, exist_ok=True)
    for item in TEMPLATE_DIR.iterdir():
        target = vault_dir / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        elif not target.exists():
            shutil.copy2(item, target)
    for name in ("data", "notes", "pdfs", "sources"):
        (vault_dir / name).mkdir(parents=True, exist_ok=True)
    data_path = vault_dir / "data" / "papers.js"
    if not data_path.exists():
        save_papers(vault_dir, [])
    fulltext_inbox_path = vault_dir / "data" / "fulltext-inbox.js"
    if not fulltext_inbox_path.exists():
        save_fulltext_inbox_data(vault_dir, [])
    save_bilingual_stub(vault_dir)
    save_vault_settings(vault_dir, 0.0, True)


def load_digest_papers(data_dir: Path) -> list[dict[str, Any]]:
    papers: list[dict[str, Any]] = []
    for path in sorted(data_dir.glob("*.json")):
        try:
            data = read_json(path)
        except Exception as exc:
            print(f"Warning: skipped {path}: {exc}", file=sys.stderr)
            continue
        for paper in data.get("papers", []) if isinstance(data, dict) else []:
            if isinstance(paper, dict):
                paper = dict(paper)
                paper["_digest_file"] = path.name
                papers.append(paper)
    return papers


def priority_included(priority: str, minimum: str) -> bool:
    return PRIORITY_ORDER.get(priority, 0) >= PRIORITY_ORDER.get(minimum, 3)


def paper_year(paper: dict[str, Any]) -> str:
    published = str(paper.get("published_date", "") or "")
    match = re.search(r"\d{4}", published)
    return match.group(0) if match else ""


def paper_url(paper: dict[str, Any]) -> str:
    doi = str(paper.get("doi", "") or "").strip()
    if doi:
        return f"https://doi.org/{doi}"
    return str(paper.get("url", "") or paper.get("openalex_url", "") or "").strip()


def source_markdown(paper: dict[str, Any]) -> str:
    abstract = str(paper.get("abstract", "") or "").strip() or "No abstract available."
    return textwrap.dedent(
        f"""\
        # Source Note

        **Title:** {paper.get("title", "")}

        **Source:** {paper.get("publisher", "") or paper.get("source", "")} / {paper.get("journal", "")}

        **DOI/URL:** {paper_url(paper)}

        **Basis:** Open digest metadata and abstract. This is not a full-text copy.

        ## Abstract

        {abstract}
        """
    )


def note_markdown(card: dict[str, Any]) -> str:
    authors = "; ".join(card.get("authors", []))
    return textwrap.dedent(
        f"""\
        # {card.get("title", "Untitled paper")}

        **Priority:** {card.get("priority", "")}
        **Area:** {card.get("area", "")}
        **Subtopics:** {", ".join(card.get("subtopics", []))}
        **Source:** {card.get("journal", "")} / {card.get("publisher", "")}
        **Authors:** {authors}
        **DOI/URL:** {card.get("doiUrl", "")}

        ## Short Summary

        {card.get("summary", "")}

        ## Objective

        {card.get("objective", "")}

        ## Method

        {card.get("method", "")}

        ## Result

        {card.get("result", "")}

        ## Why It Matters

        {card.get("usefulness", "")}

        ## Next Action

        {card.get("nextAction", "")}

        ## Limitations

        {card.get("limitations", "")}
        """
    )


def build_card(paper: dict[str, Any], groups: list[dict[str, Any]], language: str) -> dict[str, Any]:
    title = str(paper.get("title", "") or "Untitled paper").strip()
    abstract = str(paper.get("abstract", "") or "").strip()
    area, subtopics = infer_area_and_subtopics(paper, groups)
    paper_id = make_paper_id(paper)
    source = str(paper.get("publisher", "") or paper.get("source", "") or "").strip()
    journal = str(paper.get("journal", "") or paper.get("source", "") or "Unknown source").strip()
    journal_info = KNOWN_JOURNALS.get(
        journal,
        {
            "journalSourceName": source or "Journal homepage",
            "journalSourceUrl": "",
            "impactFactor": "TBC",
            "impactYear": "",
            "impactSource": "Verify from journal homepage or JCR before relying on this metric.",
        },
    )
    tags = list(dict.fromkeys((paper.get("keyword_hits") or []) + (paper.get("subjects") or []) + subtopics))
    tags = [str(tag).strip() for tag in tags if str(tag).strip()][:8]

    if abstract:
        summary = first_sentences(abstract, 2)
        objective = pick_sentences(
            abstract,
            ["problem", "aim", "goal", "objective", "address", "investigate", "study", "research"],
            summary,
        )
        method = pick_sentences(
            abstract,
            ["propose", "develop", "use", "using", "model", "algorithm", "framework", "experiment", "data", "analysis"],
            "Method details are not explicit in the available abstract.",
        )
        result = pick_sentences(
            abstract,
            ["result", "show", "find", "outperform", "improve", "reduce", "increase", "achieve", "demonstrate"],
            "Main results are not explicit in the available abstract.",
        )
        limitations = "Generated from open digest metadata and abstract; review the full text before citing detailed claims."
    else:
        summary = "No abstract was available in the digest. This card is based only on title and metadata."
        objective = "No abstract/full text was available; do not infer the research objective beyond the title."
        method = "No abstract/full text was available; method is not available."
        result = "No abstract/full text was available; result is not available."
        limitations = "Title-level candidate only. Add a PDF or accessible full text before writing detailed notes."

    if not language.lower().startswith("zh"):
        usefulness = f"Relevant to the user's {area} theme; review against the current research question before deep reading."
        next_action = "Open the source note or PDF. If it is central to the project, ask Codex to expand this card from the full text."

    if language.lower().startswith("zh"):
        usefulness = f"与用户的 {area} 主题相关；建议结合当前研究问题判断是否需要阅读全文。"
        next_action = "先补充 PDF 或可访问全文；如果和当前研究问题直接相关，再让 Codex 基于全文补充方法、数据、结果和局限。"

    return {
        "id": paper_id,
        "sourceKey": paper_key(paper),
        "title": title,
        "authors": split_authors(paper.get("authors")),
        "year": paper_year(paper),
        "added": date.today().isoformat(),
        "publisher": source,
        "journal": journal,
        **journal_info,
        "doi": str(paper.get("doi", "") or "").strip(),
        "doiUrl": paper_url(paper),
        "priority": str(paper.get("priority", "") or "Saved").strip(),
        "readingStatus": "saved",
        "area": area,
        "subtopics": subtopics,
        "tags": tags,
        "categories": list(dict.fromkeys([area] + subtopics)),
        "summary": summary,
        "objective": objective,
        "method": method,
        "result": result,
        "usefulness": usefulness,
        "nextAction": next_action,
        "limitations": limitations,
        "notePath": f"./notes/{paper_id}.md",
        "sourcePath": f"./sources/{paper_id}-abstract.md",
        "sourceType": "abstract" if abstract else "metadata",
        "pdfPath": "",
        "pdfUrl": str(paper.get("pdf_url", "") or paper.get("open_access_url", "") or "").strip(),
    }


def download_pdf(url: str, target: Path) -> bool:
    if not url or target.exists():
        return target.exists()
    request = urllib.request.Request(url, headers={"User-Agent": "paper-vault-skill/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read()
        if not content.startswith(b"%PDF-"):
            return False
        target.write_bytes(content)
        return True
    except Exception as exc:
        print(f"Warning: PDF download failed for {url}: {exc}", file=sys.stderr)
        return False


def path_if_exists(vault_dir: Path, value: str) -> Path | None:
    if not value:
        return None
    raw = Path(value.replace("./", ""))
    candidates = [raw]
    if not raw.is_absolute():
        candidates.append(vault_dir / raw)
    for candidate in candidates:
        if candidate.exists() and candidate.is_file() and candidate.stat().st_size > 0:
            return candidate
    return None


def relative_vault_path(vault_dir: Path, path: Path) -> str:
    try:
        return "./" + path.resolve().relative_to(vault_dir.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def existing_fulltext(vault_dir: Path, paper: dict[str, Any], card: dict[str, Any]) -> tuple[str, str]:
    for key in ("pdfPath", "pdf_path", "local_pdf_path"):
        found = path_if_exists(vault_dir, str(paper.get(key, "") or card.get(key, "")))
        if found and found.suffix.lower() == ".pdf":
            return "fulltext-pdf", relative_vault_path(vault_dir, found)

    pdf_candidate = vault_dir / "pdfs" / f"{card['id']}.pdf"
    if pdf_candidate.exists() and pdf_candidate.stat().st_size > 0:
        return "fulltext-pdf", relative_vault_path(vault_dir, pdf_candidate)

    for key in ("fullTextPath", "full_text_path", "sourcePath", "source_path"):
        found = path_if_exists(vault_dir, str(paper.get(key, "") or card.get(key, "")))
        if found and "abstract" not in found.name.lower() and "metadata" not in found.name.lower():
            return "fulltext-source", relative_vault_path(vault_dir, found)

    for suffix in ("-fulltext.txt", "-article.txt", "-fulltext.md", "-article.md"):
        source_candidate = vault_dir / "sources" / f"{card['id']}{suffix}"
        if source_candidate.exists() and source_candidate.stat().st_size > 0:
            return "fulltext-source", relative_vault_path(vault_dir, source_candidate)

    return "", ""


def fulltext_inbox_markdown(items: list[dict[str, str]]) -> str:
    lines = [
        f"# Papers Needing Full Text - {date.today().isoformat()}",
        "",
        "These papers matched the requested priority threshold but were not imported because Paper Vault requires full text by default.",
        "Action needed: tell the user how many papers need full text and ask whether they want to log in through the active browser now.",
        "If the user logs in, use only that explicit current browser session to download/read the PDF or full article text, then rerun the import.",
        "If the user does not log in now, keep these papers in this inbox instead of showing them as normal Paper Vault cards.",
        "",
    ]
    for item in items:
        lines.extend(
            [
                f"- {item['title']}",
                f"  - Priority: {item['priority']}",
                f"  - Source: {item['source']}",
                f"  - DOI/URL: {item['url']}",
                f"  - Reason: {item['reason']}",
            ]
        )
    return "\n".join(lines) + "\n"


def write_fulltext_inbox(vault_dir: Path, items: list[dict[str, str]]) -> None:
    save_fulltext_inbox_data(vault_dir, items)
    if not items:
        return
    target = vault_dir / "sources" / "fulltext-inbox" / f"to-download-{date.today().isoformat()}.md"
    write_text(target, fulltext_inbox_markdown(items))


def save_fulltext_inbox_data(vault_dir: Path, items: list[dict[str, str]]) -> None:
    path = vault_dir / "data" / "fulltext-inbox.js"
    text = "window.PAPER_VAULT_FULLTEXT_INBOX = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n"
    write_text(path, text)


def contains_mojibake(text: str) -> bool:
    markers = ["????", "锟", "鐮", "浼", "寤", "璁", "鎽", "涓", "娑", "閻", "閸", "瀵"]
    return any(marker in text for marker in markers)


def validate_utf8_outputs(vault_dir: Path) -> None:
    paths = [
        vault_dir / "index.html",
        vault_dir / "app.js",
        vault_dir / "data" / "papers.js",
        vault_dir / "data" / "paper-bilingual.js",
    ]
    bad = [str(path) for path in paths if path.exists() and contains_mojibake(path.read_text(encoding="utf-8", errors="replace"))]
    if bad:
        raise RuntimeError("Possible mojibake detected in generated Paper Vault files: " + ", ".join(bad))


def import_high(args: argparse.Namespace) -> None:
    vault_dir = Path(args.vault_dir).resolve()
    digest_data_dir = Path(args.digest_data_dir).resolve()
    ensure_vault(vault_dir)
    groups = load_keyword_groups(Path(args.config).resolve() if args.config else None)
    current = existing_papers(vault_dir)
    seen = {str(paper.get("sourceKey", "")) for paper in current}
    seen.update(paper_key(paper) for paper in current)
    seen_titles = {normalize_title(str(paper.get("title", "") or "")) for paper in current}

    imported = 0
    skipped = 0
    needs_fulltext: list[dict[str, str]] = []
    for paper in load_digest_papers(digest_data_dir):
        priority = str(paper.get("priority", "") or "").strip()
        if not priority_included(priority, args.priority):
            continue
        key = paper_key(paper)
        title_key = normalize_title(str(paper.get("title", "") or ""))
        if key in seen or title_key in seen_titles:
            skipped += 1
            continue
        card = build_card(paper, groups, args.language)
        if not passes_impact_threshold(card, args.min_impact_factor, args.keep_preprints):
            skipped += 1
            continue

        if args.download_arxiv_pdfs and card.get("pdfUrl") and "arxiv.org" in card["pdfUrl"]:
            pdf_path = vault_dir / "pdfs" / f"{card['id']}.pdf"
            if download_pdf(card["pdfUrl"], pdf_path):
                card["pdfPath"] = f"./pdfs/{pdf_path.name}"

        fulltext_type, fulltext_path = existing_fulltext(vault_dir, paper, card)
        if args.require_fulltext and not fulltext_path:
            needs_fulltext.append(
                {
                    "title": card["title"],
                    "priority": card["priority"],
                    "source": f"{card.get('journal', '')} / {card.get('publisher', '')}",
                    "url": card.get("doiUrl", ""),
                    "reason": "No local PDF or extracted full-text source was found.",
                }
            )
            skipped += 1
            continue

        if fulltext_path:
            if fulltext_type == "fulltext-pdf":
                card["pdfPath"] = fulltext_path
                card["fullTextType"] = "fulltext-pdf"
                card["readingStatus"] = "fulltext-ready"
            else:
                card["fullTextPath"] = fulltext_path
                card["fullTextType"] = "fulltext-source"
                card["readingStatus"] = "fulltext-ready"
        elif not args.require_fulltext:
            card["readingStatus"] = "needs-fulltext"
            card["limitations"] = "Temporary card generated without full text. Do not cite method or result details until a PDF or article text is read."

        source_path = vault_dir / card["sourcePath"].replace("./", "")
        note_path = vault_dir / card["notePath"].replace("./", "")
        write_text(source_path, source_markdown(paper))
        write_text(note_path, note_markdown(card))
        current.append(card)
        seen.add(key)
        seen_titles.add(title_key)
        imported += 1

    enforce_area_limit(current, args.max_areas)
    write_fulltext_inbox(vault_dir, needs_fulltext)
    save_papers(vault_dir, current)
    save_vault_settings(vault_dir, args.min_impact_factor, args.keep_preprints)
    validate_utf8_outputs(vault_dir)
    result = {
        "vault_dir": str(vault_dir),
        "imported": imported,
        "skipped": skipped,
        "needs_fulltext": len(needs_fulltext),
        "requires_user_login": bool(needs_fulltext),
        "total": len(current),
    }
    if needs_fulltext:
        result["login_prompt"] = (
            f"{len(needs_fulltext)} High/Medium papers need school or institutional access before they can be added "
            "to Paper Vault. Ask the user whether they want to log in through the active browser now."
        )
    print(json.dumps(result, indent=2))


def init(args: argparse.Namespace) -> None:
    vault_dir = Path(args.vault_dir).resolve()
    ensure_vault(vault_dir)
    print(json.dumps({"vault_dir": str(vault_dir), "status": "ready"}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Create and update a local Paper Vault.")
    sub = parser.add_subparsers(dest="command", required=True)

    init_parser = sub.add_parser("init", help="Create a Paper Vault site.")
    init_parser.add_argument("--vault-dir", default="paper-vault-site")
    init_parser.set_defaults(func=init)

    import_parser = sub.add_parser("import-high", help="Import selected priority papers from daily digest JSON data.")
    import_parser.add_argument("--vault-dir", default="paper-vault-site")
    import_parser.add_argument("--digest-data-dir", default="daily-literature-digests/data")
    import_parser.add_argument("--config", default="")
    import_parser.add_argument("--priority", choices=["High", "Medium", "Low"], default="High")
    import_parser.add_argument("--language", default="en")
    import_parser.add_argument("--download-arxiv-pdfs", action="store_true")
    import_parser.add_argument("--min-impact-factor", type=float, default=0.0)
    import_parser.add_argument("--max-areas", type=int, default=5)
    import_parser.add_argument("--keep-preprints", action=argparse.BooleanOptionalAction, default=True)
    import_parser.add_argument("--require-fulltext", action=argparse.BooleanOptionalAction, default=True)
    import_parser.set_defaults(func=import_high)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
