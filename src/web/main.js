import { buildReportFromRun, listPlayers, parseRunText } from '../core/report.js';
import { detectLocale, formatDuration, formatStartTime, getResultLabel, resolveLocale, t } from '../core/i18n.js';
import { renderApp } from './render.js';

const app = document.getElementById('app');
const fileInput = document.getElementById('fileInput');
const directoryInput = document.getElementById('directoryInput');
const preloadThemes = ['ironclad', 'silent', 'defect', 'necrobinder', 'regent'];

const state = {
  locale: detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language]),
  fileName: '',
  run: null,
  playerId: null,
  loading: false,
  dragActive: false,
  error: '',
  report: null,
  text: {},
  copyMessage: '',
  historyPath: '',
  preloadTheme: preloadThemes[Math.floor(Math.random() * preloadThemes.length)],
  selectedFloor: null,
  floorMenuOpen: false,
  runEntries: [],
  activeRunId: '',
  sourceSupported: false,
  canChooseDirectory: false,
  canDropDirectory: false,
};

let dragDepth = 0;
let copyTimer = 0;

function detectPlatformPath() {
  const platform = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '').toLowerCase();
  if (platform.includes('win')) return t(state.locale, 'sourceHintWindows').replace(/^Windows:\s*/i, '');
  if (platform.includes('mac')) return t(state.locale, 'sourceHintMac').replace(/^macOS:\s*/i, '');
  return t(state.locale, 'sourceHintLinux').replace(/^Linux \/ Steam Deck:\s*/i, '');
}

function detectSourceSupport() {
  state.canChooseDirectory = typeof window.showDirectoryPicker === 'function' || 'webkitdirectory' in directoryInput;
  state.canDropDirectory = typeof DataTransferItem !== 'undefined' && typeof DataTransferItem.prototype?.getAsFileSystemHandle === 'function';
  state.sourceSupported = state.canChooseDirectory || state.canDropDirectory;
}

function syncText() {
  detectSourceSupport();
  state.text = {
    changeFile: t(state.locale, 'changeFile'),
    loadFailed: t(state.locale, 'loadFailed'),
    savePath: t(state.locale, 'savePath'),
    copyPath: t(state.locale, 'copyPath'),
    copied: t(state.locale, 'copied'),
    uploadCta: t(state.locale, 'uploadCta'),
    uploadDropCta: t(state.locale, 'uploadDropCta'),
    chooseDirectory: t(state.locale, 'chooseDirectory'),
    chooseRunFile: t(state.locale, 'chooseRunFile'),
    scanResults: t(state.locale, 'scanResults'),
    runListTitle: t(state.locale, 'runListTitle'),
    sourceHint: t(state.locale, state.sourceSupported ? 'sourceSupported' : 'sourceUnsupported'),
    scanFailed: t(state.locale, 'scanFailed'),
    openRunList: t(state.locale, 'openRunList'),
    noSupportedDrop: t(state.locale, 'noSupportedDrop'),
    floorShort: t(state.locale, 'floorShort'),
    loading: t(state.locale, 'loading'),
    previousFloor: t(state.locale, 'previousFloor'),
    nextFloor: t(state.locale, 'nextFloor'),
  };
  state.historyPath = detectPlatformPath();
}

function setDragActive(active) {
  if (state.dragActive === active) return;
  state.dragActive = active;
  render();
}

function clearCopyMessage() {
  if (copyTimer) window.clearTimeout(copyTimer);
  state.copyMessage = '';
}

async function copyHistoryPath() {
  try {
    await navigator.clipboard.writeText(state.historyPath);
    state.copyMessage = state.text.copied;
    render();
    clearCopyMessage();
    copyTimer = window.setTimeout(() => {
      state.copyMessage = '';
      render();
    }, 1600);
  } catch {
    state.copyMessage = '';
  }
}

function toPrettyFallback(value) {
  const raw = String(value || '').replace(/^[A-Z_]+\./, '').toUpperCase();
  if (!raw) return '';
  return raw
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function localizeRunEntry(entry) {
  const players = listPlayers(entry.run);
  const lead = toPrettyFallback(players[0]?.character);
  const extraPlayers = players.length > 1 ? ` +${players.length - 1}` : '';
  return {
    ...entry,
    title: `${lead || entry.name}${extraPlayers}`,
    resultLabel: getResultLabel(state.locale, entry.run),
    resultTone: entry.run.was_abandoned ? 'muted' : entry.run.win ? 'success' : 'danger',
    metaLine: [
      formatDuration(entry.run.run_time || 0, state.locale),
      formatStartTime(entry.run.start_time || 0, state.locale),
      entry.run.build_id || t(state.locale, 'unknown'),
    ].join(' · '),
  };
}

function refreshRunEntriesLocale() {
  state.runEntries = state.runEntries.map(localizeRunEntry);
}

function bindChartInteractions() {
  if (!state.report) return;
  app.querySelectorAll('[data-chart-id]').forEach(element => {
    const chart = state.report.charts.find(item => item.id === element.dataset.chartId);
    if (!chart) return;
    const svg = element.querySelector('svg');
    const hitbox = element.querySelector('.chart-hitbox');
    const tooltip = element.querySelector('.chart-tooltip');
    const wrap = element.querySelector('.chart-wrap');
    const hoverLine = element.querySelector('.chart-hover-line');
    const hoverDots = Array.from(element.querySelectorAll('.chart-hover-dot'));
    if (!svg || !hitbox || !tooltip || !wrap || !hoverLine || !hoverDots.length) return;
    const viewBox = svg.viewBox.baseVal;
    const left = Number(hitbox.getAttribute('x'));
    const width = Number(hitbox.getAttribute('width'));
    const top = Number(hitbox.getAttribute('y'));
    const height = Number(hitbox.getAttribute('height'));
    const right = viewBox.width - left - width;
    const bottom = viewBox.height - top - height;
    const allPoints = chart.series.flatMap(series => series.points);
    const maxFloor = Math.max(...allPoints.map(point => point.x));
    const minY = Number.isFinite(chart.yMin) ? chart.yMin : Math.min(...allPoints.map(point => point.y));
    const maxY = Math.max(...allPoints.map(point => point.y));
    const xScale = value => left + (maxFloor === 0 ? 0 : (value / maxFloor) * (viewBox.width - left - right));
    const yScale = value => viewBox.height - bottom - ((value - minY) / Math.max(maxY - minY, 1)) * (viewBox.height - top - bottom);
    const setTooltip = (floorValue, clientX, clientY) => {
      const nearestSeries = chart.series.map(series => {
        const point = series.points.reduce((best, current) => {
          if (!best) return current;
          return Math.abs(current.x - floorValue) < Math.abs(best.x - floorValue) ? current : best;
        }, null);
        return { ...series, point };
      });
      const currentFloor = nearestSeries[0]?.point?.x ?? 0;
      hoverLine.setAttribute('x1', xScale(currentFloor));
      hoverLine.setAttribute('x2', xScale(currentFloor));
      hoverDots.forEach((dot, index) => {
        const point = nearestSeries[index]?.point;
        if (!point) return;
        dot.setAttribute('cx', xScale(point.x));
        dot.setAttribute('cy', yScale(point.y));
      });
      tooltip.hidden = false;
      const body = chart.id === 'hp'
        ? `
          <div class="tooltip-value">
            💗
            <span class="tooltip-current" style="color:${nearestSeries[1]?.color || '#ffd180'}">${nearestSeries[1]?.point?.y ?? ''}</span>
            <span class="tooltip-slash">/</span>
            <span class="tooltip-max" style="color:${nearestSeries[0]?.color || '#ff8a80'}">${nearestSeries[0]?.point?.y ?? ''}</span>
          </div>
        `
        : `
          <div class="tooltip-value" style="color:${nearestSeries[0]?.color || '#80d8ff'}">
            🃏 ${nearestSeries[0]?.point?.y ?? ''}
          </div>
        `;
      tooltip.innerHTML = `
        <div class="tooltip-floor">${state.text.floorShort}${currentFloor}</div>
        ${body}
      `;
      const wrapRect = wrap.getBoundingClientRect();
      const rawX = clientX - wrapRect.left + 14;
      const rawY = clientY - wrapRect.top - tooltip.offsetHeight - 10;
      const maxX = Math.max(8, wrap.clientWidth - tooltip.offsetWidth - 8);
      const maxY = Math.max(8, wrap.clientHeight - tooltip.offsetHeight - 8);
      const x = Math.min(Math.max(8, rawX), maxX);
      const y = Math.min(Math.max(8, rawY), maxY);
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    };
    const handlePointer = event => {
      const rect = svg.getBoundingClientRect();
      const ratio = viewBox.width / rect.width;
      const x = (event.clientX - rect.left) * ratio;
      const floorValue = Math.max(0, Math.min(maxFloor, Math.round(((x - left) / Math.max(width, 1)) * maxFloor)));
      setTooltip(floorValue, event.clientX, event.clientY);
    };
    hitbox.addEventListener('pointermove', handlePointer);
    hitbox.addEventListener('pointerenter', handlePointer);
    hitbox.addEventListener('pointerleave', () => {
      tooltip.hidden = true;
    });
  });
}

function applyTheme() {
  document.documentElement.lang = state.locale === 'zh' ? 'zh' : 'en';
  document.documentElement.dataset.characterTheme = state.report?.themeCharacter || state.preloadTheme;
}

function render() {
  syncText();
  applyTheme();
  app.innerHTML = renderApp(state);
  bindChartInteractions();
}

async function rebuildReport() {
  if (!state.run) {
    state.report = null;
    render();
    return;
  }
  state.loading = true;
  state.error = '';
  render();
  try {
    state.report = await buildReportFromRun(state.run, {
      locale: state.locale,
      playerSelector: state.playerId,
      fileLabel: state.fileName,
    });
    state.floorMenuOpen = false;
    const floorNumbers = state.report.floorDetails.map(item => item.floor);
    if (!floorNumbers.includes(state.selectedFloor)) {
      state.selectedFloor = floorNumbers[floorNumbers.length - 1] || null;
    }
  } catch (error) {
    state.report = null;
    state.error = error.message || String(error);
  } finally {
    state.loading = false;
    render();
  }
}

async function selectRunEntry(entryId) {
  const entry = state.runEntries.find(item => item.id === entryId);
  if (!entry) return;
  state.activeRunId = entry.id;
  state.run = entry.run;
  state.fileName = entry.pathLabel;
  state.playerId = listPlayers(entry.run)[0]?.id || null;
  await rebuildReport();
}

function isRunFileName(name) {
  return /\.(run|json)$/i.test(String(name || ''));
}

async function collectRunFilesFromHandle(handle, prefix = '') {
  if (handle.kind === 'file') {
    if (!isRunFileName(handle.name)) return [];
    return [{ file: await handle.getFile(), pathLabel: prefix || handle.name }];
  }
  const files = [];
  for await (const [name, child] of handle.entries()) {
    const nextPrefix = prefix ? `${prefix}/${name}` : name;
    files.push(...await collectRunFilesFromHandle(child, nextPrefix));
  }
  return files;
}

function collectRunFilesFromInput(files) {
  return Array.from(files || [])
    .filter(file => isRunFileName(file.name))
    .map(file => ({
      file,
      pathLabel: file.webkitRelativePath || file.name,
    }));
}

async function collectRunFilesFromDrop(event) {
  const items = Array.from(event.dataTransfer?.items || []);
  if (state.canDropDirectory && items.length) {
    const descriptors = [];
    for (const item of items) {
      if (item.kind !== 'file') continue;
      const handle = await item.getAsFileSystemHandle();
      if (!handle) continue;
      descriptors.push(...await collectRunFilesFromHandle(handle, handle.name));
    }
    if (descriptors.length) return descriptors;
  }
  return collectRunFilesFromInput(event.dataTransfer?.files);
}

async function buildRunEntries(descriptors) {
  const parsed = [];
  for (const descriptor of descriptors) {
    try {
      const text = await descriptor.file.text();
      const run = parseRunText(text);
      parsed.push(localizeRunEntry({
        id: `${descriptor.pathLabel}:${descriptor.file.size}:${descriptor.file.lastModified}`,
        name: descriptor.file.name,
        pathLabel: descriptor.pathLabel,
        run,
      }));
    } catch {}
  }
  return parsed.sort((left, right) => (right.run.start_time || 0) - (left.run.start_time || 0));
}

async function loadDescriptors(descriptors, errorKey = 'loadFailed') {
  state.loading = true;
  state.error = '';
  state.report = null;
  state.run = null;
  state.fileName = '';
  state.playerId = null;
  state.activeRunId = '';
  render();
  try {
    const entries = await buildRunEntries(descriptors);
    if (!entries.length) throw new Error(state.text.noSupportedDrop);
    state.runEntries = entries;
  } catch (error) {
    state.runEntries = [];
    state.error = `${state.text[errorKey] || state.text.loadFailed}: ${error.message || String(error)}`;
  } finally {
    state.loading = false;
    render();
  }
}

async function loadFileList(files) {
  const descriptors = collectRunFilesFromInput(files);
  await loadDescriptors(descriptors, 'loadFailed');
}

async function chooseDirectory() {
  try {
    if (typeof window.showDirectoryPicker === 'function') {
      const handle = await window.showDirectoryPicker();
      const descriptors = await collectRunFilesFromHandle(handle, handle.name);
      await loadDescriptors(descriptors, 'scanFailed');
      return;
    }
    if ('webkitdirectory' in directoryInput) {
      directoryInput.click();
      return;
    }
    state.error = state.text.sourceUnsupported;
    render();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    state.error = `${state.text.scanFailed}: ${error.message || String(error)}`;
    render();
  }
}

function hasFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

app.addEventListener('click', async event => {
  const picker = event.target.closest('[data-floor-picker]');
  if (state.floorMenuOpen && !picker) {
    state.floorMenuOpen = false;
    render();
    return;
  }
  const target = event.target.closest('[data-action],[data-locale],[data-player],[data-copy-path],[data-floor-menu-toggle],[data-floor-option],[data-floor-step],[data-run-entry]');
  if (!target) return;
  if (target.dataset.runEntry) {
    await selectRunEntry(target.dataset.runEntry);
    return;
  }
  if (target.dataset.floorMenuToggle != null) {
    state.floorMenuOpen = !state.floorMenuOpen;
    render();
    return;
  }
  if (target.dataset.floorOption) {
    state.selectedFloor = Number(target.dataset.floorOption);
    state.floorMenuOpen = false;
    render();
    return;
  }
  if (target.dataset.floorStep) {
    const floors = state.report?.floorDetails || [];
    const index = floors.findIndex(item => item.floor === state.selectedFloor);
    if (index === -1) return;
    const nextIndex = target.dataset.floorStep === 'prev'
      ? Math.max(0, index - 1)
      : Math.min(floors.length - 1, index + 1);
    state.selectedFloor = floors[nextIndex]?.floor || state.selectedFloor;
    state.floorMenuOpen = false;
    render();
    return;
  }
  if (target.dataset.action === 'choose-source') {
    if (state.canChooseDirectory) await chooseDirectory();
    else fileInput.click();
    return;
  }
  if (target.dataset.action === 'choose-directory') {
    await chooseDirectory();
    return;
  }
  if (target.dataset.action === 'choose-file') {
    fileInput.click();
    return;
  }
  if (target.dataset.action === 'show-runs') {
    state.report = null;
    state.run = null;
    state.playerId = null;
    state.floorMenuOpen = false;
    render();
    return;
  }
  if (target.dataset.copyPath != null) {
    await copyHistoryPath();
    return;
  }
  if (target.dataset.locale) {
    state.locale = resolveLocale(target.dataset.locale);
    refreshRunEntriesLocale();
    if (state.run) await rebuildReport();
    else render();
    return;
  }
  if (target.dataset.player) {
    state.playerId = Number(target.dataset.player);
    await rebuildReport();
  }
});

fileInput.addEventListener('change', async event => {
  await loadFileList(event.target.files);
  fileInput.value = '';
});

directoryInput.addEventListener('change', async event => {
  await loadFileList(event.target.files);
  directoryInput.value = '';
});

document.addEventListener('dragenter', event => {
  if (!hasFileDrag(event)) return;
  event.preventDefault();
  dragDepth += 1;
  setDragActive(true);
});

document.addEventListener('dragover', event => {
  if (!hasFileDrag(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('dragleave', event => {
  if (!hasFileDrag(event)) return;
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDragActive(false);
});

document.addEventListener('drop', async event => {
  if (!hasFileDrag(event)) return;
  event.preventDefault();
  dragDepth = 0;
  setDragActive(false);
  const descriptors = await collectRunFilesFromDrop(event);
  if (!descriptors.length) {
    state.error = state.text.noSupportedDrop;
    render();
    return;
  }
  await loadDescriptors(descriptors, 'scanFailed');
});

render();
