import { SUPPORTED_LOCALES } from './config.js';

const STRINGS = {
  zh: {
    appTitle: 'Spire Analyzer',
    uploadTitle: '导入 .run 文件',
    uploadHint: '读取 Slay the Spire 2 run history, 生成简洁的客观总结。',
    historyHint: 'run history 默认路径',
    savePath: '存档路径',
    chooseFile: '选择 .run 文件',
    changeFile: '更换文件',
    dropHint: '支持拖放 .run / JSON 文件',
    uploadCta: '上传对局',
    uploadDropCta: '点击这里选择存档目录或 .run 文件, 也可直接拖放文件夹或 .run 文件',
    chooseDirectory: '选择目录',
    chooseRunFile: '选择文件',
    scanResults: '已找到',
    runListTitle: '对局列表',
    sourceUnsupported: '当前环境不支持目录导入. 请改用单个 .run 文件, 或在 Chromium 桌面端打开.',
    sourceSupported: 'Chromium 桌面端支持目录导入.',
    scanFailed: '目录读取失败',
    openRunList: '返回对局列表',
    noSupportedDrop: '未读取到可分析的 .run 文件或目录',
    player: '玩家',
    summary: '对局摘要',
    runTotals: '路径统计',
    hpCurve: '生命值曲线',
    deckCurve: '牌组数量曲线',
    ancientChoices: '先古遗物选择',
    bossRewards: 'Boss 战后选卡',
    toughestFights: '承受伤害最高的战斗',
    openingRewards: '前 3 场战斗的选卡',
    allCardPicks: '全部抓牌',
    allRelics: '全部遗物',
    floorDetails: '楼层明细',
    moments: '时刻',
    noBossRewards: '这一局没有记录到 Boss 战后的卡牌奖励。',
    noOpeningRewards: '这一局没有记录到前 3 场战斗的卡牌奖励。',
    noDamageFights: '这一局没有记录到承受伤害的战斗。',
    noCardPicks: '这一局没有记录到抓牌。',
    noRelics: '这一局没有记录到获得的遗物。',
    noMoments: '这一局还没有值得单独记一笔的时刻。',
    picked: '选择',
    skipped: '跳过',
    none: '无',
    unknown: '未知',
    character: '角色',
    ascension: '进阶',
    ascensionCompact: '进阶',
    seed: '种子',
    result: '结果',
    duration: '时长',
    build: '版本',
    startTime: '开始时间',
    floors: '层数',
    finalHp: '最终生命',
    relics: '遗物数',
    goldSpent: '消费金币',
    cardRewards: '选取卡牌',
    byAct: '分阶段',
    restSites: '休息处',
    elites: '精英战',
    current: '当前生命',
    max: '最大生命',
    deck: '牌组数量',
    victory: '胜利',
    defeat: '失败',
    abandoned: '放弃',
    rest: '休息',
    smith: '升级',
    other: '其他',
    damageTaken: '承受伤害',
    turns: '回合',
    act: '阶段',
    floor: '层',
    gold: '金币',
    rewards: '奖励',
    choices: '选项',
    restAction: '休息处',
    damageTakenLabel: '承受伤害',
    turnsTakenLabel: '回合',
    normal: '普通',
    warningCodexFallback: '未能完整加载 Spire Codex 数据，部分名称回退为英文或 ID。',
    warningCodexEnglish: '未能加载中文 Spire Codex 数据，名称已回退为英文。',
    loadFailed: '读取失败',
    lowestHp: '最低生命',
    actEnd: '阶段结束',
    cards: '牌',
    pathOverview: '路径概览',
    seedShort: '种子',
    floorShort: 'F',
    pickedShort: '选',
    skippedShort: '略',
    sourceHintLinux: 'Linux / Steam Deck: ~/.local/share/SlayTheSpire2/steam/<steam id>/profile*/saves/history',
    sourceHintMac: 'macOS: ~/Library/Application Support/SlayTheSpire2/steam/<steam id>/profile*/saves/history',
    sourceHintWindows: 'Windows: %APPDATA%/SlayTheSpire2/steam/<steam id>/profile*\\saves\\history',
    hoverUnavailable: '图表悬停信息不可用',
    copied: '已复制',
    copyPath: '复制路径',
    importRun: '导入 .run',
    finalDeck: '最终牌组',
    actCardPicks: '各阶段抓牌',
    damageTop: '战损最高',
    chosenCards: '抓牌数',
    removedCards: '删除',
    uploadRunTitle: 'Spire Analyzer',
    loading: '读取中',
    hpCompact: '生命',
    goldCompact: '消费',
    relicsCompact: '遗物',
    deckCompact: '牌组',
    restCompact: '火堆',
    elitesCompact: '精英',
    chooseSteamId: '选择 Steam 玩家',
    chooseProfile: '选择存档',
    chooseRun: '选择对局',
    choosePlayer: '选择玩家',
    menuNavigationHint: '↑↓ / j k 移动 · Enter 确认 · q 退出',
    runsShort: '局',
    historyRootMissing: '未找到存档目录',
    noSteamIds: '未找到 Steam 玩家',
    noProfiles: '未找到非空存档',
    noHistoryRuns: '未找到 .run 文件',
    ttyRequired: '交互式选择需要在终端里运行',
    cancelled: '已取消',
    previousFloor: '上一层',
    nextFloor: '下一层',
    viewerSummary: '概览',
    viewerChoices: '选择',
    viewerCards: '抓牌',
    viewerRelics: '遗物',
    viewerFloors: '楼层',
    viewerHelp: '↑↓ / j k 滚动 · ←→ / h l 切页 · g/G 顶部/底部 · 1-4 跳页 · q 返回',
  },
  en: {
    appTitle: 'Spire Analyzer',
    uploadTitle: 'Import a .run file',
    uploadHint: 'Read Slay the Spire 2 run history and generate a compact, objective summary.',
    historyHint: 'Default run history paths',
    savePath: 'Save path',
    chooseFile: 'Choose .run File',
    changeFile: 'Change File',
    dropHint: 'Supports drag and drop for .run / JSON files',
    uploadCta: 'Upload Run',
    uploadDropCta: 'Click here to choose a save directory or .run file, or drag and drop a folder or .run file',
    chooseDirectory: 'Choose Directory',
    chooseRunFile: 'Choose File',
    scanResults: 'Found',
    runListTitle: 'Run List',
    sourceUnsupported: 'Directory import is not supported here. Use a single .run file, or open this page in desktop Chromium.',
    sourceSupported: 'Directory import is supported in desktop Chromium.',
    scanFailed: 'Directory scan failed',
    openRunList: 'Back to run list',
    noSupportedDrop: 'No supported .run file or directory was found',
    player: 'Player',
    summary: 'Run Summary',
    runTotals: 'Path Totals',
    hpCurve: 'HP Curve',
    deckCurve: 'Deck Size Curve',
    ancientChoices: 'Ancient Choices',
    bossRewards: 'Boss Card Rewards',
    toughestFights: 'Highest Damage Fights',
    openingRewards: 'First 3 Combat Rewards',
    allCardPicks: 'All Card Picks',
    allRelics: 'All Relics',
    floorDetails: 'Floor Details',
    moments: 'Moments',
    noBossRewards: 'No boss card rewards were recorded in this run.',
    noOpeningRewards: 'No combat card rewards were recorded in the first 3 fights.',
    noDamageFights: 'No damaging fights were recorded in this run.',
    noCardPicks: 'No card picks were recorded in this run.',
    noRelics: 'No relic gains were recorded in this run.',
    noMoments: 'No standout moments were recorded in this run.',
    picked: 'Picked',
    skipped: 'Skipped',
    none: 'None',
    unknown: 'Unknown',
    character: 'Character',
    ascension: 'Ascension',
    ascensionCompact: 'A',
    seed: 'Seed',
    result: 'Result',
    duration: 'Duration',
    build: 'Build',
    startTime: 'Started',
    floors: 'Floors',
    finalHp: 'Final HP',
    relics: 'Relics',
    goldSpent: 'Gold Spent',
    cardRewards: 'Card Rewards Taken',
    byAct: 'By Act',
    restSites: 'Rest Sites',
    elites: 'Elite Fights',
    current: 'Current HP',
    max: 'Max HP',
    deck: 'Deck Size',
    victory: 'Victory',
    defeat: 'Defeat',
    abandoned: 'Abandoned',
    rest: 'Rest',
    smith: 'Smith',
    other: 'Other',
    damageTaken: 'Damage Taken',
    turns: 'Turns',
    act: 'Act',
    floor: 'Floor',
    gold: 'Gold',
    rewards: 'Rewards',
    choices: 'Choices',
    restAction: 'Rest Site',
    damageTakenLabel: 'Damage',
    turnsTakenLabel: 'Turns',
    normal: 'Normal',
    warningCodexFallback: 'Spire Codex data did not fully load. Some names fell back to English or raw IDs.',
    warningCodexEnglish: 'Localized Spire Codex data did not load. Names fell back to English.',
    loadFailed: 'Load failed',
    lowestHp: 'Lowest HP',
    actEnd: 'Act Ends',
    cards: 'Cards',
    pathOverview: 'Path Overview',
    seedShort: 'Seed',
    floorShort: 'F',
    pickedShort: 'Pick',
    skippedShort: 'Skip',
    sourceHintLinux: 'Linux / Steam Deck: ~/.local/share/SlayTheSpire2/steam/<steam id>/profile*/saves/history',
    sourceHintMac: 'macOS: ~/Library/Application Support/SlayTheSpire2/steam/<steam id>/profile*/saves/history',
    sourceHintWindows: 'Windows: %APPDATA%/SlayTheSpire2/steam/<steam id>/profile*\\saves\\history',
    hoverUnavailable: 'Hover data unavailable',
    copied: 'Copied',
    copyPath: 'Copy path',
    importRun: 'Import .run',
    finalDeck: 'Final Deck',
    actCardPicks: 'Card Picks by Act',
    damageTop: 'Top Damage Taken',
    chosenCards: 'Card picks',
    removedCards: 'Removed',
    uploadRunTitle: 'Spire Analyzer',
    loading: 'Loading',
    hpCompact: 'HP',
    goldCompact: 'Gold',
    relicsCompact: 'Relics',
    deckCompact: 'Deck',
    restCompact: 'Rest',
    elitesCompact: 'Elites',
    chooseSteamId: 'Choose Steam Player',
    chooseProfile: 'Choose Profile',
    chooseRun: 'Choose Run',
    choosePlayer: 'Choose Player',
    menuNavigationHint: '↑↓ / j k move · Enter confirm · q quit',
    runsShort: 'runs',
    historyRootMissing: 'Save directory not found',
    noSteamIds: 'No Steam players found',
    noProfiles: 'No non-empty profiles found',
    noHistoryRuns: 'No .run files found',
    ttyRequired: 'Interactive selection requires a terminal',
    cancelled: 'Cancelled',
    previousFloor: 'Prev floor',
    nextFloor: 'Next floor',
    viewerSummary: 'Overview',
    viewerChoices: 'Choices',
    viewerCards: 'Cards',
    viewerRelics: 'Relics',
    viewerFloors: 'Floors',
    viewerHelp: '↑↓ / j k scroll · ←→ / h l switch · g/G top/bottom · 1-4 jump · q back',
  },
};

export function resolveLocale(input) {
  if (!input) return 'en';
  if (SUPPORTED_LOCALES.includes(input)) return input;
  return input.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function detectLocale(input) {
  if (Array.isArray(input)) {
    return input.some(item => String(item || '').toLowerCase().startsWith('zh')) ? 'zh' : 'en';
  }
  if (typeof input === 'string' && input) return resolveLocale(input);
  return 'en';
}

export function t(locale, key) {
  const selected = STRINGS[resolveLocale(locale)];
  return selected[key] || STRINGS.en[key] || key;
}

export function formatDuration(seconds, locale) {
  if (!Number.isFinite(seconds) || seconds <= 0) return t(locale, 'unknown');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (locale === 'zh') {
    if (hours) return `${hours}小时${minutes}分${remainder}秒`;
    if (minutes) return `${minutes}分${remainder}秒`;
    return `${remainder}秒`;
  }
  if (hours) return `${hours}h ${minutes}m ${remainder}s`;
  if (minutes) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
}

export function formatStartTime(timestamp, locale) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return t(locale, 'unknown');
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000));
}

export function formatCountByAct(locale, counts, actNames) {
  return counts
    .map((count, index) => `${actNames[index]} ${count}`)
    .join(locale === 'zh' ? ' / ' : ' / ');
}

export function getResultLabel(locale, run) {
  if (run.was_abandoned) return t(locale, 'abandoned');
  return run.win ? t(locale, 'victory') : t(locale, 'defeat');
}

export function getRoomTypeLabel(locale, roomType) {
  if (locale === 'zh') {
    if (roomType === 'monster') return '战斗';
    if (roomType === 'elite') return '精英';
    if (roomType === 'boss') return 'Boss';
    if (roomType === 'rest_site') return '休息处';
    if (roomType === 'shop') return '商店';
    if (roomType === 'event') return '事件';
    if (roomType === 'treasure') return '宝箱';
    return '未知';
  }
  if (roomType === 'monster') return 'Combat';
  if (roomType === 'elite') return 'Elite';
  if (roomType === 'boss') return 'Boss';
  if (roomType === 'rest_site') return 'Rest Site';
  if (roomType === 'shop') return 'Shop';
  if (roomType === 'event') return 'Event';
  if (roomType === 'treasure') return 'Treasure';
  return 'Unknown';
}
