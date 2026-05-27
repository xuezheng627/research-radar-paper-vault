const papers = window.PAPER_VAULT_DATA || [];
const fulltextInbox = window.PAPER_VAULT_FULLTEXT_INBOX || [];

const state = {
  area: "All",
  subtopic: "All",
  priority: "All",
  search: "",
};

const priorityRank = { High: 3, Medium: 2, Low: 1 };
const areaColors = ["#7cc9bd", "#94bee8", "#f2c879", "#eea7b8", "#afd39b", "#b9a9e3"];
const labelMap = window.PAPER_VAULT_LABELS || {};
const minimumJournalImpactFactor = Number(window.PAPER_VAULT_MIN_IMPACT_FACTOR || 0);
const keepPreprintsWithoutImpactFactor = window.PAPER_VAULT_KEEP_PREPRINTS !== false;
const vaultRoot = window.PAPER_VAULT_ROOT || "";
const bilingualText = window.PAPER_VAULT_BILINGUAL || { generic: {}, papers: {} };

const els = {
  stats: document.getElementById("stats"),
  search: document.getElementById("search"),
  areaChart: document.getElementById("areaChart"),
  areaFilters: document.getElementById("areaFilters"),
  subtopicPanel: document.getElementById("subtopicPanel"),
  subtopicFilters: document.getElementById("subtopicFilters"),
  priorityFilters: document.getElementById("priorityFilters"),
  journalList: document.getElementById("journalList"),
  fulltextInbox: document.getElementById("fulltextInbox"),
  groupedPapers: document.getElementById("groupedPapers"),
  template: document.getElementById("paperCardTemplate"),
};

function countBy(items, getter) {
  return items.reduce((acc, item) => {
    for (const value of getter(item)) acc.set(value, (acc.get(value) || 0) + 1);
    return acc;
  }, new Map());
}

function formatLabel(value) {
  if (!value) return "";
  const text = String(value).trim();
  return labelMap[text] || text;
}

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(text || "");
}

function translationFor(paper, field, text, target) {
  const paperTranslation = bilingualText.papers?.[paper.id]?.[field]?.[target];
  if (paperTranslation) return paperTranslation;
  return bilingualText.generic?.[text]?.[target] || "";
}

function bilingualBlock(paper, field, text) {
  const original = text || "";
  const zh = hasChinese(original) ? original : translationFor(paper, field, original, "zh");
  const en = hasChinese(original) ? translationFor(paper, field, original, "en") : original;
  const container = document.createElement("div");
  container.className = "bilingual-block";

  const addLine = (lang, value) => {
    if (!value) return;
    const line = document.createElement("p");
    line.className = `bilingual-line ${lang}`;
    const badge = document.createElement("span");
    badge.className = "lang-badge";
    badge.textContent = lang === "zh" ? "中文" : "EN";
    const content = document.createElement("span");
    content.textContent = value;
    line.append(badge, content);
    container.append(line);
  };

  addLine("zh", zh);
  addLine("en", en);
  return container;
}

function setPaperText(node, paper, field, text) {
  node.replaceChildren(bilingualBlock(paper, field, text));
}

function labelSearchText(values) {
  return values.map((value) => `${value} ${formatLabel(value)}`).join(" ");
}

function makeButton(label, count, active, onClick, accent = "") {
  const button = document.createElement("button");
  button.className = `filter-btn${active ? " active" : ""}`;
  button.type = "button";
  if (accent) button.style.setProperty("--accent", accent);
  button.innerHTML = `<span>${label}</span><span>${count}</span>`;
  button.addEventListener("click", onClick);
  return button;
}

function areaColor(area, areaEntries = []) {
  const index = areaEntries.findIndex(([name]) => name === area);
  return areaColors[(index === -1 ? 0 : index) % areaColors.length];
}

function primarySubtopic(paper) {
  const subtopics = paper.subtopics || [];
  return paper.primarySubtopic || subtopics[0] || "Unclassified";
}

function makeBarButton(label, count, max, active, onClick) {
  const button = document.createElement("button");
  button.className = `bar-filter${active ? " active" : ""}`;
  button.type = "button";
  const percent = max ? Math.max(8, Math.round((count / max) * 100)) : 0;
  button.innerHTML = `
    <span class="bar-filter-head">
      <span>${formatLabel(label)}</span>
      <strong>${count}</strong>
    </span>
    <span class="bar-track"><span style="width: ${percent}%"></span></span>
  `;
  button.addEventListener("click", onClick);
  return button;
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describePieSlice(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`, "Z"].join(" ");
}

function chartLabelLines(area) {
  const label = formatLabel(area).split("/")[0].trim();
  if (label.includes("&")) return label.split("&").map((part) => part.trim()).filter(Boolean).slice(0, 2);
  if (label.length > 14) return [label.slice(0, 14), label.slice(14, 28)].filter(Boolean);
  return [label];
}

function compactChartLabelLines(area) {
  const label = formatLabel(area).split("/")[0].trim().replace(/\s+/g, " ");
  if (label.includes("&")) return label.split("&").map((part) => part.trim()).filter(Boolean).slice(0, 2);
  if (label.length > 8) return [label.slice(0, 8), label.slice(8, 16)].filter(Boolean);
  return [label];
}

function distributePieLabels(slices, minY, maxY, height, gap) {
  const distributeSide = (items) => {
    items.sort((a, b) => a.desiredLabelY - b.desiredLabelY);
    if (items.length === 1) {
      items[0].labelY = Math.min(maxY - height / 2, Math.max(minY + height / 2, items[0].desiredLabelY));
      return;
    }
    const top = minY + height / 2;
    const bottom = maxY - height / 2;
    const step = Math.max(height + gap, (bottom - top) / (items.length - 1));
    const usedTop = (top + bottom - step * (items.length - 1)) / 2;
    items.forEach((item, index) => {
      item.labelY = usedTop + step * index;
    });
  };

  distributeSide(slices.filter((slice) => slice.rightSide));
  distributeSide(slices.filter((slice) => !slice.rightSide));
}

function renderAreaChart(areaEntries, total, areaScoped = [], subtopics = new Map()) {
  if (!els.areaChart) return;
  if (!total) {
    els.areaChart.replaceChildren();
    return;
  }

  const map = document.createElement("div");
  map.className = "category-map";

  const resetArea = () => {
    state.area = "All";
    state.subtopic = "All";
    render();
  };

  if (state.area !== "All") {
    const areaCount = areaScoped.length;
    const percent = total ? Math.round((areaCount / total) * 100) : 0;
    const selectedColor = areaColor(state.area, areaEntries);
    const header = document.createElement("div");
    header.className = "category-drilldown";
    header.style.setProperty("--category-color", selectedColor);
    header.innerHTML = `
      <button class="category-back" type="button">All categories</button>
    `;
    header.querySelector(".category-back").addEventListener("click", resetArea);
    map.append(header);

    const miniRow = document.createElement("div");
    miniRow.className = "category-mini-row";
    for (const [area, count] of areaEntries) {
      const miniColor = areaColor(area, areaEntries);
      const active = state.area === area;
      const mini = document.createElement("button");
      mini.type = "button";
      mini.className = `category-mini-card${active ? " active" : ""}`;
      mini.style.setProperty("--category-color", miniColor);
      mini.innerHTML = `
        <span class="category-dot"></span>
        <span class="category-mini-name">${formatLabel(area)}</span>
        <strong>${count}</strong>
      `;
      mini.addEventListener("click", () => {
        state.area = area;
        state.subtopic = "All";
        render();
      });
      miniRow.append(mini);
    }
    map.append(miniRow);

    const subtopicEntries = [...subtopics.entries()].sort(
      (a, b) => b[1] - a[1] || formatLabel(a[0]).localeCompare(formatLabel(b[0])),
    );
    const subtopicGrid = document.createElement("div");
    subtopicGrid.className = "subtopic-card-grid";
    const makeSubtopicCard = (label, count, active, onClick) => {
      const subPercent = areaCount ? Math.round((count / areaCount) * 100) : 0;
      const card = document.createElement("button");
      card.type = "button";
      card.className = `subtopic-card${active ? " active" : ""}`;
      card.style.setProperty("--category-color", selectedColor);
      card.innerHTML = `
        <span class="subtopic-name">${formatLabel(label)}</span>
        <span class="subtopic-metrics"><strong>${count}</strong><span>${subPercent}%</span></span>
        <span class="category-track"><span style="width: ${subPercent}%"></span></span>
      `;
      card.addEventListener("click", onClick);
      return card;
    };

    subtopicGrid.append(
      ...subtopicEntries.map(([subtopic, count]) =>
        makeSubtopicCard(subtopic, count, state.subtopic === subtopic, () => {
          state.subtopic = subtopic;
          render();
        }),
      ),
    );
    map.append(subtopicGrid);
    els.areaChart.replaceChildren(map);
    return;
  }

  const overview = document.createElement("button");
  overview.type = "button";
  overview.className = `category-overview${state.area === "All" ? " active" : ""}`;
  overview.innerHTML = `
    <span class="category-overview-label">All categories</span>
    <strong>${total}</strong>
    <span>papers in vault</span>
  `;
  overview.addEventListener("click", resetArea);
  map.append(overview);

  const grid = document.createElement("div");
  grid.className = "category-card-grid";

  for (const [area, count] of areaEntries) {
    const color = areaColor(area, areaEntries);
    const percent = total ? Math.round((count / total) * 100) : 0;
    const active = state.area === area;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `category-card${active ? " active" : ""}`;
    card.style.setProperty("--category-color", color);
    card.setAttribute("aria-label", `${formatLabel(area)}: ${count} papers, ${percent}%`);
    card.innerHTML = `
      <span class="category-card-head">
        <span class="category-dot"></span>
        <span class="category-name">${formatLabel(area)}</span>
      </span>
      <span class="category-card-metrics">
        <strong>${count}</strong>
        <span>${percent}%</span>
      </span>
      <span class="category-track"><span style="width: ${percent}%"></span></span>
    `;
    card.addEventListener("click", () => {
      state.area = state.area === area ? "All" : area;
      state.subtopic = "All";
      render();
    });
    grid.append(card);
  }

  map.append(grid);
  els.areaChart.replaceChildren(map);
  return;

  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("class", "pie-chart");
  svg.setAttribute("viewBox", "0 0 560 420");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Research category pie chart");

  const cx = 280;
  const cy = 210;
  const radius = 103;
  const labelWidth = 148;
  const labelHeight = 66;
  const minLabelY = 42;
  const maxLabelY = 378;
  const labelGap = 18;
  let startAngle = 0;
  const slices = areaEntries.map(([area, count]) => {
    const sweep = (count / total) * 360;
    const endAngle = startAngle + sweep;
    const midAngle = startAngle + sweep / 2;
    const rightSide = Math.cos(((midAngle - 90) * Math.PI) / 180) >= 0;
    const elbowPoint = polarToCartesian(cx, cy, radius + 34, midAngle);
    const slice = {
      area,
      count,
      sweep,
      startAngle,
      endAngle,
      midAngle,
      color: areaColor(area, areaEntries),
      active: state.area === area,
      rightSide,
      desiredLabelY: Math.min(maxLabelY - labelHeight / 2, Math.max(minLabelY + labelHeight / 2, elbowPoint.y)),
    };
    startAngle = endAngle;
    return slice;
  });
  distributePieLabels(slices, minLabelY, maxLabelY, labelHeight, labelGap);

  for (const slice of slices) {
    const { area, count, sweep, startAngle, endAngle, midAngle, color, active, rightSide, labelY } = slice;
    const group = document.createElementNS(namespace, "g");
    group.setAttribute("class", `pie-slice${active ? " active" : ""}`);
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${formatLabel(area)}: ${count} papers`);

    const shape =
      sweep >= 359.5 ? document.createElementNS(namespace, "circle") : document.createElementNS(namespace, "path");
    if (sweep >= 359.5) {
      shape.setAttribute("cx", cx);
      shape.setAttribute("cy", cy);
      shape.setAttribute("r", radius);
    } else {
      shape.setAttribute("d", describePieSlice(cx, cy, radius, startAngle, endAngle));
    }
    shape.setAttribute("fill", color);
    shape.setAttribute("class", "pie-segment");
    group.append(shape);

    const edgePoint = polarToCartesian(cx, cy, radius + 2, midAngle);
    const elbowPoint = polarToCartesian(cx, cy, radius + 34, midAngle);
    const labelX = rightSide ? 398 : 24;
    const labelLineX = rightSide ? labelX - 14 : labelX + labelWidth + 14;
    const leader = document.createElementNS(namespace, "polyline");
    leader.setAttribute("class", "pie-leader");
    leader.setAttribute("points", `${edgePoint.x},${edgePoint.y} ${elbowPoint.x},${elbowPoint.y} ${labelLineX},${labelY}`);
    leader.setAttribute("stroke", color);
    group.append(leader);

    const labelBg = document.createElementNS(namespace, "rect");
    labelBg.setAttribute("class", "pie-label-bg");
    labelBg.setAttribute("x", labelX - 8);
    labelBg.setAttribute("y", labelY - labelHeight / 2);
    labelBg.setAttribute("width", labelWidth);
    labelBg.setAttribute("height", labelHeight);
    labelBg.setAttribute("rx", "10");
    labelBg.setAttribute("fill", color);
    group.append(labelBg);

    const text = document.createElementNS(namespace, "text");
    text.setAttribute("class", "pie-label");
    text.setAttribute("x", labelX);
    text.setAttribute("y", labelY - 15);
    text.setAttribute("text-anchor", "start");
    text.setAttribute("dominant-baseline", "middle");
    const lines = compactChartLabelLines(area);
    lines.forEach((line, index) => {
      const tspan = document.createElementNS(namespace, "tspan");
      tspan.setAttribute("x", labelX);
      tspan.setAttribute("dy", index === 0 ? "0" : "16");
      tspan.textContent = line;
      text.append(tspan);
    });
    const countLine = document.createElementNS(namespace, "tspan");
    countLine.setAttribute("x", labelX);
    countLine.setAttribute("dy", "18");
    countLine.setAttribute("class", "pie-count");
    countLine.textContent = `${count} papers`;
    text.append(countLine);
    group.append(text);

    const selectArea = () => {
      state.area = state.area === area ? "All" : area;
      state.subtopic = "All";
      render();
    };
    group.addEventListener("click", selectArea);
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectArea();
      }
    });
    svg.append(group);
  }

  const center = document.createElementNS(namespace, "g");
  center.setAttribute("class", `pie-center${state.area === "All" ? " active" : ""}`);
  center.setAttribute("tabindex", "0");
  center.setAttribute("role", "button");
  center.setAttribute("aria-label", `Show all categories, ${total} papers`);
  center.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="43"></circle>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle">
      <tspan class="pie-total">${total}</tspan>
      <tspan x="${cx}" dy="18" class="pie-total-label">All</tspan>
    </text>
  `;
  const clearArea = () => {
    state.area = "All";
    state.subtopic = "All";
    render();
  };
  center.addEventListener("click", clearArea);
  center.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      clearArea();
    }
  });
  svg.append(center);

  els.areaChart.replaceChildren(svg);
}

function sortedSubtopicEntries(items) {
  return [...countBy(items, (paper) => [primarySubtopic(paper)]).entries()].sort(
    (a, b) => b[1] - a[1] || formatLabel(a[0]).localeCompare(formatLabel(b[0])),
  );
}

function renderSubtopicFilters(areaEntries, eligiblePapers, areaScoped, subtopics) {
  els.subtopicPanel.hidden = false;
  els.subtopicFilters.classList.toggle("grouped", state.area === "All");

  if (state.area === "All") {
    const groups = areaEntries.map(([area, areaCount]) => {
      const groupItems = eligiblePapers.filter((paper) => paper.area === area);
      const entries = sortedSubtopicEntries(groupItems);
      const maxCount = Math.max(...entries.map(([, count]) => count), areaCount, 1);
      const section = document.createElement("div");
      section.className = "subtopic-group";

      const title = document.createElement("button");
      title.type = "button";
      title.className = "subtopic-group-title";
      title.style.setProperty("--accent", areaColor(area, areaEntries));
      title.innerHTML = `<span>${formatLabel(area)}</span><strong>${areaCount}</strong>`;
      title.addEventListener("click", () => {
        state.area = area;
        state.subtopic = "All";
        render();
      });

      const bars = document.createElement("div");
      bars.className = "subtopic-mini-bars";
      bars.replaceChildren(
        ...entries.map(([subtopic, count]) =>
          makeBarButton(subtopic, count, maxCount, false, () => {
            state.area = area;
            state.subtopic = subtopic;
            render();
          }),
        ),
      );

      section.append(title, bars);
      return section;
    });
    els.subtopicFilters.replaceChildren(...groups);
    return;
  }

  const subtopicEntries = [...subtopics.entries()].sort(
    (a, b) => b[1] - a[1] || formatLabel(a[0]).localeCompare(formatLabel(b[0])),
  );
  const maxSubtopic = Math.max(...subtopicEntries.map(([, count]) => count), areaScoped.length, 1);
  els.subtopicFilters.replaceChildren(
    makeBarButton("All", areaScoped.length, maxSubtopic, state.subtopic === "All", () => {
      state.subtopic = "All";
      render();
    }),
    ...subtopicEntries.map(([subtopic, count]) =>
      makeBarButton(subtopic, count, maxSubtopic, state.subtopic === subtopic, () => {
        state.subtopic = subtopic;
        render();
      }),
    ),
  );
}

function renderFilters() {
  const eligiblePapers = papers.filter(passesImpactThreshold);
  const areas = countBy(eligiblePapers, (paper) => [paper.area || "General Research"]);
  const areaScoped = state.area === "All" ? eligiblePapers : eligiblePapers.filter((paper) => paper.area === state.area);
  const subtopics = countBy(areaScoped, (paper) => [primarySubtopic(paper)]);

  if (state.area !== "All" && !areas.has(state.area)) {
    state.area = "All";
    state.subtopic = "All";
  }
  if (state.subtopic !== "All" && !subtopics.has(state.subtopic)) state.subtopic = "All";

  const topicScoped =
    state.subtopic === "All" ? areaScoped : areaScoped.filter((paper) => primarySubtopic(paper) === state.subtopic);
  const priorityCounts = countBy(topicScoped, (paper) => [paper.priority || "Saved"]);
  if (state.priority !== "All" && !priorityCounts.has(state.priority)) state.priority = "All";

  const areaEntries = [...areas.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  renderAreaChart(areaEntries, eligiblePapers.length, areaScoped, subtopics);

  if (els.areaFilters) {
    els.areaFilters.hidden = true;
    els.areaFilters.replaceChildren();
  }

  if (els.subtopicPanel) {
    els.subtopicPanel.hidden = true;
    els.subtopicFilters.replaceChildren();
  }

  const priorities = ["High", "Medium", "Low", "Saved"].filter((priority) => priorityCounts.has(priority));
  els.priorityFilters.replaceChildren(
    makeButton("All", topicScoped.length, state.priority === "All", () => {
      state.priority = "All";
      render();
    }),
    ...priorities.map((priority) =>
      makeButton(priority, priorityCounts.get(priority), state.priority === priority, () => {
        state.priority = priority;
        render();
      }),
    ),
  );
}

function getJournalInfo(paper) {
  return {
    name: paper.journal || "Unknown source",
    sourceName: paper.journalSourceName || paper.sourceName || "Journal homepage",
    sourceUrl: paper.journalSourceUrl || "",
    impactFactor: paper.impactFactor || "TBC",
    impactYear: paper.impactYear || "",
  };
}

function impactLabel(info) {
  if (!info.impactFactor || info.impactFactor === "TBC") return "IF TBC";
  if (info.impactFactor === "N/A") return "No IF";
  return `IF ${info.impactFactor}`;
}

function parseImpactFactor(info) {
  const value = Number.parseFloat(info.impactFactor);
  return Number.isFinite(value) ? value : null;
}

function passesImpactThreshold(paper) {
  if (!minimumJournalImpactFactor) return true;
  const info = getJournalInfo(paper);
  const impact = parseImpactFactor(info);
  if (impact === null) return keepPreprintsWithoutImpactFactor && info.impactFactor === "N/A";
  return impact >= minimumJournalImpactFactor;
}

function filteredPapers() {
  const query = state.search.trim().toLowerCase();
  return papers
    .filter(passesImpactThreshold)
    .filter((paper) => state.area === "All" || paper.area === state.area)
    .filter((paper) => state.subtopic === "All" || primarySubtopic(paper) === state.subtopic)
    .filter((paper) => state.priority === "All" || paper.priority === state.priority)
    .filter((paper) => {
      if (!query) return true;
      const haystack = [
        paper.title,
        paper.journal,
        paper.publisher,
        paper.area,
        paper.summary,
        paper.objective,
        paper.method,
        paper.result,
        paper.usefulness,
        paper.nextAction,
        ...(paper.tags || []),
        ...(paper.categories || []),
        ...(paper.subtopics || []),
        labelSearchText([paper.area, ...(paper.tags || []), ...(paper.categories || []), ...(paper.subtopics || [])]),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      const areaDelta = (a.area || "").localeCompare(b.area || "");
      if (areaDelta !== 0) return areaDelta;
      const priorityDelta = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return (b.added || "").localeCompare(a.added || "");
    });
}

function actionLink(label, href, className = "") {
  const a = document.createElement("a");
  a.className = `action ${className}`.trim();
  a.textContent = label;
  a.href = href;
  return a;
}

function disabledAction(label) {
  const span = document.createElement("span");
  span.className = "action disabled";
  span.textContent = label;
  return span;
}

function localPdfPath(paper) {
  const path = paper.pdfPath || "";
  if (!path) return "";
  if (/^[a-zA-Z]:[\\/]/.test(path)) return path.replace(/\//g, "\\");
  if (!vaultRoot || /^https?:\/\//i.test(path)) return path;
  const normalizedRoot = vaultRoot.replace(/[\\/]+$/, "");
  if (path.startsWith("./")) return `${normalizedRoot}\\${path.slice(2).replace(/\//g, "\\")}`;
  return `${normalizedRoot}\\${path.replace(/\//g, "\\")}`;
}

function pdfPathText(path) {
  const span = document.createElement("span");
  span.className = "action pdf-path-text";
  span.title = "Local PDF path";
  span.textContent = path;
  return span;
}

function renderJournalList(items) {
  const grouped = new Map();
  for (const paper of items) {
    const info = getJournalInfo(paper);
    const current = grouped.get(info.name) || { ...info, count: 0 };
    current.count += 1;
    grouped.set(info.name, current);
  }
  const rows = [...grouped.values()].sort((a, b) => {
    const impactDelta = (parseImpactFactor(b) ?? -1) - (parseImpactFactor(a) ?? -1);
    if (impactDelta !== 0) return impactDelta;
    return b.count - a.count || a.name.localeCompare(b.name);
  });
  const maxImpact = Math.max(...rows.map((info) => parseImpactFactor(info) || 0), 1);

  els.journalList.replaceChildren(
    ...rows.map((info) => {
      const impact = parseImpactFactor(info);
      const width = impact ? Math.max(7, Math.round((impact / maxImpact) * 100)) : 0;
      const row = document.createElement("a");
      row.className = "journal-item journal-bar-item";
      row.href = info.sourceUrl || "#";
      row.innerHTML = `
        <span class="journal-topline">
          <span class="journal-main">
            <span class="journal-name">${info.name}</span>
            <span class="journal-source">${info.sourceName}</span>
          </span>
          <span class="journal-side">
            <span class="journal-impact">${impactLabel(info)}</span>
            <span class="journal-count">${info.count}</span>
          </span>
        </span>
        <span class="journal-bar"><span style="width: ${width}%"></span></span>
        <span class="journal-year">${info.impactYear}</span>
      `;
      return row;
    }),
  );
}

function renderFulltextInbox() {
  if (!els.fulltextInbox) return;
  if (!fulltextInbox.length) {
    const empty = document.createElement("p");
    empty.className = "queue-empty";
    empty.textContent = "No papers are waiting for full-text access.";
    els.fulltextInbox.replaceChildren(empty);
    return;
  }

  const rows = fulltextInbox.map((paper) => {
    const row = document.createElement("article");
    row.className = "queue-item";

    const title = document.createElement("h3");
    title.textContent = paper.title;

    const meta = document.createElement("p");
    meta.className = "queue-meta";
    meta.textContent = `${paper.priority || "Priority pending"} · ${paper.publisher || paper.source || "Unknown source"}${
      paper.journal ? ` · ${paper.journal}` : ""
    }`;

    const reason = document.createElement("p");
    reason.className = "queue-reason";
    reason.textContent = paper.reason || "Full text or local PDF is still needed.";

    const actionRow = document.createElement("div");
    actionRow.className = "queue-actions";
    if (paper.url || paper.doiUrl) actionRow.append(actionLink("Open DOI/URL", paper.url || paper.doiUrl, "primary"));
    const status = document.createElement("span");
    status.className = "queue-status";
    status.textContent = `Status: ${paper.previousStatus || paper.readingStatus || "no-fulltext"}`;
    actionRow.append(status);

    row.append(title, meta, reason, actionRow);
    return row;
  });

  els.fulltextInbox.replaceChildren(...rows);
}

function renderCard(paper) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const journalInfo = getJournalInfo(paper);
  const metric = journalInfo.impactFactor === "N/A" ? "preprint source" : `${impactLabel(journalInfo)} ${journalInfo.impactYear}`.trim();
  node.querySelector(".meta").textContent = `${paper.journal || "Unknown source"} · ${paper.publisher || "Unknown publisher"} · ${paper.year || ""} · ${metric}`;
  node.querySelector("h3").textContent = paper.title || "Untitled paper";
  node.querySelector(".area-line").textContent = `${formatLabel(paper.area || "General Research")} / Primary: ${formatLabel(primarySubtopic(paper))}`;

  const priority = node.querySelector(".priority");
  priority.textContent = paper.priority || "Saved";
  priority.classList.add((paper.priority || "saved").toLowerCase());

  const tagRow = node.querySelector(".tag-row");
  tagRow.replaceChildren(
    ...(paper.tags || []).slice(0, 6).map((tag) => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = formatLabel(tag);
      return span;
    }),
  );

  setPaperText(node.querySelector(".summary"), paper, "summary", paper.summary || "No summary available yet.");
  setPaperText(node.querySelector(".objective"), paper, "objective", paper.objective || "Not available.");
  setPaperText(node.querySelector(".method"), paper, "method", paper.method || "Not available.");
  setPaperText(node.querySelector(".result"), paper, "result", paper.result || "Not available.");
  setPaperText(
    node.querySelector(".usefulness"),
    paper,
    "usefulness",
    paper.usefulness || "Review this paper against your current research questions.",
  );
  setPaperText(
    node.querySelector(".next"),
    paper,
    "nextAction",
    paper.nextAction || "Open the note or source link and decide whether to read the full text.",
  );

  const panel = node.querySelector(".details-panel");
  const toggle = node.querySelector(".detail-toggle");
  const toggleIcon = node.querySelector(".toggle-icon");
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    panel.hidden = expanded;
    toggleIcon.textContent = expanded ? "+" : "-";
    toggle.querySelector("span:last-child").textContent = expanded ? "View details" : "Hide details";
  });

  const actions = node.querySelector(".actions");
  const primaryLinkLabel = paper.publisher === "arXiv" ? "Open arXiv" : "Open DOI";
  const pdfLocalPath = localPdfPath(paper);
  const links = [
    paper.doiUrl ? actionLink(primaryLinkLabel, paper.doiUrl, "primary") : null,
    journalInfo.sourceUrl ? actionLink("Journal site", journalInfo.sourceUrl) : null,
    pdfLocalPath ? pdfPathText(pdfLocalPath) : disabledAction("PDF pending"),
  ].filter(Boolean);
  actions.replaceChildren(...links);
  return node;
}

function renderStats(items) {
  const high = items.filter((paper) => paper.priority === "High").length;
  const medium = items.filter((paper) => paper.priority === "Medium").length;
  const areas = new Set(items.map((paper) => paper.area || "General Research")).size;
  const journals = new Set(items.map((paper) => paper.journal || "Unknown source")).size;
  const excluded = papers.length - papers.filter(passesImpactThreshold).length;
  els.stats.innerHTML = `
    <div class="stat-pill"><strong>${items.length}</strong>papers</div>
    <div class="stat-pill"><strong>${high}</strong>high priority</div>
    <div class="stat-pill"><strong>${medium}</strong>medium priority</div>
    <div class="stat-pill"><strong>${areas}</strong>areas</div>
    <div class="stat-pill"><strong>${journals}</strong>journals/sources</div>
    ${minimumJournalImpactFactor ? `<div class="stat-pill"><strong>${excluded}</strong>IF&lt;${minimumJournalImpactFactor} hidden</div>` : ""}
  `;
}

function renderGroups(items) {
  els.groupedPapers.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No matching papers yet.";
    els.groupedPapers.append(empty);
    return;
  }

  const groups = new Map();
  for (const paper of items) {
    const area = paper.area || "General Research";
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(paper);
  }

  for (const [area, groupItems] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const section = document.createElement("section");
    const title = document.createElement("h2");
    title.className = "group-title";
    title.innerHTML = `${formatLabel(area)} <span>${groupItems.length} paper${groupItems.length > 1 ? "s" : ""}</span>`;
    const grid = document.createElement("div");
    grid.className = "paper-grid";
    grid.replaceChildren(...groupItems.map(renderCard));
    section.append(title, grid);
    els.groupedPapers.append(section);
  }
}

function render() {
  renderFilters();
  const items = filteredPapers();
  renderStats(items);
  if (els.journalList) renderJournalList(items);
  renderFulltextInbox();
  renderGroups(items);
}

els.search.addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});

render();
