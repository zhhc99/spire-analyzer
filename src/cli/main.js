#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import readline from 'node:readline';
import { buildReportFromRun, listPlayers, parseRunText } from '../core/report.js';
import { detectLocale, formatCountByAct, formatDuration, formatStartTime, getResultLabel, resolveLocale, t } from '../core/i18n.js';

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith('--')) {
      args._.push(part);
      continue;
    }
    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function getHistoryRoot() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) fail('APPDATA is not set');
    return path.join(appData, 'SlayTheSpire2', 'steam');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'SlayTheSpire2', 'steam');
  }
  return path.join(os.homedir(), '.local', 'share', 'SlayTheSpire2', 'steam');
}

async function listDirectories(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

async function getProfileRuns(steamRoot) {
  const profiles = (await listDirectories(steamRoot)).filter(name => /^profile\d+$/i.test(name));
  const items = [];
  for (const profile of profiles) {
    const historyDir = path.join(steamRoot, profile, 'saves', 'history');
    let entries = [];
    try {
      entries = await readdir(historyDir, { withFileTypes: true });
    } catch {
      continue;
    }
    const runs = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.run')) continue;
      const fullPath = path.join(historyDir, entry.name);
      const info = await stat(fullPath);
      runs.push({ path: fullPath, name: entry.name, mtimeMs: info.mtimeMs });
    }
    if (runs.length) items.push({ profile, historyDir, runs: runs.sort((a, b) => b.mtimeMs - a.mtimeMs) });
  }
  return items;
}

function normalizeProfileSelector(value) {
  if (!value) return '';
  return /^profile\d+$/i.test(value) ? value.toLowerCase() : `profile${value}`;
}

async function findLatestRun(args, locale) {
  const historyRoot = getHistoryRoot();
  let steamIds = [];
  try {
    steamIds = await listDirectories(historyRoot);
  } catch {
    fail(`${t(locale, 'historyRootMissing')}: ${historyRoot}`);
  }
  if (!steamIds.length) fail(`${t(locale, 'noSteamIds')}: ${historyRoot}`);
  const steamId = args['steam-id']
    ? String(args['steam-id'])
    : steamIds.length === 1
      ? steamIds[0]
      : fail(`Multiple Steam IDs found. Use --steam-id.\n${steamIds.join('\n')}`);
  if (!steamIds.includes(steamId)) fail(`Steam ID not found: ${steamId}`);
  const profiles = await getProfileRuns(path.join(historyRoot, steamId));
  if (!profiles.length) fail(`${t(locale, 'noProfiles')}: ${steamId}`);
  const profileName = args.profile
    ? normalizeProfileSelector(String(args.profile))
    : profiles.length === 1
      ? profiles[0].profile
      : fail(`Multiple non-empty profiles found. Use --profile.\n${profiles.map(item => `${item.profile} (${item.runs.length})`).join('\n')}`);
  const profile = profiles.find(item => item.profile === profileName);
  if (!profile) fail(`Profile not found or empty: ${profileName}`);
  return profile.runs[0].path;
}

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  inverse: '\x1b[7m',
  clear: '\x1b[2J\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

function colorize(text, color) {
  if (!stdout.isTTY || !color) return text;
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

function stripAnsi(text) {
  return String(text || '').replace(ANSI_PATTERN, '');
}

function charWidth(char) {
  const code = char.codePointAt(0);
  if (!code) return 0;
  if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return 0;
  if (code === 0x200d || (code >= 0x300 && code <= 0x36f) || (code >= 0xfe00 && code <= 0xfe0f)) return 0;
  if (EMOJI_PATTERN.test(char)) return 2;
  if (
    code >= 0x1100 && (
      code <= 0x115f ||
      code === 0x2329 ||
      code === 0x232a ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1f64f) ||
      (code >= 0x1f900 && code <= 0x1f9ff) ||
      (code >= 0x20000 && code <= 0x3fffd)
    )
  ) return 2;
  return 1;
}

function displayWidth(text) {
  let width = 0;
  for (const char of stripAnsi(text)) width += charWidth(char);
  return width;
}

function padDisplayEnd(text, targetWidth) {
  const padding = targetWidth - displayWidth(text);
  return padding > 0 ? `${text}${' '.repeat(padding)}` : text;
}

function truncateDisplay(text, maxWidth) {
  if (displayWidth(text) <= maxWidth) return text;
  const ellipsis = '...';
  const limit = Math.max(maxWidth - displayWidth(ellipsis), 0);
  let width = 0;
  let result = '';
  for (const char of String(text)) {
    const nextWidth = charWidth(char);
    if (width + nextWidth > limit) break;
    result += char;
    width += nextWidth;
  }
  return `${result}${ellipsis}`;
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

function formatAscensionCompact(locale, value) {
  const ascension = Number.isFinite(Number(value)) ? Number(value) : 0;
  return locale === 'zh' ? `${t(locale, 'ascensionCompact')} ${ascension}` : `${t(locale, 'ascensionCompact')}${ascension}`;
}

async function pickFromMenu(locale, title, items, renderItem, subtitle = '') {
  if (!stdin.isTTY || !stdout.isTTY) fail(t(locale, 'ttyRequired'));
  if (!items.length) fail(t(locale, 'noHistoryRuns'));
  readline.emitKeypressEvents(stdin);
  const hadRawMode = Boolean(stdin.isRaw);
  if (!hadRawMode) stdin.setRawMode(true);
  stdin.resume();
  let index = 0;

  const render = () => {
    const width = stdout.columns || 100;
    const height = stdout.rows || 24;
    const windowSize = Math.max(6, height - 5);
    const maxStart = Math.max(items.length - windowSize, 0);
    const start = Math.min(Math.max(index - Math.floor(windowSize / 2), 0), maxStart);
    const visible = items.slice(start, start + windowSize);
    const lines = [
      ANSI.clear,
      ANSI.hideCursor,
      colorize(title, 'bold'),
    ];
    if (subtitle) lines.push(colorize(subtitle, 'dim'));
    lines.push('');
    if (start > 0) lines.push(colorize('  ...', 'dim'));
    visible.forEach((item, visibleIndex) => {
      const actualIndex = start + visibleIndex;
      const line = `${actualIndex === index ? '› ' : '  '}${truncateDisplay(renderItem(item, actualIndex), Math.max(width - 4, 8))}`;
      lines.push(actualIndex === index
        ? colorize(padDisplayEnd(line, width - 1), 'inverse')
        : line);
    });
    if (start + visible.length < items.length) lines.push(colorize('  ...', 'dim'));
    while (lines.length < height - 1) lines.push('');
    lines.push(colorize(t(locale, 'menuNavigationHint'), 'dim'));
    stdout.write(lines.join('\n'));
  };

  return new Promise((resolve, reject) => {
    const finish = callback => {
      stdin.off('keypress', onKeypress);
      if (!hadRawMode) stdin.setRawMode(false);
      stdin.pause();
      stdout.write(`${ANSI.reset}${ANSI.showCursor}${ANSI.clear}`);
      callback();
    };

    const onKeypress = (input, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        finish(() => reject(new Error(t(locale, 'cancelled'))));
        return;
      }
      if (key.name === 'up' || input === 'k') {
        index = index > 0 ? index - 1 : items.length - 1;
        render();
        return;
      }
      if (key.name === 'down' || input === 'j') {
        index = index < items.length - 1 ? index + 1 : 0;
        render();
        return;
      }
      if (key.name === 'pageup') {
        index = Math.max(index - 10, 0);
        render();
        return;
      }
      if (key.name === 'pagedown') {
        index = Math.min(index + 10, items.length - 1);
        render();
        return;
      }
      if (key.name === 'home') {
        index = 0;
        render();
        return;
      }
      if (key.name === 'end') {
        index = items.length - 1;
        render();
        return;
      }
      if (key.name === 'return' || key.name === 'enter') {
        finish(() => resolve(items[index]));
        return;
      }
      if (key.name === 'escape' || input === 'q') {
        finish(() => reject(new Error(t(locale, 'cancelled'))));
      }
    };

    stdin.on('keypress', onKeypress);
    render();
  });
}

async function readRunWithMeta(runPath, locale) {
  const text = await readFile(runPath, 'utf8');
  const run = parseRunText(text);
  const leadPlayer = listPlayers(run)[0];
  const resultLabel = getResultLabel(locale, run);
  const resultTone = run.was_abandoned ? 'yellow' : run.win ? 'green' : 'red';
  return {
    run,
    resultLabel,
    resultTone,
    characterLabel: toPrettyFallback(leadPlayer?.character),
    ascensionLabel: formatAscensionCompact(locale, run.ascension ?? 0),
    timeLabel: formatStartTime(run.start_time || 0, locale),
    durationLabel: formatDuration(run.run_time || 0, locale),
    fileLabel: path.basename(runPath),
  };
}

async function browseHistory(locale) {
  const historyRoot = getHistoryRoot();
  let steamIds = [];
  try {
    steamIds = await listDirectories(historyRoot);
  } catch {
    fail(`${t(locale, 'historyRootMissing')}: ${historyRoot}`);
  }
  if (!steamIds.length) fail(`${t(locale, 'noSteamIds')}: ${historyRoot}`);
  const steamId = steamIds.length === 1
    ? steamIds[0]
    : await pickFromMenu(locale, t(locale, 'chooseSteamId'), steamIds, item => item, historyRoot);
  const profiles = await getProfileRuns(path.join(historyRoot, steamId));
  if (!profiles.length) fail(`${t(locale, 'noProfiles')}: ${steamId}`);
  const profile = profiles.length === 1
    ? profiles[0]
    : await pickFromMenu(
      locale,
      t(locale, 'chooseProfile'),
      profiles,
      item => `${item.profile} · ${item.runs.length} ${t(locale, 'runsShort')}`,
      steamId,
    );
  if (!profile.runs.length) fail(`${t(locale, 'noHistoryRuns')}: ${profile.historyDir}`);
  const runItems = await Promise.all(profile.runs.map(async item => {
    try {
      const preview = await readRunWithMeta(item.path, locale);
      return { ...item, ...preview };
    } catch (error) {
      return {
        ...item,
        error,
        fileLabel: item.name,
        detail: error.message || String(error),
      };
    }
  }));
  const runItem = runItems.length === 1
    ? runItems[0]
    : await pickFromMenu(
      locale,
      t(locale, 'chooseRun'),
      runItems,
      item => item.error
        ? `${colorize(t(locale, 'loadFailed'), 'red')} · ${item.fileLabel} · ${colorize(item.detail, 'dim')}`
        : `${colorize(item.resultLabel, item.resultTone)} · ${item.characterLabel} · ${item.ascensionLabel} · ${colorize(`${item.timeLabel} · ${item.durationLabel} · ${item.fileLabel}`, 'dim')}`,
      `${steamId} · ${profile.profile}`,
    );
  if (runItem.error) fail(runItem.detail);
  return {
    fileLabel: path.basename(runItem.path),
    playerSelector: null,
    run: runItem.run,
  };
}

async function resolvePlayerSelector(run, args, locale, fileLabel) {
  if (args.player != null) return args.player;
  const players = listPlayers(run);
  if (players.length <= 1) return null;
  const selected = await pickFromMenu(
    locale,
    t(locale, 'choosePlayer'),
    players,
    item => `P${item.id} · ${toPrettyFallback(item.character)}`,
    fileLabel,
  );
  return selected.id;
}

function getSourceTag(source, locale) {
  if (source === 'boss') return { text: locale === 'zh' ? '👑 Boss' : '👑 Boss', color: 'yellow' };
  if (source === 'elite') return { text: locale === 'zh' ? '😈 精英' : '😈 Elite', color: 'red' };
  if (source === 'ancient') return { text: locale === 'zh' ? '🧿 先古' : '🧿 Ancient', color: 'cyan' };
  if (source === 'treasure') return { text: locale === 'zh' ? '🎁 宝箱' : '🎁 Treasure', color: 'yellow' };
  if (source === 'shop') return { text: locale === 'zh' ? '🛒 商店' : '🛒 Shop', color: 'green' };
  if (source === 'event') return { text: locale === 'zh' ? '🎲 事件' : '🎲 Event', color: 'cyan' };
  return { text: locale === 'zh' ? '• 普通' : '• Normal', color: 'dim' };
}

function formatChoiceTrail(locale, item, dim) {
  const parts = [];
  parts.push(item.picked ? colorize(`✓ ${item.picked.label}`, 'green') : dim(t(locale, 'none')));
  if (item.skipped.length) parts.push(...item.skipped.map(entry => dim(entry.label)));
  return parts.join(' ');
}

function renderViewerTabs(locale, sections, sectionIndex) {
  return sections
    .map((section, index) => index === sectionIndex
      ? colorize(`${index + 1}.${section.title}`, 'cyan')
      : colorize(`${index + 1}.${section.title}`, 'dim'))
    .join(colorize('  ', 'dim'));
}

function padViewerColumns(items) {
  const width = Math.max(...items.map(item => displayWidth(item.prefix)), 0);
  return items.map(item => `${padDisplayEnd(item.prefix, width)} ${item.label}`);
}

function wrapDisplayText(text, width) {
  if (width <= 0) return [''];
  const lines = [];
  let line = '';
  let lineWidth = 0;
  for (const char of String(text)) {
    if (char === '\n') {
      lines.push(line);
      line = '';
      lineWidth = 0;
      continue;
    }
    const nextWidth = charWidth(char);
    if (lineWidth + nextWidth > width && line) {
      lines.push(line);
      line = char;
      lineWidth = nextWidth;
      continue;
    }
    line += char;
    lineWidth += nextWidth;
  }
  lines.push(line);
  return lines;
}

function buildViewerSections(report) {
  const dim = text => colorize(text, 'dim');
  return [
    {
      key: 'overview',
      title: t(report.locale, 'viewerSummary'),
      lines: [
        report.cli.metaLine,
        ...report.warnings.map(item => `! ${item}`),
        '',
        t(report.locale, 'summary'),
        `  ${t(report.locale, 'hpCompact')}♥️ ${report.cli.finalHp} | ${t(report.locale, 'goldCompact')}🪙 ${report.cli.goldSpent} | ${t(report.locale, 'relicsCompact')}🧿 ${report.cli.pathStats.relics}`,
        `  ${t(report.locale, 'deckCompact')}🃏 ${report.cli.pathStats.finalDeck} | ${t(report.locale, 'chosenCards')}: ${formatCountByAct(report.locale, report.cli.actCardRewardCounts, report.cli.actNames)}`,
        `  ${t(report.locale, 'restCompact')}🔥 ${report.cli.pathStats.restSites} | ${t(report.locale, 'rest')} ${report.cli.pathStats.restCount} / ${t(report.locale, 'smith')} ${report.cli.pathStats.smithCount} / ${t(report.locale, 'other')} ${report.cli.otherRestCount}`,
        `  ${t(report.locale, 'elitesCompact')}😈 ${report.cli.pathStats.eliteCount} | ${formatCountByAct(report.locale, report.cli.actEliteCounts, report.cli.actNames)}`,
        '',
        report.ancientChoicesTitle,
        ...(report.ancientChoices.length
          ? report.ancientChoices.map(item => `  ${item.label} | ${formatChoiceTrail(report.locale, item, dim)}${item.rewardSummary ? ` | ${dim(item.rewardSummary)}` : ''}`)
          : [`  ${report.bossRewardsEmpty}`]),
        '',
        report.bossRewardsTitle,
        ...(report.bossRewards.length
          ? report.bossRewards.map(item => `  ${item.label} | ${formatChoiceTrail(report.locale, item, dim)}`)
          : [`  ${report.bossRewardsEmpty}`]),
        '',
        report.openingRewardsTitle,
        ...(report.openingRewards.length
          ? report.openingRewards.map(item => `  ${item.label} | ${formatChoiceTrail(report.locale, item, dim)}`)
          : [`  ${report.openingRewardsEmpty}`]),
        '',
        report.toughestFightsTitle,
        ...(report.toughestFights.length
          ? report.toughestFights.flatMap(item => [
            `  ${item.titleLead} ${colorize(item.damageText, 'red')}`,
            `    ${dim(item.subtitle)}`,
          ])
          : [`  ${report.toughestFightsEmpty}`]),
      ],
    },
    {
      key: 'cards',
      title: t(report.locale, 'viewerCards'),
      lines: report.allCardPicks.length
        ? [
          `${dim(`${report.locale === 'zh' ? '图例' : 'Legend'}:`)} ${colorize(getSourceTag('monster', report.locale).text, getSourceTag('monster', report.locale).color)}  ${colorize(getSourceTag('elite', report.locale).text, getSourceTag('elite', report.locale).color)}  ${colorize(getSourceTag('boss', report.locale).text, getSourceTag('boss', report.locale).color)}`,
          '',
          report.allCardPicksTitle,
          ...report.allCardPicks.flatMap(group => [
            `  ${group.actName}`,
            ...padViewerColumns(group.picks.map(item => {
              const tag = getSourceTag(item.source, report.locale);
              return {
                prefix: `    F${item.floor} ${colorize(tag.text, tag.color)}`,
                label: item.label,
              };
            })),
            '',
          ]).slice(0, -1),
        ]
        : [report.allCardPicksTitle, `  ${report.allCardPicksEmpty}`],
    },
    {
      key: 'relics',
      title: t(report.locale, 'viewerRelics'),
      lines: report.allRelics.length
        ? [
          `${dim(`${report.locale === 'zh' ? '图例' : 'Legend'}:`)} ${['ancient', 'monster', 'elite', 'boss', 'treasure', 'event', 'shop'].map(source => {
            const tag = getSourceTag(source, report.locale);
            return colorize(tag.text, tag.color);
          }).join('  ')}`,
          '',
          report.allRelicsTitle,
          ...report.allRelics.flatMap(group => [
            `  ${group.actName}`,
            ...padViewerColumns(group.relics.map(item => {
              const tag = getSourceTag(item.source, report.locale);
              return {
                prefix: `    F${item.floor} ${colorize(tag.text, tag.color)}`,
                label: item.label,
              };
            })),
            '',
          ]).slice(0, -1),
        ]
        : [report.allRelicsTitle, `  ${report.allRelicsEmpty}`],
    },
    {
      key: 'floors',
      title: t(report.locale, 'viewerFloors'),
      lines: report.floorDetails.flatMap(item => {
        const block = [
          item.title,
          `  ${item.subtitle}`,
          `  ❤️ ${item.hp || '-'} · 🪙 ${item.gold || '0'} · 💥 ${report.locale === 'zh' ? `${item.damageTaken} 伤害` : `${item.damageTaken} dmg`}${item.turnsTaken ? ` · 🔄 ${report.locale === 'zh' ? `${item.turnsTaken} 回合` : `${item.turnsTaken} turns`}` : ''}${item.restAction ? ` · 🔥 ${item.restAction}` : ''}`,
        ];
        if (item.rewardChoices.picked || item.rewardChoices.skipped.length) {
          block.push(`  🃏 ${formatChoiceTrail(report.locale, item.rewardChoices, dim)}`);
        }
        if (item.ancientChoice) {
          block.push(`  🧿 ${formatChoiceTrail(report.locale, item.ancientChoice, dim)}`);
        }
        if (item.relicRewards.length || item.potionRewards.length) {
          block.push(`  🎁 ${[...item.relicRewards.map(entry => entry.label), ...item.potionRewards.map(entry => entry.label)].join(', ')}`);
        }
        block.push('');
        return block;
      }).slice(0, -1),
    },
  ];
}

async function viewReport(report) {
  if (!stdin.isTTY || !stdout.isTTY) {
    stdout.write(renderReport(report));
    return;
  }
  const sections = buildViewerSections(report);
  const scrolls = sections.map(() => 0);
  let sectionIndex = 0;
  readline.emitKeypressEvents(stdin);
  const hadRawMode = Boolean(stdin.isRaw);
  if (!hadRawMode) stdin.setRawMode(true);
  stdin.resume();

  const render = () => {
    const width = Math.max((stdout.columns || 100) - 2, 20);
    const height = stdout.rows || 24;
    const header = `${report.title} · ${sections[sectionIndex].title} [${sectionIndex + 1}/${sections.length}]`;
    const tabs = renderViewerTabs(report.locale, sections, sectionIndex);
    const wrapped = sections[sectionIndex].lines.flatMap(line => wrapDisplayText(line, width));
    const bodyHeight = Math.max(height - 5, 6);
    const maxScroll = Math.max(wrapped.length - bodyHeight, 0);
    scrolls[sectionIndex] = Math.min(scrolls[sectionIndex], maxScroll);
    const visible = wrapped.slice(scrolls[sectionIndex], scrolls[sectionIndex] + bodyHeight);
    const lines = [
      ANSI.clear,
      ANSI.hideCursor,
      colorize(header, 'bold'),
      colorize(report.resultLabel, report.cli.resultTone === 'success' ? 'green' : report.cli.resultTone === 'danger' ? 'red' : 'yellow'),
      tabs,
      ...visible.map(line => truncateDisplay(line, width)),
    ];
    while (lines.length < height - 1) lines.push('');
    lines.push(colorize(t(report.locale, 'viewerHelp'), 'dim'));
    stdout.write(lines.join('\n'));
  };

  return new Promise((resolve, reject) => {
    const finish = callback => {
      stdin.off('keypress', onKeypress);
      if (!hadRawMode) stdin.setRawMode(false);
      stdin.pause();
      stdout.write(`${ANSI.reset}${ANSI.showCursor}${ANSI.clear}`);
      callback();
    };

    const onKeypress = (input, key = {}) => {
      const width = Math.max((stdout.columns || 100) - 2, 20);
      const bodyHeight = Math.max((stdout.rows || 24) - 5, 6);
      const wrapped = sections[sectionIndex].lines.flatMap(line => wrapDisplayText(line, width));
      const maxScroll = Math.max(wrapped.length - bodyHeight, 0);
      if (key.ctrl && key.name === 'c') {
        finish(() => reject(new Error(t(report.locale, 'cancelled'))));
        return;
      }
      if (key.name === 'up' || input === 'k') {
        scrolls[sectionIndex] = Math.max(scrolls[sectionIndex] - 1, 0);
        render();
        return;
      }
      if (key.name === 'down' || input === 'j') {
        scrolls[sectionIndex] = Math.min(scrolls[sectionIndex] + 1, maxScroll);
        render();
        return;
      }
      if (key.name === 'pageup') {
        scrolls[sectionIndex] = Math.max(scrolls[sectionIndex] - bodyHeight, 0);
        render();
        return;
      }
      if (key.name === 'pagedown' || input === ' ') {
        scrolls[sectionIndex] = Math.min(scrolls[sectionIndex] + bodyHeight, maxScroll);
        render();
        return;
      }
      if (key.name === 'home' || input === 'g') {
        scrolls[sectionIndex] = 0;
        render();
        return;
      }
      if (key.name === 'end' || input === 'G') {
        scrolls[sectionIndex] = maxScroll;
        render();
        return;
      }
      if (key.name === 'left' || input === 'h') {
        sectionIndex = sectionIndex > 0 ? sectionIndex - 1 : sections.length - 1;
        render();
        return;
      }
      if (key.name === 'right' || input === 'l') {
        sectionIndex = sectionIndex < sections.length - 1 ? sectionIndex + 1 : 0;
        render();
        return;
      }
      if (/^[1-4]$/.test(input || '')) {
        sectionIndex = Math.min(Number(input) - 1, sections.length - 1);
        render();
        return;
      }
      if (key.name === 'escape' || input === 'q') {
        finish(() => resolve('back'));
      }
    };

    stdin.on('keypress', onKeypress);
    render();
  });
}

function renderReport(report) {
  const statusColor = report.cli.resultTone === 'success' ? 'green' : report.cli.resultTone === 'danger' ? 'red' : 'yellow';
  const dim = text => colorize(text, 'dim');
  const bold = text => colorize(text, 'bold');
  const actCardText = `${t(report.locale, 'chosenCards')}: ${formatCountByAct(report.locale, report.cli.actCardRewardCounts, report.cli.actNames)}`;
  const restText = `${t(report.locale, 'rest')} ${report.cli.pathStats.restCount} / ${t(report.locale, 'smith')} ${report.cli.pathStats.smithCount} / ${t(report.locale, 'other')} ${report.cli.otherRestCount}`;
  const actEliteText = formatCountByAct(report.locale, report.cli.actEliteCounts, report.cli.actNames);
  const deckLead = `${t(report.locale, 'deckCompact')}🃏 ${report.cli.pathStats.finalDeck}`;
  const restLead = `${t(report.locale, 'restCompact')}🔥 ${report.cli.pathStats.restSites}`;
  const eliteLead = `${t(report.locale, 'elitesCompact')}😈 ${report.cli.pathStats.eliteCount}`;
  const leftWidth = Math.max(displayWidth(deckLead), displayWidth(restLead), displayWidth(eliteLead));
  const lines = [];
  lines.push(`${bold(report.title)}  ${colorize(report.resultLabel, statusColor)}`);
  lines.push(dim(report.cli.metaLine));
  if (report.warnings.length) {
    lines.push('');
    report.warnings.forEach(warning => lines.push(colorize(`! ${warning}`, 'yellow')));
  }
  lines.push('');
  lines.push(bold(t(report.locale, 'summary')));
  lines.push(`  ${t(report.locale, 'hpCompact')}♥️ ${report.cli.finalHp} | ${t(report.locale, 'goldCompact')}🪙 ${report.cli.goldSpent} | ${t(report.locale, 'relicsCompact')}🧿 ${report.cli.pathStats.relics}`);
  lines.push(`  ${padDisplayEnd(deckLead, leftWidth)} | ${dim(actCardText)}`);
  lines.push(`  ${padDisplayEnd(restLead, leftWidth)} | ${dim(restText)}`);
  lines.push(`  ${padDisplayEnd(eliteLead, leftWidth)} | ${dim(actEliteText)}`);
  lines.push('');
  if (report.ancientChoices.length) {
    lines.push(bold(report.ancientChoicesTitle));
    report.ancientChoices.forEach(item => {
      const options = [
        item.picked ? colorize(`✓ ${item.picked.label}`, 'green') : dim(t(report.locale, 'none')),
        ...item.skipped.map(entry => dim(entry.label)),
      ].join(' ');
      lines.push(`  ${item.label} | ${options}${item.rewardSummary ? ` | ${dim(item.rewardSummary)}` : ''}`);
    });
    lines.push('');
  }
  lines.push(bold(report.bossRewardsTitle));
  if (!report.bossRewards.length) lines.push(`  ${dim(report.bossRewardsEmpty)}`);
  else report.bossRewards.forEach(item => lines.push(`  ${item.label} | ${formatChoiceTrail(report.locale, item, dim)}`));
  lines.push('');
  lines.push(bold(report.toughestFightsTitle));
  if (!report.toughestFights.length) lines.push(`  ${dim(report.toughestFightsEmpty)}`);
  else report.toughestFights.forEach(item => {
    lines.push(`  ${item.titleLead} ${colorize(item.damageText, 'red')}`);
    lines.push(`    ${dim(item.subtitle)}`);
  });
  lines.push('');
  lines.push(bold(report.openingRewardsTitle));
  if (!report.openingRewards.length) lines.push(`  ${dim(report.openingRewardsEmpty)}`);
  else report.openingRewards.forEach(item => lines.push(`  ${item.label} | ${formatChoiceTrail(report.locale, item, dim)}`));
  return `${lines.join('\n')}\n`;
}

function printHelp() {
  console.log(`Spire Analyzer CLI

Usage:
  spire-analyzer
  spire-analyzer browse [--lang zh|en]
  spire-analyzer analyze <path> [--lang zh|en] [--player <id>]
  spire-analyzer latest [--lang zh|en] [--steam-id <id>] [--profile <n>] [--player <id>]
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const locale = args.lang ? resolveLocale(args.lang) : detectLocale([process.env.LC_ALL, process.env.LC_MESSAGES, process.env.LANG]);
  const command = args._[0];
  if (command === 'help' || args.help) {
    printHelp();
    return;
  }

  let runPath = '';
  let run = null;
  let fileLabel = '';
  let playerSelector = null;

  if (!command || command === 'browse') {
    while (true) {
      const picked = await browseHistory(locale);
      run = picked.run;
      fileLabel = picked.fileLabel;
      playerSelector = picked.playerSelector;
      if (playerSelector == null) playerSelector = await resolvePlayerSelector(run, args, locale, fileLabel);
      const report = await buildReportFromRun(run, { locale, playerSelector, fileLabel });
      const action = await viewReport(report);
      if (action === 'back') {
        run = null;
        fileLabel = '';
        playerSelector = null;
        continue;
      }
      return;
    }
  } else if (command === 'analyze') {
    runPath = args._[1];
    if (!runPath) fail('Missing run file path');
  } else if (command === 'latest') {
    runPath = await findLatestRun(args, locale);
  } else {
    fail(`Unknown command: ${command}`);
  }

  if (!run) {
    fileLabel = path.basename(runPath);
    run = parseRunText(await readFile(runPath, 'utf8'));
  }
  if (playerSelector == null) playerSelector = await resolvePlayerSelector(run, args, locale, fileLabel);
  const report = await buildReportFromRun(run, { locale, playerSelector, fileLabel });
  stdout.write(renderReport(report));
}

main().catch(error => {
  if ((error.message || String(error)) === '已取消' || (error.message || String(error)) === 'Cancelled') return;
  console.error(`${error.message || error}\n`);
  process.exitCode = 1;
});
