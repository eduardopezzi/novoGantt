const MS_PER_DAY = 24 * 60 * 60 * 1000;
const palette = [
  "#256c6a",
  "#8b4b63",
  "#4f6f9f",
  "#7a6a2f",
  "#95613b",
  "#4d7d45",
  "#8a4c40",
  "#5f5b9a",
  "#2f7896",
  "#846096",
  "#a05f2f",
  "#52724b"
];

const state = {
  snapshot: null,
  snapId: "",
  resources: new Map(),
  sectorEquipmentTotals: new Map(),
  routesByPackref: new Map(),
  items: [],
  activeView: "schedule",
  analysisExport: null,
  machineGroups: [],
  filteredMachines: [],
  rows: [],
  minTime: 0,
  maxTime: 0,
  viewMinTime: 0,
  viewMaxTime: 0,
  totalDays: 1,
  hatchedDayIndexes: new Set(),
  dayWidth: 34,
  rowHeight: 46,
  virtualStart: -1,
  virtualEnd: -1,
  scrollFrame: 0
};

const elements = {
  scheduleViewButton: document.querySelector("#scheduleViewButton"),
  analysisViewButton: document.querySelector("#analysisViewButton"),
  scheduleView: document.querySelector("#scheduleView"),
  analysisView: document.querySelector("#analysisView"),
  snapshotName: document.querySelector("#snapshotName"),
  snapshotIdDisplay: document.querySelector("#snapshotIdDisplay"),
  snapIdInput: document.querySelector("#snapIdInput"),
  metricOrders: document.querySelector("#metricOrders"),
  metricSteps: document.querySelector("#metricSteps"),
  metricRange: document.querySelector("#metricRange"),
  metricLate: document.querySelector("#metricLate"),
  searchInput: document.querySelector("#searchInput"),
  typeFilter: document.querySelector("#typeFilter"),
  packrefFilter: document.querySelector("#packrefFilter"),
  productFilter: document.querySelector("#productFilter"),
  sectorFilter: document.querySelector("#sectorFilter"),
  operationFilter: document.querySelector("#operationFilter"),
  lateFilter: document.querySelector("#lateFilter"),
  fromDateInput: document.querySelector("#fromDateInput"),
  toDateInput: document.querySelector("#toDateInput"),
  sortSelect: document.querySelector("#sortSelect"),
  visibleDaysSelect: document.querySelector("#visibleDaysSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  loadingState: document.querySelector("#loadingState"),
  errorState: document.querySelector("#errorState"),
  emptyState: document.querySelector("#emptyState"),
  gantt: document.querySelector("#gantt"),
  axis: document.querySelector("#axis"),
  labels: document.querySelector("#labels"),
  timeline: document.querySelector("#timeline"),
  tooltip: document.querySelector("#tooltip"),
  analysisMetricSteps: document.querySelector("#analysisMetricSteps"),
  analysisMetricOrders: document.querySelector("#analysisMetricOrders"),
  analysisMetricMachines: document.querySelector("#analysisMetricMachines"),
  analysisMetricHours: document.querySelector("#analysisMetricHours"),
  analysisSearchInput: document.querySelector("#analysisSearchInput"),
  analysisRowSelect: document.querySelector("#analysisRowSelect"),
  analysisColumnSelect: document.querySelector("#analysisColumnSelect"),
  analysisMeasureSelect: document.querySelector("#analysisMeasureSelect"),
  analysisMeasureToggles: [...document.querySelectorAll("[data-analysis-measure]")],
  analysisTypeFilter: document.querySelector("#analysisTypeFilter"),
  analysisSectorFilter: document.querySelector("#analysisSectorFilter"),
  analysisPackrefFilter: document.querySelector("#analysisPackrefFilter"),
  analysisProductFilter: document.querySelector("#analysisProductFilter"),
  analysisOperationFilter: document.querySelector("#analysisOperationFilter"),
  analysisConflictFilter: document.querySelector("#analysisConflictFilter"),
  analysisFromDateInput: document.querySelector("#analysisFromDateInput"),
  analysisToDateInput: document.querySelector("#analysisToDateInput"),
  analysisSortSelect: document.querySelector("#analysisSortSelect"),
  analysisLimitSelect: document.querySelector("#analysisLimitSelect"),
  analysisExportButton: document.querySelector("#analysisExportButton"),
  analysisLoadingState: document.querySelector("#analysisLoadingState"),
  analysisErrorState: document.querySelector("#analysisErrorState"),
  analysisEmptyState: document.querySelector("#analysisEmptyState"),
  analysisResult: document.querySelector("#analysisResult"),
  analysisCaption: document.querySelector("#analysisCaption"),
  pivotTable: document.querySelector("#pivotTable")
};

const dateShort = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit"
});
const dateFull = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const analysisDimensionLabels = {
  sector: "Setor",
  equipment: "Equipamento",
  packref: "Packref",
  product: "Produto",
  operation: "Operacao",
  type: "Tipo",
  order: "Pedido",
  day: "Dia"
};

const analysisMeasureLabels = {
  custom: "Personalizado",
  processes_hours: "Processos + horas + utilizacao",
  processes: "Processos",
  orders: "Pedidos distintos",
  machines: "Equipamentos distintos",
  packrefs: "Packrefs distintos",
  products: "Produtos distintos",
  hours: "Horas programadas",
  utilization: "Utilizacao",
  conflicts: "Processos com conflito"
};

function startOfDay(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfDay(time) {
  const date = new Date(time);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function dateInputValue(time) {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value, end = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return end ? endOfDay(date.getTime()) : startOfDay(date.getTime());
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0h";
  const hours = ms / (60 * 60 * 1000);
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

function formatType(value) {
  if (value === "production") return "Producao";
  if (value === "packaging") return "Embalagem";
  return value || "Sem tipo";
}

function formatNumber(value, options = {}) {
  return value.toLocaleString("pt-BR", options);
}

function formatMeasure(value, measure) {
  if (measure === "utilization") {
    return `${formatNumber(value, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`;
  }
  if (measure === "hours") {
    return formatNumber(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return formatNumber(Math.round(value));
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function shortSnapId(value) {
  const text = String(value || "");
  if (text.length <= 18) return text;
  return `${text.slice(0, 8)}...${text.slice(-6)}`;
}

function syncSnapUi(snapId) {
  state.snapId = snapId || "";
  if (elements.snapIdInput) elements.snapIdInput.value = state.snapId;
  if (elements.snapshotIdDisplay) {
    elements.snapshotIdDisplay.textContent = `SNAP: ${shortSnapId(state.snapId) || "sem valor"}`;
  }
}

function updateSnapshotName(payload, items) {
  elements.snapshotName.textContent = `${payload?.metadata?.name || "Snap"} | ${items.length.toLocaleString(
    "pt-BR"
  )} processos em ${state.machineGroups.length.toLocaleString("pt-BR")} equipamentos | SNAP ${shortSnapId(
    state.snapId || payload?._id || ""
  )}`;
}

function colorFor(value) {
  const text = String(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length];
}

function normalizeResource(resource) {
  return {
    id: String(resource._id),
    name: String(resource.nome || `Equipamento ${resource._id}`),
    sectorId: String(resource.centro_operativo || ""),
    sectorName: String(resource.nome_centro_operativo || "Setor sem nome"),
    operational: Boolean(resource.operacional),
    thirdParty: Boolean(resource.terceiro)
  };
}

function buildSectorEquipmentTotals(items) {
  const totals = new Map();

  for (const item of items) {
    const sectorId = item.resourceSectorId || "__empty__";
    if (!totals.has(sectorId)) {
      totals.set(sectorId, {
        sectorId,
        sectorName: item.resourceSectorName || "Setor sem nome",
        equipment: new Set()
      });
    }
    totals.get(sectorId).equipment.add(item.equipment);
  }

  return totals;
}

function formatSectorEquipmentLabel(sectorName, sectorId, usedCount) {
  const existingCount = state.sectorEquipmentTotals.get(sectorId)?.equipment.size || usedCount;
  return `${sectorName} (${existingCount} existentes / ${usedCount} usados)`;
}

function getItems(payload, resources) {
  return (payload?.solution?.items || [])
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end >= item.start)
    .map((item, index) => {
      const equipment = String(item.equipment);
      const resource = resources.get(equipment);
      const sectorId = String(resource?.sectorId || item.sector || "");
      const sectorName = String(resource?.sectorName || `Setor ${item.sector || "sem setor"}`);

      const normalized = {
        ...item,
        id: `${equipment}-${item.order}-${item.workflow}-${index}`,
        order: String(item.order),
        packref: String(item.packref),
        product: String(item.product),
        operation: String(item.operation),
        sector: String(item.sector),
        equipment,
        equipmentName: resource?.name || `Equipamento ${equipment}`,
        resourceSectorId: sectorId,
        resourceSectorName: sectorName,
        start: Number(item.start),
        end: Number(item.end),
        deadline: Number(item.deadline),
        color: colorFor(item.packref),
        hasConflict: false,
        conflictWith: []
      };
      normalized.searchText = [
        normalized.order,
        normalized.packref,
        normalized.product,
        normalized.operation,
        normalized.workflow,
        normalized.agg,
        normalized.equipment,
        normalized.equipmentName,
        normalized.resourceSectorId,
        normalized.resourceSectorName
      ]
        .join(" ")
        .toLowerCase();
      return normalized;
    });
}

function markConflicts(steps) {
  const active = [];

  for (const step of steps) {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].end <= step.start) active.splice(index, 1);
    }

    if (active.length > 0) {
      step.hasConflict = true;
      step.conflictWith = active.map((other) => other.order);
      for (const other of active) {
        other.hasConflict = true;
        if (!other.conflictWith.includes(step.order)) other.conflictWith.push(step.order);
      }
    }

    active.push(step);
  }
}

function buildMachineGroups(items) {
  const byEquipment = new Map();

  for (const item of items) {
    if (!byEquipment.has(item.equipment)) {
      byEquipment.set(item.equipment, {
        equipment: item.equipment,
        equipmentName: item.equipmentName,
        sectorId: item.resourceSectorId,
        sectorName: item.resourceSectorName,
        steps: [],
        orders: new Set(),
        packrefs: new Set(),
        products: new Set(),
        types: new Set(),
        operations: new Set(),
        start: item.start,
        end: item.end,
        conflictCount: 0,
        hasConflict: false
      });
    }

    const group = byEquipment.get(item.equipment);
    group.steps.push(item);
    group.orders.add(item.order);
    group.packrefs.add(item.packref);
    group.products.add(item.product);
    group.types.add(item.type);
    group.operations.add(item.operation);
    group.start = Math.min(group.start, item.start);
    group.end = Math.max(group.end, item.end);
  }

  return [...byEquipment.values()].map((group) => {
    group.steps.sort((a, b) => a.start - b.start || a.end - b.end || Number(a.order) - Number(b.order));
    markConflicts(group.steps);
    group.orders = [...group.orders];
    group.packrefs = [...group.packrefs];
    group.products = [...group.products];
    group.types = [...group.types];
    group.operations = [...group.operations];
    group.conflictCount = group.steps.filter((step) => step.hasConflict).length;
    group.hasConflict = group.conflictCount > 0;
    group.identitySearchText = [group.equipment, group.equipmentName, group.sectorId, group.sectorName]
      .join(" ")
      .toLowerCase();
    group.searchText = [
      group.equipment,
      group.equipmentName,
      group.sectorId,
      group.sectorName,
      ...group.orders,
      ...group.packrefs,
      ...group.products,
      ...group.types,
      ...group.operations,
      ...group.steps.flatMap((step) => [step.workflow, step.agg, step.packref])
    ]
      .join(" ")
      .toLowerCase();
    return group;
  });
}

function buildRoutesByPackref(items) {
  const routes = new Map();
  const byPackref = new Map();

  for (const item of items) {
    if (!byPackref.has(item.packref)) byPackref.set(item.packref, []);
    byPackref.get(item.packref).push(item);
  }

  for (const [packref, steps] of byPackref.entries()) {
    const summary = steps
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map(
        (item, index) =>
          `${index + 1}. ped ${item.order} / ${item.resourceSectorName} / ${item.equipmentName} / op ${
            item.operation
          } (${dateShort.format(new Date(item.start))})`
      )
      .join("\n");
    routes.set(packref, summary);
  }

  return routes;
}

function setVisibility({ loading = false, error = "", empty = false } = {}) {
  elements.loadingState.hidden = !loading;
  elements.errorState.hidden = !error;
  elements.errorState.textContent = error;
  elements.emptyState.hidden = !empty;
  elements.gantt.hidden = loading || Boolean(error) || empty;
}

function setAnalysisVisibility({ loading = false, error = "", empty = false } = {}) {
  elements.analysisLoadingState.hidden = !loading;
  elements.analysisErrorState.hidden = !error;
  elements.analysisErrorState.textContent = error;
  elements.analysisEmptyState.hidden = !empty;
  elements.analysisResult.hidden = loading || Boolean(error) || empty;
}

function fillSelect(select, values, label) {
  const current = select.value;
  const fragment = document.createDocumentFragment();
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = label;
  fragment.append(all);

  values.forEach(({ value, label: optionLabel }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = optionLabel;
    fragment.append(option);
  });

  select.replaceChildren(fragment);
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function updateMultiSelectSummary(element, allLabel) {
  const summary = element.querySelector(".multi-summary");
  const selected = [...element.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => input.value)
    .filter((value) => value !== "all");

  if (selected.length === 0) {
    summary.textContent = allLabel;
    return;
  }

  summary.textContent = selected.length === 1 ? element.querySelector(`input[value="${CSS.escape(selected[0])}"]`)?.dataset.label || selected[0] : `${selected.length} selecionados`;
}

function filterMultiSelectOptions(element, query) {
  const normalized = query.trim().toLowerCase();
  const options = [...element.querySelectorAll(".multi-option")];
  options.forEach((option) => {
    if (option.dataset.value === "all") {
      option.hidden = false;
      return;
    }
    const label = option.dataset.label || "";
    option.hidden = normalized.length > 0 && !label.toLowerCase().includes(normalized);
  });
}

function syncMultiSelectState(element, allLabel) {
  const allInput = element.querySelector('input[value="all"]');
  const itemInputs = [...element.querySelectorAll('.multi-option input[type="checkbox"]')].filter(
    (input) => input.value !== "all"
  );
  const selected = itemInputs.filter((input) => input.checked);

  if (allInput) allInput.checked = selected.length === 0;
  updateMultiSelectSummary(element, allLabel);
}

function fillMultiSelect(element, values, allLabel) {
  const selectedValues = new Set(getMultiSelectValues(element));
  const search = element.querySelector(".multi-search");
  const options = element.querySelector(".multi-options");
  const fragment = document.createDocumentFragment();
  const allOption = [{ value: "all", label: allLabel }, ...values];

  allOption.forEach(({ value, label }) => {
    const item = document.createElement("label");
    item.className = "multi-option";
    item.dataset.value = value;
    item.dataset.label = label;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.dataset.label = label;
    input.checked = value === "all" ? selectedValues.size === 0 : selectedValues.has(value);
    item.append(input, label);
    fragment.append(item);
  });

  options.replaceChildren(fragment);
  if (search) {
    search.value = "";
    search.oninput = () => filterMultiSelectOptions(element, search.value);
  }
  options.onchange = (event) => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    if (input.value === "all" && input.checked) {
      itemInputs(element).forEach((checkbox) => {
        if (checkbox.value !== "all") checkbox.checked = false;
      });
    } else if (input.value !== "all" && input.checked) {
      const allInput = element.querySelector('input[value="all"]');
      if (allInput) allInput.checked = false;
    }
    syncMultiSelectState(element, allLabel);
    renderAnalysis();
  };
  filterMultiSelectOptions(element, "");
  syncMultiSelectState(element, allLabel);
}

function getMultiSelectValues(element) {
  return [...element.querySelectorAll('input[type="checkbox"]:checked')]
    .map((input) => input.value)
    .filter((value) => value !== "all");
}

function itemInputs(element) {
  return [...element.querySelectorAll('.multi-option input[type="checkbox"]')];
}

function matchesMultiFilter(value, selected) {
  if (typeof selected === "string") {
    return selected === "all" || value === selected;
  }
  return selected.length === 0 || selected.includes(value);
}

function setupFilterOptions(items, machineGroups) {
  const sortNumericText = (a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b), "pt-BR");
  const packrefStats = new Map();
  for (const item of items) {
    if (!packrefStats.has(item.packref)) {
      packrefStats.set(item.packref, { processes: 0, orders: new Set() });
    }
    const stat = packrefStats.get(item.packref);
    stat.processes += 1;
    stat.orders.add(item.order);
  }
  const packrefs = [...packrefStats.entries()]
    .sort((a, b) => sortNumericText(a[0], b[0]))
    .map(([value, stat]) => ({
      value,
      label: `${value} (${stat.orders.size} pedidos, ${stat.processes} proc.)`
    }));
  const products = [...new Set(items.map((item) => item.product))]
    .sort(sortNumericText)
    .map((value) => ({ value, label: value }));
  const operations = [...new Set(items.map((item) => item.operation))]
    .sort(sortNumericText)
    .map((value) => ({ value, label: value }));
  const sectors = [...new Map(machineGroups.map((group) => [group.sectorId, group.sectorName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    .map(([value, label]) => ({ value, label: `${label} (${value})` }));

  fillSelect(elements.packrefFilter, packrefs, "Todos");
  fillSelect(elements.productFilter, products, "Todos");
  fillSelect(elements.sectorFilter, sectors, "Todos");
  fillSelect(elements.operationFilter, operations, "Todas");
  fillMultiSelect(
    elements.analysisTypeFilter,
    [
      { value: "production", label: "Producao" },
      { value: "packaging", label: "Embalagem" }
    ],
    "Todos"
  );
  fillMultiSelect(elements.analysisPackrefFilter, packrefs, "Todos");
  fillMultiSelect(elements.analysisProductFilter, products, "Todos");
  fillMultiSelect(elements.analysisSectorFilter, sectors, "Todos");
  fillMultiSelect(elements.analysisOperationFilter, operations, "Todas");
  fillMultiSelect(
    elements.analysisConflictFilter,
    [
      { value: "conflict", label: "Com conflito" },
      { value: "clear", label: "Sem conflito" }
    ],
    "Todos"
  );
  elements.fromDateInput.min = dateInputValue(state.minTime);
  elements.fromDateInput.max = dateInputValue(state.maxTime);
  elements.toDateInput.min = dateInputValue(state.minTime);
  elements.toDateInput.max = dateInputValue(state.maxTime);
  elements.analysisFromDateInput.min = dateInputValue(state.minTime);
  elements.analysisFromDateInput.max = dateInputValue(state.maxTime);
  elements.analysisToDateInput.min = dateInputValue(state.minTime);
  elements.analysisToDateInput.max = dateInputValue(state.maxTime);
}

function updateMetrics(machines, steps) {
  const conflicts = steps.filter((step) => step.hasConflict).length;
  elements.metricOrders.textContent = machines.length.toLocaleString("pt-BR");
  elements.metricSteps.textContent = steps.length.toLocaleString("pt-BR");
  elements.metricLate.textContent = conflicts.toLocaleString("pt-BR");
  elements.metricRange.textContent =
    steps.length > 0
      ? `${dateShort.format(new Date(state.viewMinTime))} - ${dateShort.format(new Date(state.viewMaxTime))}`
      : "-";
}

function stepMatchesFilters(step, filters) {
  if (!matchesMultiFilter(step.type, filters.type)) return false;
  if (!matchesMultiFilter(step.packref, filters.packref)) return false;
  if (!matchesMultiFilter(step.product, filters.product)) return false;
  if (!matchesMultiFilter(step.resourceSectorId, filters.sector)) return false;
  if (!matchesMultiFilter(step.operation, filters.operation)) return false;
  if (Array.isArray(filters.conflict) && filters.conflict.length > 0) {
    const isConflict = step.hasConflict ? "conflict" : "clear";
    if (!filters.conflict.includes(isConflict)) return false;
  } else if (typeof filters.conflict === "string") {
    if (filters.conflict === "conflict" && !step.hasConflict) return false;
    if (filters.conflict === "clear" && step.hasConflict) return false;
  }
  if (filters.fromTime && step.end < filters.fromTime) return false;
  if (filters.toTime && step.start > filters.toTime) return false;
  return true;
}

function buildRows(machines) {
  const rows = [];
  const currentSector = { id: null };

  for (const machine of machines) {
    if (machine.sectorId !== currentSector.id) {
      currentSector.id = machine.sectorId;
      rows.push({
        kind: "sector",
        key: `sector-${machine.sectorId}`,
        sectorId: machine.sectorId,
        sectorName: machine.sectorName
      });
    }
    rows.push({ kind: "machine", key: `machine-${machine.equipment}`, machine });
  }

  return rows;
}

function applyFilters({ resetScroll = true } = {}) {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filters = {
    type: elements.typeFilter.value,
    packref: elements.packrefFilter.value,
    product: elements.productFilter.value,
    sector: elements.sectorFilter.value,
    operation: elements.operationFilter.value,
    conflict: elements.lateFilter.value,
    fromTime: parseDateInput(elements.fromDateInput.value),
    toTime: parseDateInput(elements.toDateInput.value, true)
  };
  const sort = elements.sortSelect.value;

  state.filteredMachines = state.machineGroups
    .map((machine) => {
      const machineMatchesQuery = Boolean(query) && machine.identitySearchText.includes(query);
      const steps = machine.steps.filter((step) => {
        if (!stepMatchesFilters(step, filters)) return false;
        if (!query || machineMatchesQuery) return true;
        return step.searchText.includes(query);
      });
      if (steps.length === 0) return null;

      const visible = {
        ...machine,
        steps,
        orders: [...new Set(steps.map((step) => step.order))],
        packrefs: [...new Set(steps.map((step) => step.packref))],
        products: [...new Set(steps.map((step) => step.product))],
        types: [...new Set(steps.map((step) => step.type))],
        operations: [...new Set(steps.map((step) => step.operation))],
        start: Math.min(...steps.map((step) => step.start)),
        end: Math.max(...steps.map((step) => step.end)),
        conflictCount: steps.filter((step) => step.hasConflict).length
      };
      visible.hasConflict = visible.conflictCount > 0;
      visible.searchText = [
        visible.equipment,
        visible.equipmentName,
        visible.sectorId,
        visible.sectorName,
        ...visible.orders,
        ...visible.packrefs,
        ...visible.products,
        ...visible.types,
        ...visible.operations,
        ...steps.flatMap((step) => [step.workflow, step.agg, step.packref])
      ]
        .join(" ")
        .toLowerCase();
      return visible;
    })
    .filter(Boolean);

  state.filteredMachines.sort((a, b) => {
    if (sort === "equipment") return Number(a.equipment) - Number(b.equipment);
    if (sort === "start") return a.start - b.start || Number(a.equipment) - Number(b.equipment);
    if (sort === "conflict") return b.conflictCount - a.conflictCount || a.sectorName.localeCompare(b.sectorName, "pt-BR");
    return (
      a.sectorName.localeCompare(b.sectorName, "pt-BR") ||
      Number(a.equipment) - Number(b.equipment) ||
      a.equipmentName.localeCompare(b.equipmentName, "pt-BR")
    );
  });

  const visibleSteps = state.filteredMachines.flatMap((machine) => machine.steps);
  if (visibleSteps.length > 0) {
    const filteredMin = Math.min(...visibleSteps.map((step) => step.start));
    const filteredMax = Math.max(...visibleSteps.map((step) => step.end));
    state.viewMinTime = startOfDay(filters.fromTime || filteredMin);
    state.viewMaxTime = endOfDay(filters.toTime || filteredMax);
  }
  state.rows = buildRows(state.filteredMachines);

  if (state.activeView === "schedule") render({ resetScroll });
}

function setView(view) {
  state.activeView = view;
  elements.scheduleView.hidden = view !== "schedule";
  elements.analysisView.hidden = view !== "analysis";
  elements.scheduleViewButton.classList.toggle("is-active", view === "schedule");
  elements.analysisViewButton.classList.toggle("is-active", view === "analysis");

  if (view === "schedule") {
    render({ resetScroll: false });
    return;
  }

  renderAnalysis();
}

function createAnalysisBucket() {
  return {
    processes: 0,
    orders: new Set(),
    machines: new Set(),
    packrefs: new Set(),
    products: new Set(),
    hours: 0,
    conflicts: 0
  };
}

function addStepToAnalysisBucket(bucket, step) {
  bucket.processes += 1;
  bucket.orders.add(step.order);
  bucket.machines.add(step.equipment);
  bucket.packrefs.add(step.packref);
  bucket.products.add(step.product);
  bucket.hours += Math.max(0, step.end - step.start) / (60 * 60 * 1000);
  if (step.hasConflict) bucket.conflicts += 1;
}

function mergeAnalysisBucket(target, source) {
  target.processes += source.processes;
  source.orders.forEach((value) => target.orders.add(value));
  source.machines.forEach((value) => target.machines.add(value));
  source.packrefs.forEach((value) => target.packrefs.add(value));
  source.products.forEach((value) => target.products.add(value));
  target.hours += source.hours;
  target.conflicts += source.conflicts;
}

function getAnalysisMeasureValue(bucket, measure, context = {}) {
  if (!bucket) return 0;
  if (measure === "orders") return bucket.orders.size;
  if (measure === "machines") return bucket.machines.size;
  if (measure === "packrefs") return bucket.packrefs.size;
  if (measure === "products") return bucket.products.size;
  if (measure === "processes_hours") return bucket.processes;
  if (measure === "utilization") {
    const equipmentCount = context.equipmentCount ?? bucket.machines.size;
    const periodHours = context.periodHours ?? getAnalysisAvailableWindowHours();
    const availableHours = equipmentCount * periodHours;
    return availableHours > 0 ? (bucket.hours / availableHours) * 100 : 0;
  }
  return bucket[measure] || 0;
}

function getAnalysisMeasures(measure) {
  if (measure === "custom") {
    const selected = elements.analysisMeasureToggles
      .filter((input) => input.checked)
      .map((input) => ({
        key: input.dataset.analysisMeasure,
        label: analysisMeasureLabels[input.dataset.analysisMeasure] || input.dataset.analysisMeasure
      }));
    return selected.length > 0 ? selected : [{ key: "processes", label: analysisMeasureLabels.processes }];
  }

  if (measure === "processes_hours") {
    return [
      { key: "processes", label: "Processos" },
      { key: "hours", label: "total de horas" },
      { key: "utilization", label: "Utilizacao" }
    ];
  }
  return [{ key: measure, label: analysisMeasureLabels[measure] || "Valor" }];
}

function getPrimaryAnalysisMeasure(measure) {
  return getAnalysisMeasures(measure)[0]?.key || "processes";
}

function getAnalysisAvailableWindowHours() {
  const fromTime = parseDateInput(elements.analysisFromDateInput.value) || state.minTime;
  const toTime = parseDateInput(elements.analysisToDateInput.value, true) || state.maxTime;
  return Math.max(0, (toTime - fromTime) / (60 * 60 * 1000));
}

function getAnalysisGroupPeriodHours(group, columnDimension, columns) {
  if (columnDimension === "day") return group?.total ? columns.length * 24 : 24;
  return getAnalysisAvailableWindowHours();
}

function getAnalysisEquipmentCountFor(bucket, row, group, rowDimension, columnDimension) {
  if (rowDimension === "sector" && row?.sectorId) {
    return state.sectorEquipmentTotals.get(row.sectorId)?.equipment.size || row.bucket.machines.size;
  }
  if (columnDimension === "sector" && group?.sectorId) {
    return state.sectorEquipmentTotals.get(group.sectorId)?.equipment.size || group.bucket.machines.size;
  }
  return bucket?.machines.size || 0;
}

function getAnalysisDisplayedEquipmentCount(bucket, rows, group, rowDimension, columnDimension) {
  if (rowDimension === "sector") {
    return rows.reduce(
      (total, row) => total + (state.sectorEquipmentTotals.get(row.sectorId)?.equipment.size || row.bucket.machines.size),
      0
    );
  }
  if (columnDimension === "sector" && group?.sectorId) {
    return state.sectorEquipmentTotals.get(group.sectorId)?.equipment.size || group.bucket.machines.size;
  }
  return bucket?.machines.size || 0;
}

function getAnalysisDimensionValue(step, dimension) {
  const fallback = { key: "__empty__", label: "Sem valor" };
  if (dimension === "none") return { key: "__total__", label: "Total" };
  if (dimension === "sector") {
    return {
      key: step.resourceSectorId || fallback.key,
      label: step.resourceSectorName || fallback.label,
      sectorId: step.resourceSectorId || fallback.key,
      sectorName: step.resourceSectorName || fallback.label
    };
  }
  if (dimension === "equipment") {
    return {
      key: step.equipment || fallback.key,
      label: step.equipment ? `${step.equipmentName} (${step.equipment})` : fallback.label
    };
  }
  if (dimension === "type") {
    return {
      key: step.type || fallback.key,
      label: formatType(step.type)
    };
  }
  if (dimension === "day") {
    const time = startOfDay(step.start);
    return {
      key: dateInputValue(time),
      label: dateFull.format(new Date(time))
    };
  }

  const raw = step[dimension];
  if (raw === undefined || raw === null || raw === "") return fallback;
  return { key: String(raw), label: String(raw) };
}

function getAnalysisFilters() {
  return {
    type: getMultiSelectValues(elements.analysisTypeFilter),
    packref: getMultiSelectValues(elements.analysisPackrefFilter),
    product: getMultiSelectValues(elements.analysisProductFilter),
    sector: getMultiSelectValues(elements.analysisSectorFilter),
    operation: getMultiSelectValues(elements.analysisOperationFilter),
    conflict: getMultiSelectValues(elements.analysisConflictFilter),
    fromTime: parseDateInput(elements.analysisFromDateInput.value),
    toTime: parseDateInput(elements.analysisToDateInput.value, true)
  };
}

function getAnalysisFilteredItems() {
  const query = elements.analysisSearchInput.value.trim().toLowerCase();
  const filters = getAnalysisFilters();
  return state.items.filter((step) => stepMatchesFilters(step, filters) && (!query || step.searchText.includes(query)));
}

function sortAnalysisEntries(entries, measure, sortMode) {
  return entries.sort((a, b) => {
    if (sortMode === "label") {
      return a.label.localeCompare(b.label, "pt-BR", { numeric: true }) || a.key.localeCompare(b.key, "pt-BR");
    }
    const valueDelta = getAnalysisMeasureValue(b.bucket, measure) - getAnalysisMeasureValue(a.bucket, measure);
    return valueDelta || a.label.localeCompare(b.label, "pt-BR", { numeric: true });
  });
}

function buildAnalysisPivot(items) {
  const rowDimension = elements.analysisRowSelect.value;
  const columnDimension = elements.analysisColumnSelect.value;
  const measure = elements.analysisMeasureSelect.value;
  const primaryMeasure = getPrimaryAnalysisMeasure(measure);
  const sortMode = elements.analysisSortSelect.value;
  const rowMap = new Map();
  const columnMap = new Map();
  const grandTotal = createAnalysisBucket();

  for (const step of items) {
    const rowDimensionValue = getAnalysisDimensionValue(step, rowDimension);
    const columnDimensionValue = getAnalysisDimensionValue(step, columnDimension);

    if (!rowMap.has(rowDimensionValue.key)) {
      rowMap.set(rowDimensionValue.key, {
        key: rowDimensionValue.key,
        label: rowDimensionValue.label,
        sectorId: rowDimensionValue.sectorId,
        sectorName: rowDimensionValue.sectorName,
        bucket: createAnalysisBucket(),
        cells: new Map()
      });
    }

    if (!columnMap.has(columnDimensionValue.key)) {
      columnMap.set(columnDimensionValue.key, {
        key: columnDimensionValue.key,
        label: columnDimensionValue.label,
        sectorId: columnDimensionValue.sectorId,
        sectorName: columnDimensionValue.sectorName,
        bucket: createAnalysisBucket()
      });
    }

    const row = rowMap.get(rowDimensionValue.key);
    if (!row.cells.has(columnDimensionValue.key)) row.cells.set(columnDimensionValue.key, createAnalysisBucket());

    addStepToAnalysisBucket(row.bucket, step);
    addStepToAnalysisBucket(row.cells.get(columnDimensionValue.key), step);
    addStepToAnalysisBucket(columnMap.get(columnDimensionValue.key).bucket, step);
    addStepToAnalysisBucket(grandTotal, step);
  }

  if (rowDimension === "sector") {
    rowMap.forEach((row) => {
      row.label = formatSectorEquipmentLabel(row.sectorName, row.sectorId, row.bucket.machines.size);
    });
  }

  if (columnDimension === "sector") {
    columnMap.forEach((column) => {
      column.label = formatSectorEquipmentLabel(column.sectorName, column.sectorId, column.bucket.machines.size);
    });
  }

  const rows = sortAnalysisEntries([...rowMap.values()], primaryMeasure, sortMode);
  const columns = [...columnMap.values()].sort((a, b) => {
    if (columnDimension === "day") return a.key.localeCompare(b.key);
    return a.label.localeCompare(b.label, "pt-BR", { numeric: true }) || a.key.localeCompare(b.key, "pt-BR");
  });

  return { rows, columns, grandTotal, rowDimension, columnDimension, measure };
}

function limitAnalysisRows(rows) {
  const limit = elements.analysisLimitSelect.value;
  if (limit === "all") return rows;
  return rows.slice(0, Number(limit));
}

function updateAnalysisMetrics(items, grandTotal) {
  elements.analysisMetricSteps.textContent = formatNumber(items.length);
  elements.analysisMetricOrders.textContent = formatNumber(grandTotal.orders.size);
  elements.analysisMetricMachines.textContent = formatNumber(grandTotal.machines.size);
  elements.analysisMetricHours.textContent = formatMeasure(grandTotal.hours, "hours");
}

function renderAnalysisTable({ rows, columns, grandTotal, rowDimension, columnDimension, measure, totalRows }) {
  const table = elements.pivotTable;
  const hasColumnDimension = columnDimension !== "none";
  const measures = getAnalysisMeasures(measure);
  const groups = hasColumnDimension ? [{ key: "__row_total__", label: "total", total: true }, ...columns] : [];
  const exportHeaderGroups = [analysisDimensionLabels[rowDimension] || "Linha"];
  const exportHeaderMeasures = [""];
  const thead = document.createElement("thead");
  const groupHeaderRow = document.createElement("tr");
  const measureHeaderRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "pivot-corner";
  corner.rowSpan = hasColumnDimension ? 2 : 1;
  corner.textContent = analysisDimensionLabels[rowDimension] || "Linha";
  groupHeaderRow.append(corner);

  if (hasColumnDimension) {
    groups.forEach((group) => {
      const th = document.createElement("th");
      th.colSpan = measures.length;
      th.className = group.total ? "pivot-group is-total-column" : "pivot-group";
      th.textContent = group.label;
      th.title = group.label;
      groupHeaderRow.append(th);
      measures.forEach((item) => {
        const measureTh = document.createElement("th");
        measureTh.className = group.total ? "is-total-column" : "";
        measureTh.textContent = item.label;
        measureTh.title = item.label;
        measureHeaderRow.append(measureTh);
        exportHeaderGroups.push(group.label);
        exportHeaderMeasures.push(item.label);
      });
    });
    thead.append(groupHeaderRow, measureHeaderRow);
  } else {
    measures.forEach((item) => {
      const th = document.createElement("th");
      th.rowSpan = 2;
      th.textContent = item.label;
      th.title = item.label;
      groupHeaderRow.append(th);
      exportHeaderGroups.push(item.label);
      exportHeaderMeasures.push("");
    });
    thead.append(groupHeaderRow);
  }

  const exportRows = [exportHeaderGroups, exportHeaderMeasures];

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("td");
    const exportRow = [row.label];
    labelCell.textContent = row.label;
    labelCell.title = row.label;
    tr.append(labelCell);

    if (hasColumnDimension) {
      groups.forEach((group) => {
        const bucket = group.total ? row.bucket : row.cells.get(group.key);
        const context = {
          equipmentCount: getAnalysisEquipmentCountFor(bucket, row, group, rowDimension, columnDimension),
          periodHours: getAnalysisGroupPeriodHours(group, columnDimension, columns)
        };
        measures.forEach((item) => {
          const value = getAnalysisMeasureValue(bucket, item.key, context);
          const cell = document.createElement("td");
          cell.textContent = formatMeasure(value, item.key);
          if (group.total) cell.classList.add("is-total-column");
          if (value === 0) cell.classList.add("is-zero");
          tr.append(cell);
          exportRow.push(value);
        });
      });
    } else {
      const context = {
        equipmentCount: getAnalysisEquipmentCountFor(row.bucket, row, null, rowDimension, columnDimension),
        periodHours: getAnalysisAvailableWindowHours()
      };
      measures.forEach((item) => {
        const value = getAnalysisMeasureValue(row.bucket, item.key, context);
        const cell = document.createElement("td");
        cell.textContent = formatMeasure(value, item.key);
        if (value === 0) cell.classList.add("is-zero");
        tr.append(cell);
        exportRow.push(value);
      });
    }

    tbody.append(tr);
    exportRows.push(exportRow);
  });

  const tfoot = document.createElement("tfoot");
  const totalRow = document.createElement("tr");
  totalRow.className = "is-total-row";
  const totalLabel = document.createElement("td");
  totalLabel.textContent = rows.length === totalRows ? "Total" : "Total exibido";
  totalRow.append(totalLabel);
  const exportTotalRow = [totalLabel.textContent];
  const displayedTotalBucket = createAnalysisBucket();
  rows.forEach((row) => mergeAnalysisBucket(displayedTotalBucket, row.bucket));

  if (hasColumnDimension) {
    groups.forEach((group) => {
      let bucket = displayedTotalBucket;
      if (!group.total) {
        bucket = createAnalysisBucket();
        rows.forEach((row) => {
          const cell = row.cells.get(group.key);
          if (cell) mergeAnalysisBucket(bucket, cell);
        });
      }
      const context = {
        equipmentCount: getAnalysisDisplayedEquipmentCount(bucket, rows, group, rowDimension, columnDimension),
        periodHours: getAnalysisGroupPeriodHours(group, columnDimension, columns)
      };
      measures.forEach((item) => {
        const value = getAnalysisMeasureValue(bucket, item.key, context);
        const totalCell = document.createElement("td");
        if (group.total) totalCell.classList.add("is-total-column");
        totalCell.textContent = formatMeasure(value, item.key);
        totalRow.append(totalCell);
        exportTotalRow.push(value);
      });
    });
  } else {
    const context = {
      equipmentCount: getAnalysisDisplayedEquipmentCount(
        rows.length === totalRows ? grandTotal : displayedTotalBucket,
        rows,
        null,
        rowDimension,
        columnDimension
      ),
      periodHours: getAnalysisAvailableWindowHours()
    };
    measures.forEach((item) => {
      const value = getAnalysisMeasureValue(
        rows.length === totalRows ? grandTotal : displayedTotalBucket,
        item.key,
        context
      );
      const totalCell = document.createElement("td");
      totalCell.className = "is-total-column";
      totalCell.textContent = formatMeasure(value, item.key);
      totalRow.append(totalCell);
      exportTotalRow.push(value);
    });
  }
  tfoot.append(totalRow);
  exportRows.push(exportTotalRow);

  table.replaceChildren(thead, tbody, tfoot);
  state.analysisExport = {
    filename: `analise-${rowDimension}-por-${columnDimension}-${measure}.csv`,
    rows: exportRows
  };
}

function renderAnalysis() {
  if (!state.items.length) {
    setAnalysisVisibility({ loading: true });
    return;
  }

  const items = getAnalysisFilteredItems();
  const pivot = buildAnalysisPivot(items);
  updateAnalysisMetrics(items, pivot.grandTotal);

  if (items.length === 0 || pivot.rows.length === 0) {
    state.analysisExport = null;
    setAnalysisVisibility({ empty: true });
    return;
  }

  const visibleRows = limitAnalysisRows(pivot.rows);
  setAnalysisVisibility();
  renderAnalysisTable({ ...pivot, rows: visibleRows, totalRows: pivot.rows.length });

  const rowLabel = analysisDimensionLabels[pivot.rowDimension] || "Linha";
  const columnLabel = pivot.columnDimension === "none" ? "sem coluna" : analysisDimensionLabels[pivot.columnDimension];
  const measureLabel = getAnalysisMeasures(pivot.measure)
    .map((item) => item.label)
    .join(", ");
  elements.analysisCaption.textContent = `${measureLabel} por ${rowLabel} x ${columnLabel} | ${formatNumber(
    visibleRows.length
  )} de ${formatNumber(pivot.rows.length)} linhas | ${formatNumber(items.length)} processos filtrados`;
}

function exportAnalysisCsv() {
  if (!state.analysisExport) return;
  const csv = state.analysisExport.rows.map((row) => row.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.analysisExport.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function timeToPx(time) {
  return ((time - state.viewMinTime) / MS_PER_DAY) * state.dayWidth;
}

function getTimelineViewportWidth() {
  return Math.max(1, elements.gantt.clientWidth - getLabelWidth());
}

function shouldRenderHourlyAxis() {
  return getTimelineViewportWidth() / state.dayWidth <= 2.05;
}

function buildHatchedDayIndexes(steps) {
  const eventDays = new Set();

  steps.forEach((step) => {
    [step.start, step.end].forEach((time) => {
      const dayIndex = Math.floor((startOfDay(time) - state.viewMinTime) / MS_PER_DAY);
      if (dayIndex >= 0 && dayIndex < state.totalDays) eventDays.add(dayIndex);
    });
  });

  const hatched = new Set();
  for (let day = 0; day < state.totalDays; day += 1) {
    if (!eventDays.has(day)) hatched.add(day);
  }
  return hatched;
}

function renderDayAxis(totalDays) {
  const fragment = document.createDocumentFragment();

  for (let day = 0; day < totalDays; day += 1) {
    const time = state.viewMinTime + day * MS_PER_DAY;
    const date = new Date(time);
    const tick = document.createElement("div");
    tick.className = "axis-day";
    if (date.getDay() === 0 || date.getDay() === 6) tick.classList.add("is-weekend");
    if (state.hatchedDayIndexes.has(day)) tick.classList.add("is-hatched");
    tick.innerHTML = `<strong>${dateShort.format(date)}</strong><br>${date.toLocaleDateString("pt-BR", {
      weekday: "short"
    })}`;
    fragment.append(tick);
  }

  elements.axis.replaceChildren(fragment);
}

function renderHourlyAxis(totalDays) {
  const fragment = document.createDocumentFragment();

  for (let day = 0; day < totalDays; day += 1) {
    const dayTime = state.viewMinTime + day * MS_PER_DAY;
    const dayDate = new Date(dayTime);

    for (let hour = 0; hour < 24; hour += 1) {
      const tick = document.createElement("div");
      tick.className = "axis-hour";
      if (hour === 0) tick.classList.add("is-day-start");
      if (state.hatchedDayIndexes.has(day)) tick.classList.add("is-hatched");

      if (hour === 0) {
        const date = document.createElement("span");
        date.className = "axis-hour-date";
        date.textContent = dateShort.format(dayDate);
        tick.append(date);
      }

      tick.append(`${String(hour).padStart(2, "0")}h`);
      fragment.append(tick);
    }
  }

  elements.axis.replaceChildren(fragment);
}

function renderAxis(totalDays) {
  const hourly = shouldRenderHourlyAxis();
  elements.axis.classList.toggle("is-hourly", hourly);
  elements.timeline.classList.toggle("is-hourly", hourly);

  if (hourly) {
    renderHourlyAxis(totalDays);
    return;
  }

  renderDayAxis(totalDays);
}

function routeSummary(step) {
  return state.routesByPackref.get(step.packref) || "-";
}

function stepTitle(step) {
  const conflicts =
    step.conflictWith.length > 0 ? [`Conflito com pedido(s): ${[...new Set(step.conflictWith)].join(", ")}`] : [];

  return [
    `Pedido ${step.order}`,
    `Produto ${step.product}`,
    `Tipo ${step.type}`,
    `Packref ${step.packref}`,
    `Agg ${step.agg}`,
    `Workflow ${step.workflow}`,
    `Operacao ${step.operation}`,
    `Setor ${step.resourceSectorName} (${step.resourceSectorId})`,
    `Equipamento ${step.equipmentName} (${step.equipment})`,
    `Inicio ${dateTime.format(new Date(step.start))}`,
    `Fim ${dateTime.format(new Date(step.end))}`,
    `Duracao ${formatDuration(step.end - step.start)}`,
    `Entrega ${Number.isFinite(step.deadline) ? dateTime.format(new Date(step.deadline)) : "-"}`,
    ...conflicts,
    "",
    "Roteiro do packref:",
    routeSummary(step)
  ].join("\n");
}

function createBar(step) {
  const left = timeToPx(step.start);
  const width = Math.max(3, timeToPx(step.end) - left);
  const bar = document.createElement("div");
  bar.className = `bar${step.type === "packaging" ? " is-packaging" : ""}${step.hasConflict ? " has-conflict" : ""}`;
  bar.style.setProperty("--bar-color", step.color);
  bar.style.setProperty("--bar-left", `${left}px`);
  bar.style.setProperty("--bar-width", `${width}px`);
  bar.dataset.tooltip = stepTitle(step);
  bar.tabIndex = 0;

  const label = document.createElement("span");
  label.className = "bar-label";
  label.textContent = `Pack ${step.packref} - Ped ${step.order}`;
  bar.append(label);
  return bar;
}

function getRowHeight() {
  const value = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--row-height"), 10);
  return Number.isFinite(value) ? value : 46;
}

function getLabelWidth() {
  const value = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--label-width"), 10);
  return Number.isFinite(value) ? value : 310;
}

function updateDayWidthForVisibleDays() {
  const timelineViewportWidth = getTimelineViewportWidth();
  const visibleDays = Number(elements.visibleDaysSelect.value) || 7;
  state.dayWidth = Math.max(18, Math.floor(timelineViewportWidth / visibleDays));
}

function getVirtualWindow() {
  const overscan = 10;
  const total = state.rows.length;
  const start = Math.max(0, Math.floor(elements.gantt.scrollTop / state.rowHeight) - overscan);
  const visibleCount = Math.ceil(elements.gantt.clientHeight / state.rowHeight) + overscan * 2;
  const end = Math.min(total, start + visibleCount);
  return { start, end };
}

function renderLabels(rows, offset) {
  const fragment = document.createDocumentFragment();

  rows.forEach((rowData, index) => {
    if (rowData.kind === "sector") {
      const row = document.createElement("div");
      row.className = "sector-row label-row";
      row.style.setProperty("--row-top", `${(offset + index) * state.rowHeight}px`);
      row.textContent = `${rowData.sectorName} (${rowData.sectorId})`;
      fragment.append(row);
      return;
    }

    const machine = rowData.machine;
    const row = document.createElement("div");
    row.className = "label-row";
    row.style.setProperty("--row-top", `${(offset + index) * state.rowHeight}px`);

    const main = document.createElement("div");
    main.className = "label-main";
    main.textContent = machine.equipmentName;

    const sub = document.createElement("div");
    sub.className = "label-sub";
    sub.textContent = `${machine.steps.length} proc. | ${machine.orders.length} pedidos | ${machine.packrefs.length} packrefs`;

    row.append(main, sub);
    if (machine.hasConflict) {
      const conflict = document.createElement("span");
      conflict.className = "conflict-pill";
      conflict.textContent = `${machine.conflictCount} conf.`;
      row.append(conflict);
    }
    fragment.append(row);
  });

  elements.labels.replaceChildren(fragment);
}

function renderRows(rows, offset) {
  const fragment = document.createDocumentFragment();
  const totalHeight = state.rows.length * state.rowHeight;

  state.hatchedDayIndexes.forEach((day) => {
    const dayStart = state.viewMinTime + day * MS_PER_DAY;
    const dayEnd = Math.min(dayStart + MS_PER_DAY, state.viewMaxTime);
    const left = timeToPx(dayStart);
    const width = Math.max(1, timeToPx(dayEnd) - left);
    const band = document.createElement("div");
    band.className = "timeline-hatched-day";
    band.style.setProperty("--hatched-left", `${left}px`);
    band.style.setProperty("--hatched-width", `${width}px`);
    band.style.setProperty("--hatched-height", `${totalHeight}px`);
    fragment.append(band);
  });

  rows.forEach((rowData, index) => {
    const row = document.createElement("div");
    row.className = rowData.kind === "sector" ? "time-row sector-time-row" : "time-row";
    row.style.setProperty("--row-top", `${(offset + index) * state.rowHeight}px`);

    if (rowData.kind === "machine") {
      rowData.machine.steps.forEach((step) => row.append(createBar(step)));
    }

    fragment.append(row);
  });

  elements.timeline.replaceChildren(fragment);
}

function renderVirtualRows({ force = false } = {}) {
  if (elements.gantt.hidden || state.rows.length === 0) return;

  state.rowHeight = getRowHeight();
  const { start, end } = getVirtualWindow();
  if (!force && start === state.virtualStart && end === state.virtualEnd) return;

  state.virtualStart = start;
  state.virtualEnd = end;
  const slice = state.rows.slice(start, end);
  const totalHeight = state.rows.length * state.rowHeight;
  elements.labels.style.height = `${totalHeight}px`;
  elements.timeline.style.height = `${totalHeight}px`;
  renderLabels(slice, start);
  renderRows(slice, start);
}

function render({ resetScroll = false } = {}) {
  const steps = state.filteredMachines.flatMap((machine) => machine.steps);

  if (state.rows.length === 0) {
    updateMetrics([], []);
    setVisibility({ empty: true });
    return;
  }

  setVisibility();
  updateDayWidthForVisibleDays();
  state.totalDays = Math.max(1, Math.ceil((state.viewMaxTime - state.viewMinTime) / MS_PER_DAY));
  const timelineWidth = state.totalDays * state.dayWidth;

  document.documentElement.style.setProperty("--day-width", `${state.dayWidth}px`);
  document.documentElement.style.setProperty("--timeline-width", `${timelineWidth}px`);
  updateMetrics(state.filteredMachines, steps);
  state.hatchedDayIndexes = buildHatchedDayIndexes(steps);
  renderAxis(state.totalDays);
  elements.timeline.style.minWidth = `${timelineWidth}px`;
  if (resetScroll) elements.gantt.scrollTop = 0;
  state.virtualStart = -1;
  state.virtualEnd = -1;
  renderVirtualRows({ force: true });
}

async function loadConfig() {
  const response = await fetch("/api/config", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`API de configuracao retornou HTTP ${response.status}`);
  return response.json();
}

async function loadData(snapId = state.snapId) {
  setVisibility({ loading: true });
  setAnalysisVisibility({ loading: true });
  elements.refreshButton.disabled = true;

  try {
    const currentSnapId = String(snapId || "").trim();
    if (currentSnapId) syncSnapUi(currentSnapId);

    const [snapResponse, resourceResponse] = await Promise.all([
      fetch(
        `/api/snap?page=1&size=9999${currentSnapId ? `&snapId=${encodeURIComponent(currentSnapId)}` : ""}`,
        { headers: { accept: "application/json" } }
      ),
      fetch("/api/resources", { headers: { accept: "application/json" } })
    ]);
    if (!snapResponse.ok) throw new Error(`API de agenda retornou HTTP ${snapResponse.status}`);
    if (!resourceResponse.ok) throw new Error(`API de maquinas retornou HTTP ${resourceResponse.status}`);

    const [payload, resourcesPayload] = await Promise.all([snapResponse.json(), resourceResponse.json()]);
    const resources = resourcesPayload.map((resource) => normalizeResource(resource));
    state.resources = new Map(resources.map((item) => [item.id, item]));

    const items = getItems(payload, state.resources);
    if (items.length === 0) throw new Error("A API retornou uma agenda vazia.");

    state.snapshot = payload;
    state.items = items;
    state.sectorEquipmentTotals = buildSectorEquipmentTotals(items);
    state.routesByPackref = buildRoutesByPackref(items);
    state.machineGroups = buildMachineGroups(items);
    state.minTime = startOfDay(Math.min(...items.map((item) => item.start)));
    state.maxTime = endOfDay(Math.max(...items.map((item) => item.end)));
    state.viewMinTime = state.minTime;
    state.viewMaxTime = state.maxTime;

    syncSnapUi(currentSnapId || payload?._id || state.snapId);
    updateSnapshotName(payload, items);

    setupFilterOptions(items, state.machineGroups);
    applyFilters();
    renderAnalysis();
  } catch (error) {
    setVisibility({ error: error.message });
    setAnalysisVisibility({ error: error.message });
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function debounce(callback, delay = 180) {
  let timeout;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), delay);
  };
}

const debouncedFilters = debounce(() => applyFilters());
const debouncedAnalysis = debounce(() => renderAnalysis());

elements.scheduleViewButton.addEventListener("click", () => setView("schedule"));
elements.analysisViewButton.addEventListener("click", () => setView("analysis"));
elements.searchInput.addEventListener("input", debouncedFilters);
[
  elements.typeFilter,
  elements.packrefFilter,
  elements.productFilter,
  elements.sectorFilter,
  elements.operationFilter,
  elements.lateFilter,
  elements.fromDateInput,
  elements.toDateInput,
  elements.sortSelect
].forEach((element) => element.addEventListener("change", () => applyFilters()));
elements.analysisSearchInput.addEventListener("input", debouncedAnalysis);
[
  elements.analysisRowSelect,
  elements.analysisColumnSelect,
  elements.analysisMeasureSelect,
  elements.analysisFromDateInput,
  elements.analysisToDateInput,
  elements.analysisSortSelect,
  elements.analysisLimitSelect
].forEach((element) => element.addEventListener("change", () => renderAnalysis()));
elements.analysisMeasureToggles.forEach((element) => element.addEventListener("change", () => renderAnalysis()));
elements.analysisExportButton.addEventListener("click", exportAnalysisCsv);
elements.visibleDaysSelect.addEventListener("change", () => {
  render({ resetScroll: false });
});
elements.snapIdInput.addEventListener("input", (event) => {
  syncSnapUi(event.target.value.trim());
});
elements.snapIdInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  loadData(elements.snapIdInput.value.trim());
});
elements.refreshButton.addEventListener("click", () => loadData(elements.snapIdInput.value.trim()));
elements.gantt.addEventListener("scroll", () => {
  if (state.scrollFrame) return;
  state.scrollFrame = window.requestAnimationFrame(() => {
    state.scrollFrame = 0;
    renderVirtualRows();
  });
});
elements.timeline.addEventListener("pointerover", (event) => {
  const bar = event.target.closest(".bar");
  if (!bar) return;
  elements.tooltip.textContent = bar.dataset.tooltip || "";
  elements.tooltip.hidden = false;
});
elements.timeline.addEventListener("pointermove", (event) => {
  if (elements.tooltip.hidden) return;
  const offset = 14;
  const tooltipRect = elements.tooltip.getBoundingClientRect();
  const left = Math.min(event.clientX + offset, window.innerWidth - tooltipRect.width - offset);
  const top = Math.min(event.clientY + offset, window.innerHeight - tooltipRect.height - offset);
  elements.tooltip.style.setProperty("--tooltip-left", `${Math.max(offset, left)}px`);
  elements.tooltip.style.setProperty("--tooltip-top", `${Math.max(offset, top)}px`);
});
elements.timeline.addEventListener("pointerout", (event) => {
  const bar = event.target.closest(".bar");
  if (!bar || bar.contains(event.relatedTarget)) return;
  elements.tooltip.hidden = true;
});
elements.timeline.addEventListener("focusin", (event) => {
  const bar = event.target.closest(".bar");
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  elements.tooltip.textContent = bar.dataset.tooltip || "";
  elements.tooltip.hidden = false;
  elements.tooltip.style.setProperty("--tooltip-left", `${Math.max(14, Math.min(rect.left, window.innerWidth - 520))}px`);
  elements.tooltip.style.setProperty("--tooltip-top", `${Math.max(14, Math.min(rect.bottom + 8, window.innerHeight - 220))}px`);
});
elements.timeline.addEventListener("focusout", (event) => {
  if (!event.target.closest(".bar")) return;
  elements.tooltip.hidden = true;
});
window.addEventListener(
  "resize",
  debounce(() => {
    if (state.activeView === "schedule") {
      render({ resetScroll: false });
      return;
    }
    renderAnalysis();
  }, 120)
);

loadConfig()
  .then((config) => {
    syncSnapUi(config.snapId || "");
    return loadData(config.snapId);
  })
  .catch(() => {
    syncSnapUi("");
    loadData();
  });
