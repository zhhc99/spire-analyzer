import { CHARACTER_ID_TO_SLUG, COMBAT_ROOM_TYPES } from './config.js';
import { imageUrl, loadCodex, readAct, readCard, readCharacter, readEncounter, readEvent, readPotion, readRelic } from './api.js';
import { formatCountByAct, formatDuration, formatStartTime, getResultLabel, getRoomTypeLabel, resolveLocale, t } from './i18n.js';

function fail(message) {
  throw new Error(message);
}

function ensureObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(message);
  return value;
}

function stripPrefix(value) {
  return String(value || '').replace(/^[A-Z_]+\./, '').toUpperCase();
}

function toPrettyFallback(value) {
  const raw = stripPrefix(value);
  if (!raw) return '';
  return raw
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveCharacterSlug(rawId) {
  return CHARACTER_ID_TO_SLUG[stripPrefix(rawId)] || 'ironclad';
}

function withUpgradeSuffix(label, level) {
  if (!label) return '';
  if (!level) return label;
  return level === 1 ? `${label}+` : `${label}+${level}`;
}

function getStatNode(node, playerId) {
  const stats = Array.isArray(node.player_stats) ? node.player_stats : [];
  return stats.find(item => item?.player_id === playerId) || null;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getRoom(node) {
  return safeArray(node.rooms)[0] || {};
}

function countCardDelta(stats) {
  return safeArray(stats.cards_gained).length - safeArray(stats.cards_removed).length;
}

function resolveCardLabel(codex, card) {
  const data = readCard(codex, stripPrefix(card?.id));
  const fallback = toPrettyFallback(card?.id);
  return {
    label: withUpgradeSuffix(data?.name || fallback || t('en', 'unknown'), card?.current_upgrade_level || 0),
    imageUrl: imageUrl(data?.image_url),
  };
}

function resolveRelicLabel(codex, relicId) {
  const data = readRelic(codex, stripPrefix(relicId));
  return {
    label: data?.name || toPrettyFallback(relicId) || t('en', 'unknown'),
    imageUrl: imageUrl(data?.image_url),
  };
}

function resolveEncounterLabel(codex, encounterId) {
  const data = readEncounter(codex, stripPrefix(encounterId));
  return data?.name || toPrettyFallback(encounterId) || encounterId || '';
}

function resolveEventLabel(codex, eventId) {
  const data = readEvent(codex, stripPrefix(eventId));
  return data?.name || toPrettyFallback(eventId) || eventId || '';
}

function resolvePotionLabel(codex, potionId) {
  const data = readPotion(codex, stripPrefix(potionId));
  return {
    label: data?.name || toPrettyFallback(potionId) || t('en', 'unknown'),
    imageUrl: imageUrl(data?.image_url),
  };
}

function buildActNames(codex, acts) {
  return acts.map((actId, index) => {
    const act = readAct(codex, stripPrefix(actId));
    return act?.name || toPrettyFallback(actId) || `Act ${index + 1}`;
  });
}

function buildSparkPoints(values) {
  return values.filter(point => Number.isFinite(point.y));
}

export function parseRunText(text) {
  const parsed = JSON.parse(text);
  ensureObject(parsed, 'Invalid .run JSON');
  if (!Array.isArray(parsed.players) || parsed.players.length === 0) fail('No players found in .run');
  if (!Array.isArray(parsed.map_point_history) || parsed.map_point_history.length === 0) fail('No map history found in .run');
  return parsed;
}

export function listPlayers(run) {
  return safeArray(run.players).map((player, index) => ({
    id: player.id,
    index,
    character: player.character,
  }));
}

function selectPlayer(run, playerSelector) {
  const players = listPlayers(run);
  if (!players.length) fail('No players found in .run');
  if (playerSelector == null) return players[0];
  const numeric = Number(playerSelector);
  if (Number.isInteger(numeric)) {
    const byId = players.find(player => player.id === numeric);
    if (byId) return byId;
    const byIndex = players[numeric - 1];
    if (byIndex) return byIndex;
  }
  fail(`Unknown player selector: ${playerSelector}`);
}

function flattenNodes(run, playerId) {
  const nodes = [];
  let floor = 0;
  safeArray(run.map_point_history).forEach((actNodes, actIndex) => {
    safeArray(actNodes).forEach(rawNode => {
      floor += 1;
      const stats = getStatNode(rawNode, playerId);
      const room = getRoom(rawNode);
      nodes.push({
        floor,
        actIndex,
        mapPointType: rawNode.map_point_type || room.room_type || 'unknown',
        roomType: room.room_type || rawNode.map_point_type || 'unknown',
        modelId: room.model_id || null,
        turnsTaken: room.turns_taken || 0,
        stats,
      });
    });
  });
  return nodes;
}

function analyzeRun(run, playerRecord) {
  const player = run.players[playerRecord.index];
  const nodes = flattenNodes(run, playerRecord.id);
  const finalDeckCount = safeArray(player.deck).length;
  const initialDeckCount = finalDeckCount - nodes.reduce((sum, node) => sum + countCardDelta(node.stats || {}), 0);
  let deckCount = initialDeckCount;
  const deckCurve = [];
  if (Number.isFinite(initialDeckCount) && initialDeckCount > 0) deckCurve.push({ x: 0, y: initialDeckCount });
  const hpCurve = [];
  const cardRewardNodes = [];
  const bossRewardNodes = [];
  const combatRewardNodes = [];
  const ancientChoices = [];
  const topDamageFights = [];
  const actCardRewardCounts = run.map_point_history.map(() => 0);
  const actEliteCounts = run.map_point_history.map(() => 0);
  let goldSpent = 0;
  let restSites = 0;
  let restCount = 0;
  let smithCount = 0;
  let otherRestCount = 0;
  let lowestHpPoint = null;

  nodes.forEach(node => {
    const stats = node.stats || {};
    deckCount += countCardDelta(stats);
    deckCurve.push({ x: node.floor, y: deckCount });
    if (Number.isFinite(stats.current_hp) && Number.isFinite(stats.max_hp)) {
      hpCurve.push({
        x: node.floor,
        current: stats.current_hp,
        max: stats.max_hp,
      });
      if (!lowestHpPoint || stats.current_hp < lowestHpPoint.current) {
        lowestHpPoint = {
          floor: node.floor,
          actIndex: node.actIndex,
          current: stats.current_hp,
          max: stats.max_hp,
        };
      }
    }
    goldSpent += Number(stats.gold_spent || 0);
    const choices = safeArray(stats.card_choices);
    if (choices.length) {
      cardRewardNodes.push(node);
      actCardRewardCounts[node.actIndex] += choices.filter(choice => choice?.was_picked).length;
      if (node.roomType === 'boss') bossRewardNodes.push(node);
      if (COMBAT_ROOM_TYPES.has(node.roomType)) combatRewardNodes.push(node);
    }
    if (node.roomType === 'rest_site') {
      restSites += 1;
      const restChoice = safeArray(stats.rest_site_choices)[0];
      if (restChoice === 'HEAL') restCount += 1;
      else if (restChoice === 'SMITH') smithCount += 1;
      else otherRestCount += 1;
    }
    if (node.roomType === 'elite') actEliteCounts[node.actIndex] += 1;
    if (COMBAT_ROOM_TYPES.has(node.roomType) && Number(stats.damage_taken || 0) > 0) {
      topDamageFights.push(node);
    }
    const offers = safeArray(stats.ancient_choice);
    if (offers.length) ancientChoices.push(node);
  });

  topDamageFights.sort((left, right) => (right.stats?.damage_taken || 0) - (left.stats?.damage_taken || 0));

  return {
    player,
    nodes,
    hpCurve,
    deckCurve,
    goldSpent,
    restSites,
    restCount,
    smithCount,
    otherRestCount,
    actEliteCounts,
    actCardRewardCounts,
    lowestHpPoint,
    cardRewardNodes,
    bossRewardNodes,
    combatRewardNodes,
    ancientChoices,
    topDamageFights: topDamageFights.slice(0, 5),
  };
}

function buildChoiceList(codex, choices) {
  const picked = choices.find(choice => choice?.was_picked);
  return {
    picked: picked ? resolveCardLabel(codex, picked.card) : null,
    skipped: choices.filter(choice => !choice?.was_picked).map(choice => resolveCardLabel(codex, choice.card)),
  };
}

function buildAncientChoiceList(codex, node, actName, locale) {
  const offers = safeArray(node.stats?.ancient_choice);
  const picked = offers.find(offer => offer?.was_chosen);
  const ancientRelicId = picked?.TextKey || picked?.choice || '';
  const rewardParts = [
    ...safeArray(node.stats?.card_choices)
      .filter(choice => choice?.was_picked && choice.card)
      .map(choice => resolveCardLabel(codex, choice.card).label),
    ...safeArray(node.stats?.potion_choices)
      .filter(choice => choice?.was_picked !== false && choice.choice)
      .map(choice => resolvePotionLabel(codex, choice.choice).label),
    ...safeArray(node.stats?.relic_choices)
      .filter(choice => choice?.was_picked !== false && choice.choice)
      .filter(choice => stripPrefix(choice.choice) !== stripPrefix(ancientRelicId))
      .map(choice => resolveRelicLabel(codex, choice.choice).label),
  ];
  return {
    label: `${actName} · ${resolveEventLabel(codex, node.modelId)}`,
    picked: picked ? resolveRelicLabel(codex, picked.TextKey || picked.choice) : null,
    skipped: offers.filter(offer => !offer?.was_chosen).map(offer => resolveRelicLabel(codex, offer.TextKey || offer.choice)),
    detail: '',
    rewardSummary: rewardParts.length ? `${t(locale, 'rewards')}: ${rewardParts.join(', ')}` : '',
  };
}

function buildFightLabel(codex, node, actName, locale) {
  const encounterName = resolveEncounterLabel(codex, node.modelId);
  const roomLabel = getRoomTypeLabel(locale, node.roomType);
  const hp = `${node.stats.current_hp}/${node.stats.max_hp}`;
  const damageText = locale === 'zh' ? `${node.stats.damage_taken} 伤害` : `${node.stats.damage_taken} dmg`;
  const titleLead = locale === 'zh'
    ? `第 ${node.floor} 层 · ${encounterName} ·`
    : `Floor ${node.floor} · ${encounterName} ·`;
  const subtitle = locale === 'zh'
    ? `${actName} · ${roomLabel} · HP ${hp} · ${node.turnsTaken} 回合`
    : `${actName} · ${roomLabel} · HP ${hp} · ${node.turnsTaken} turns`;
  return {
    label: `${titleLead} ${damageText}`,
    detail: subtitle,
    titleLead,
    damageText,
    subtitle,
    damageTaken: node.stats.damage_taken,
    actName,
    roomLabel,
    turnsTaken: node.turnsTaken,
    hp,
  };
}

function buildRewardLabel(codex, node, actName, locale) {
  const choices = safeArray(node.stats?.card_choices);
  const resolved = buildChoiceList(codex, choices);
  return {
    label: locale === 'zh'
      ? `第 ${node.floor} 层 · ${resolveEncounterLabel(codex, node.modelId)}`
      : `Floor ${node.floor} · ${resolveEncounterLabel(codex, node.modelId)}`,
    detail: `${actName} · ${getRoomTypeLabel(locale, node.roomType)}`,
    picked: resolved.picked,
    skipped: resolved.skipped,
  };
}

function buildFloorTitle(codex, node, locale) {
  if (node.roomType === 'event') return resolveEventLabel(codex, node.modelId) || getRoomTypeLabel(locale, node.roomType);
  if (COMBAT_ROOM_TYPES.has(node.roomType)) return resolveEncounterLabel(codex, node.modelId) || getRoomTypeLabel(locale, node.roomType);
  return getRoomTypeLabel(locale, node.roomType);
}

function formatRestAction(locale, value) {
  if (value === 'HEAL') return t(locale, 'rest');
  if (value === 'SMITH') return t(locale, 'smith');
  if (!value) return '';
  return t(locale, 'other');
}

function buildFloorDetails(codex, analysis, actNames, locale) {
  return analysis.nodes.map(node => {
    const stats = node.stats || {};
    const rewardChoices = buildChoiceList(codex, safeArray(stats.card_choices));
    const ancientChoices = safeArray(stats.ancient_choice);
    const ancientPicked = ancientChoices.find(item => item?.was_chosen);
    const ancientSkipped = ancientChoices.filter(item => !item?.was_chosen);
    const relicChoices = ancientChoices.length ? [] : safeArray(stats.relic_choices).filter(item => item?.choice);
    const potionChoices = safeArray(stats.potion_choices).filter(item => item?.choice);
    return {
      floor: node.floor,
      optionLabel: locale === 'zh'
        ? `第 ${node.floor} 层 · ${buildFloorTitle(codex, node, locale)}`
        : `Floor ${node.floor} · ${buildFloorTitle(codex, node, locale)}`,
      title: locale === 'zh'
        ? `第 ${node.floor} 层 · ${buildFloorTitle(codex, node, locale)}`
        : `Floor ${node.floor} · ${buildFloorTitle(codex, node, locale)}`,
      subtitle: `${actNames[node.actIndex] || `Act ${node.actIndex + 1}`} · ${getRoomTypeLabel(locale, node.roomType)}`,
      hp: Number.isFinite(stats.current_hp) && Number.isFinite(stats.max_hp) ? `${stats.current_hp}/${stats.max_hp}` : '',
      gold: Number.isFinite(stats.current_gold) ? String(stats.current_gold) : '',
      damageTaken: Number(stats.damage_taken || 0),
      turnsTaken: Number(node.turnsTaken || 0),
      rewardChoices,
      ancientChoice: ancientChoices.length ? {
        picked: ancientPicked ? resolveRelicLabel(codex, ancientPicked.TextKey || ancientPicked.choice) : null,
        skipped: ancientSkipped.map(item => resolveRelicLabel(codex, item.TextKey || item.choice)),
      } : null,
      relicRewards: relicChoices.filter(item => item.was_picked !== false).map(item => resolveRelicLabel(codex, item.choice)),
      potionRewards: potionChoices.filter(item => item.was_picked !== false).map(item => resolvePotionLabel(codex, item.choice)),
      restAction: formatRestAction(locale, safeArray(stats.rest_site_choices)[0] || ''),
    };
  });
}

function buildAllCardPicks(codex, analysis, actNames) {
  const groups = actNames.map((actName, index) => ({
    actName,
    picks: analysis.cardRewardNodes
      .filter(node => node.actIndex === index)
      .map(node => {
        const picked = safeArray(node.stats?.card_choices).find(choice => choice?.was_picked);
        if (!picked?.card) return null;
        const card = resolveCardLabel(codex, picked.card);
        return {
          floor: node.floor,
          label: card.label,
          imageUrl: card.imageUrl,
          boss: node.roomType === 'boss',
          elite: node.roomType === 'elite',
          source: node.roomType,
        };
      })
      .filter(Boolean),
  }));
  return groups.filter(group => group.picks.length);
}

function buildAllRelics(codex, analysis, actNames) {
  const groups = actNames.map((actName, index) => ({
    actName,
    relics: analysis.nodes
      .filter(node => node.actIndex === index)
      .flatMap(node => {
        const ancientPicked = safeArray(node.stats?.ancient_choice).find(item => item?.was_chosen);
        const ancientRelicId = ancientPicked?.TextKey || ancientPicked?.choice || '';
        const items = [];
        if (ancientPicked) {
          const ancientRelic = resolveRelicLabel(codex, ancientRelicId);
          items.push({
            floor: node.floor,
            label: ancientRelic.label,
            imageUrl: ancientRelic.imageUrl,
            source: 'ancient',
          });
        }
        safeArray(node.stats?.relic_choices)
          .filter(choice => choice?.was_picked !== false && choice.choice)
          .filter(choice => stripPrefix(choice.choice) !== stripPrefix(ancientRelicId))
          .forEach(choice => {
            const relic = resolveRelicLabel(codex, choice.choice);
            items.push({
              floor: node.floor,
              label: relic.label,
              imageUrl: relic.imageUrl,
              source: node.roomType,
            });
          });
        return items;
      }),
  }));
  return groups.filter(group => group.relics.length);
}

export async function buildReportFromRun(run, options = {}) {
  const locale = resolveLocale(options.locale);
  const playerRecord = selectPlayer(run, options.playerSelector);
  const analysis = analyzeRun(run, playerRecord);
  const codex = await loadCodex(locale);
  const actNames = buildActNames(codex, safeArray(run.acts));
  const character = readCharacter(codex, stripPrefix(analysis.player.character));
  const characterName = character?.name || toPrettyFallback(analysis.player.character);
  const characterSlug = resolveCharacterSlug(analysis.player.character);
  const warnings = [];
  if (codex.warning === 'fallback') warnings.push(t(locale, 'warningCodexFallback'));
  if (codex.warning === 'english') warnings.push(t(locale, 'warningCodexEnglish'));
  const resultLabel = getResultLabel(locale, run);
  const resultTone = run.was_abandoned ? 'muted' : run.win ? 'success' : 'danger';
  const finalHpPoint = analysis.hpCurve[analysis.hpCurve.length - 1] || null;
  const pathStats = {
    relics: safeArray(analysis.player.relics).length,
    goldSpent: analysis.goldSpent,
    cardRewards: analysis.actCardRewardCounts.reduce((sum, value) => sum + value, 0),
    restSites: analysis.restSites,
    restCount: analysis.restCount,
    smithCount: analysis.smithCount,
    eliteCount: analysis.actEliteCounts.reduce((sum, value) => sum + value, 0),
    finalDeck: safeArray(analysis.player.deck).length,
  };
  const metaLine = [
    formatDuration(run.run_time || 0, locale),
    formatStartTime(run.start_time || 0, locale),
    run.build_id || t(locale, 'unknown'),
    `${t(locale, 'seedShort')} ${run.seed || t(locale, 'unknown')}`,
  ].join(' · ');

  return {
    locale,
    themeCharacter: characterSlug,
    fileLabel: options.fileLabel || '',
    title: locale === 'zh'
      ? `${characterName} ${t(locale, 'ascensionCompact')} ${run.ascension ?? 0}`
      : `${characterName} ${t(locale, 'ascensionCompact')}${run.ascension ?? 0}`,
    metaLine,
    resultLabel,
    resultTone,
    players: listPlayers(run).map(player => {
      const data = readCharacter(codex, stripPrefix(player.character));
      return {
        id: player.id,
        selected: player.id === playerRecord.id,
        label: `P${player.id} · ${data?.name || toPrettyFallback(player.character)}`,
      };
    }),
    warnings,
    heroStats: [
      {
        icon: '❤️',
        label: t(locale, 'finalHp'),
        value: finalHpPoint ? `${finalHpPoint.current}/${finalHpPoint.max}` : t(locale, 'unknown'),
        detail: analysis.lowestHpPoint ? `${t(locale, 'lowestHp')} ${analysis.lowestHpPoint.current}/${analysis.lowestHpPoint.max} · ${t(locale, 'floor')} ${analysis.lowestHpPoint.floor}` : '',
      },
      {
        icon: '🃏',
        label: t(locale, 'finalDeck'),
        value: String(pathStats.finalDeck),
        detail: `${t(locale, 'chosenCards')}: ${formatCountByAct(locale, analysis.actCardRewardCounts, actNames)}`,
      },
      {
        icon: '🔥',
        label: t(locale, 'restSites'),
        value: String(pathStats.restSites),
        detail: `${t(locale, 'rest')} ${pathStats.restCount} · ${t(locale, 'smith')} ${pathStats.smithCount} · ${t(locale, 'other')} ${analysis.otherRestCount}`,
      },
      {
        icon: '😈',
        label: t(locale, 'elites'),
        value: String(pathStats.eliteCount),
        detail: formatCountByAct(locale, analysis.actEliteCounts, actNames),
      },
    ],
    charts: [
      {
        id: 'hp',
        title: t(locale, 'hpCurve'),
        yMin: 0,
        series: [
          {
            label: t(locale, 'max'),
            color: '#ffd180',
            points: buildSparkPoints(analysis.hpCurve.map(point => ({ x: point.x, y: point.max }))),
          },
          {
            label: t(locale, 'current'),
            color: '#ff8a80',
            points: buildSparkPoints(analysis.hpCurve.map(point => ({ x: point.x, y: point.current }))),
          },
        ],
      },
      {
        id: 'deck',
        title: t(locale, 'deckCurve'),
        yMin: 0,
        series: [
          {
            label: t(locale, 'deck'),
            color: '#80d8ff',
            points: buildSparkPoints(analysis.deckCurve),
          },
        ],
      },
    ],
    ancientChoicesTitle: t(locale, 'ancientChoices'),
    ancientChoices: analysis.ancientChoices.map(node => buildAncientChoiceList(codex, node, actNames[node.actIndex] || `Act ${node.actIndex + 1}`, locale)),
    bossRewardsTitle: t(locale, 'bossRewards'),
    bossRewardsEmpty: t(locale, 'noBossRewards'),
    bossRewards: analysis.bossRewardNodes.map(node => buildRewardLabel(codex, node, actNames[node.actIndex] || `Act ${node.actIndex + 1}`, locale)),
    allCardPicksTitle: t(locale, 'allCardPicks'),
    allCardPicksEmpty: t(locale, 'noCardPicks'),
    allCardPicks: buildAllCardPicks(codex, analysis, actNames),
    allRelicsTitle: t(locale, 'allRelics'),
    allRelicsEmpty: t(locale, 'noRelics'),
    allRelics: buildAllRelics(codex, analysis, actNames),
    floorDetailsTitle: t(locale, 'floorDetails'),
    floorDetails: buildFloorDetails(codex, analysis, actNames, locale),
    toughestFightsTitle: t(locale, 'toughestFights'),
    toughestFightsEmpty: t(locale, 'noDamageFights'),
    toughestFights: analysis.topDamageFights.map(node => buildFightLabel(codex, node, actNames[node.actIndex] || `Act ${node.actIndex + 1}`, locale)),
    openingRewardsTitle: t(locale, 'openingRewards'),
    openingRewardsEmpty: t(locale, 'noOpeningRewards'),
    openingRewards: analysis.combatRewardNodes.slice(0, 3).map(node => buildRewardLabel(codex, node, actNames[node.actIndex] || `Act ${node.actIndex + 1}`, locale)),
    text: {
      picked: t(locale, 'picked'),
      skipped: t(locale, 'skipped'),
      none: t(locale, 'none'),
      floorShort: t(locale, 'floorShort'),
      hoverUnavailable: t(locale, 'hoverUnavailable'),
      rewards: t(locale, 'rewards'),
      choices: t(locale, 'choices'),
    },
    cli: {
      metaLine,
      resultLabel,
      resultTone,
      characterName,
      pathStats,
      finalHp: finalHpPoint ? `${finalHpPoint.current}/${finalHpPoint.max}` : t(locale, 'unknown'),
      lowestHpPoint: analysis.lowestHpPoint,
      actNames,
      otherRestCount: analysis.otherRestCount,
      actCardRewardCounts: analysis.actCardRewardCounts,
      actEliteCounts: analysis.actEliteCounts,
      goldSpent: pathStats.goldSpent,
      cardRewards: pathStats.cardRewards,
    },
  };
}

export async function buildReportFromText(text, options = {}) {
  return buildReportFromRun(parseRunText(text), options);
}
