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
    id: stripPrefix(card?.id),
    label: withUpgradeSuffix(data?.name || fallback || t('en', 'unknown'), card?.current_upgrade_level || 0),
    imageUrl: imageUrl(data?.image_url),
    rarity: String(data?.rarity_key || data?.rarity || '').toLowerCase(),
    type: String(data?.type_key || data?.type || '').toLowerCase(),
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

function shiftMatch(items, rawId) {
  const target = stripPrefix(rawId);
  const index = items.findIndex(item => stripPrefix(item) === target);
  if (index === -1) return false;
  items.splice(index, 1);
  return true;
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
  const actRemovedCounts = run.map_point_history.map(() => 0);
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
    actCardRewardCounts[node.actIndex] += safeArray(stats.cards_gained).filter(card => card?.id).length;
    actRemovedCounts[node.actIndex] += safeArray(stats.cards_removed).filter(card => card?.id).length;
    if (choices.length) {
      cardRewardNodes.push(node);
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
    actRemovedCounts,
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

function buildCardActivityItems(codex, node) {
  const stats = node.stats || {};
  const pickedChoiceIds = safeArray(stats.card_choices)
    .filter(choice => choice?.was_picked && choice.card?.id)
    .map(choice => choice.card.id);
  const items = safeArray(stats.card_choices)
    .filter(choice => choice?.card)
    .map(choice => ({
      ...resolveCardLabel(codex, choice.card),
      state: choice?.was_picked ? 'picked' : 'skipped',
      source: node.roomType,
    }));
  safeArray(stats.cards_gained)
    .filter(card => card?.id)
    .forEach(card => {
      if (shiftMatch(pickedChoiceIds, card.id)) return;
      items.push({
        ...resolveCardLabel(codex, card),
        state: 'picked',
        source: node.roomType,
      });
    });
  safeArray(stats.cards_removed)
    .filter(card => card?.id)
    .forEach(card => {
      items.push({
        ...resolveCardLabel(codex, card),
        state: 'removed',
        source: 'remove',
      });
    });
  return items;
}

function buildRelicGainItems(codex, node) {
  const ancientPicked = safeArray(node.stats?.ancient_choice).find(item => item?.was_chosen);
  const ancientRelicId = ancientPicked?.TextKey || ancientPicked?.choice || '';
  const items = [];
  if (ancientPicked) {
    items.push({
      ...resolveRelicLabel(codex, ancientRelicId),
      id: ancientRelicId,
      source: 'ancient',
    });
  }
  safeArray(node.stats?.relic_choices)
    .filter(choice => choice?.was_picked !== false && choice.choice)
    .filter(choice => stripPrefix(choice.choice) !== stripPrefix(ancientRelicId))
    .forEach(choice => {
      items.push({
        ...resolveRelicLabel(codex, choice.choice),
        id: choice.choice,
        source: node.roomType,
      });
    });
  return items;
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
    const cardActivities = buildCardActivityItems(codex, node);
    const ancientChoices = safeArray(stats.ancient_choice);
    const ancientPicked = ancientChoices.find(item => item?.was_chosen);
    const ancientSkipped = ancientChoices.filter(item => !item?.was_chosen);
    const relicChoices = ancientChoices.length ? [] : safeArray(stats.relic_choices).filter(item => item?.choice);
    const potionChoices = safeArray(stats.potion_choices).filter(item => item?.choice);
    const rewardItems = [
      ...cardActivities.filter(item => item.state === 'picked').map(item => ({
        label: item.label,
        imageUrl: item.imageUrl,
        rarity: item.rarity,
        kind: 'card',
      })),
      ...relicChoices.filter(item => item.was_picked !== false).map(item => ({
        ...resolveRelicLabel(codex, item.choice),
        kind: 'relic',
      })),
      ...potionChoices.filter(item => item.was_picked !== false).map(item => ({
        ...resolvePotionLabel(codex, item.choice),
        kind: 'potion',
      })),
    ];
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
      cardActivities,
      ancientChoice: ancientChoices.length ? {
        picked: ancientPicked ? resolveRelicLabel(codex, ancientPicked.TextKey || ancientPicked.choice) : null,
        skipped: ancientSkipped.map(item => resolveRelicLabel(codex, item.TextKey || item.choice)),
      } : null,
      rewardItems,
      restAction: formatRestAction(locale, safeArray(stats.rest_site_choices)[0] || ''),
    };
  });
}

function buildAllCardPicks(codex, analysis, actNames) {
  const groups = actNames.map((actName, index) => ({
    actName,
    picks: analysis.nodes
      .filter(node => node.actIndex === index)
      .flatMap(node => buildCardActivityItems(codex, node)
        .filter(item => item.state !== 'skipped')
        .map(item => ({
          floor: node.floor,
          label: item.label,
          imageUrl: item.imageUrl,
          rarity: item.rarity,
          state: item.state,
          source: item.source,
        }))),
  }));
  return groups.filter(group => group.picks.length);
}

function buildAllRelics(codex, analysis, actNames) {
  const groups = actNames.map((actName, index) => ({
    actName,
    relics: analysis.nodes
      .filter(node => node.actIndex === index)
      .flatMap(node => buildRelicGainItems(codex, node).map(item => ({
        floor: node.floor,
        label: item.label,
        imageUrl: item.imageUrl,
        source: item.source,
      }))),
  }));
  return groups.filter(group => group.relics.length);
}

function buildTagPart(kind, entity) {
  return {
    text: entity.label,
    tone: 'tag',
    kind,
    imageUrl: entity.imageUrl,
    rarity: entity.rarity,
  };
}

function buildMoments(codex, analysis, run, locale) {
  const moments = [];
  const actNames = buildActNames(codex, safeArray(run.acts));
  const relicTimeline = analysis.nodes.flatMap(node => buildRelicGainItems(codex, node).map(item => ({ ...item, floor: node.floor })));
  const cardTimeline = analysis.nodes.flatMap(node => buildCardActivityItems(codex, node)
    .filter(item => item.state === 'picked')
    .map(item => ({ ...item, floor: node.floor, actIndex: node.actIndex })));
  const lowHpNode = run.win
    ? analysis.nodes
      .filter(node => Number.isFinite(node.stats?.current_hp) && node.stats.current_hp <= 3)
      .sort((left, right) => left.stats.current_hp - right.stats.current_hp || right.floor - left.floor)[0]
    : null;
  if (lowHpNode) {
    moments.push({
      id: 'close-call',
      parts: locale === 'zh'
        ? [
          { text: `你在第 ${lowHpNode.floor} 层距离死亡` },
          { text: '一线之隔', tone: 'red' },
          { text: ', 只剩 ' },
          { text: `${lowHpNode.stats.current_hp} HP`, tone: 'red' },
          { text: ', 但最终活了下来并走向了' },
          { text: '胜利', tone: 'green' },
          { text: '.' },
        ]
        : [
          { text: `On floor ${lowHpNode.floor}, you were ` },
          { text: 'one hit from death', tone: 'red' },
          { text: ' at just ' },
          { text: `${lowHpNode.stats.current_hp} HP`, tone: 'red' },
          { text: ', then held on and reached ' },
          { text: 'victory', tone: 'green' },
          { text: '.' },
        ],
    });
  }
  const pantographGain = relicTimeline.find(item => stripPrefix(item.id) === 'PANTOGRAPH');
  const pantographRelic = resolveRelicLabel(codex, 'RELIC.PANTOGRAPH');
  const elitesAfterPantograph = pantographGain
    ? analysis.nodes.filter(node => node.roomType === 'elite' && node.floor > pantographGain.floor && Number(node.stats?.current_hp) > 0).length
    : 0;
  if (pantographGain && elitesAfterPantograph >= 5) {
    moments.push({
      id: 'pantograph',
      parts: locale === 'zh'
        ? [
          { text: `你在第 ${pantographGain.floor} 层获得了` },
          buildTagPart('relic', pantographRelic),
          { text: ', 然后一路斩杀 ' },
          { text: `${elitesAfterPantograph} 只 😈 精英`, tone: 'gold' },
          ...(run.win
            ? [{ text: '. 这为你带来了十足的底气.' }]
            : [{ text: '. 这为你带来了十足的底气, ' }, { text: '但最终未能如愿...', tone: 'red' }]),
        ]
        : [
          { text: `You picked up ` },
          buildTagPart('relic', pantographRelic),
          { text: ` on floor ${pantographGain.floor}, then went on to slay ` },
          { text: `${elitesAfterPantograph} 😈 elites`, tone: 'gold' },
          ...(run.win
            ? [{ text: '. It gave you every reason to believe.' }]
            : [{ text: '. It gave you every reason to believe, ' }, { text: 'but it still was not enough...', tone: 'red' }]),
        ],
    });
  }
  const fastenGain = cardTimeline.find(item => item.id === 'FASTEN' && item.actIndex === 0);
  if (fastenGain) {
    moments.push({
      id: 'fasten',
      parts: locale === 'zh'
        ? [
          { text: `你在第 ${fastenGain.floor} 层就获得了` },
          buildTagPart('card', fastenGain),
          ...(run.win
            ? [{ text: ', 充足的格挡值, 让爬塔如同给大脑按摩一般享受.' }]
            : [{ text: ', 但这仍然没能拯救这局游戏...', tone: 'red' }]),
        ]
        : [
          { text: `You found ` },
          buildTagPart('card', fastenGain),
          { text: ` as early as floor ${fastenGain.floor}` },
          ...(run.win
            ? [{ text: ', then cruised forward with ease.' }]
            : [{ text: ', but even that could not save the run...', tone: 'red' }]),
        ],
    });
  }
  const totalPickedCardRewards = analysis.nodes.reduce((sum, node) => sum + safeArray(node.stats?.card_choices).filter(choice => choice?.was_picked && choice.card?.id).length, 0);
  if (totalPickedCardRewards > 50) {
    moments.push({
      id: 'many-card-rewards',
      parts: locale === 'zh'
        ? [
          { text: '你一路上抓取了 ' },
          { text: `${totalPickedCardRewards} 张卡牌`, tone: 'gold' },
          { text: '! 一定有什么奇怪的东西让你不得不这么做...' },
        ]
        : [
          { text: 'You picked up ' },
          { text: `${totalPickedCardRewards} cards`, tone: 'gold' },
          { text: ' from rewards along the way. Something strange must have made you do it...' },
        ],
    });
  }
  const finalDeckIds = safeArray(analysis.player.deck).map(card => stripPrefix(card?.id || card));
  if (['SPLASH', 'DISCOVERY', 'JACKPOT'].every(id => finalDeckIds.includes(id))) {
    const splash = resolveCardLabel(codex, { id: 'CARD.SPLASH' });
    const discovery = resolveCardLabel(codex, { id: 'CARD.DISCOVERY' });
    const jackpot = resolveCardLabel(codex, { id: 'CARD.JACKPOT' });
    moments.push({
      id: 'random-trio',
      parts: locale === 'zh'
        ? [
          { text: '你居然集齐了' },
          buildTagPart('card', splash),
          { text: ', ' },
          buildTagPart('card', discovery),
          { text: ' 和 ' },
          buildTagPart('card', jackpot),
          { text: '! 你的每场战斗都充满了有趣的未知.' },
        ]
        : [
          { text: 'You somehow assembled ' },
          buildTagPart('card', splash),
          { text: ', ' },
          buildTagPart('card', discovery),
          { text: ', and ' },
          buildTagPart('card', jackpot),
          { text: '. Every fight became a delightfully unpredictable mess.' },
        ],
    });
  }
  const skulkingFight = analysis.nodes
    .filter(node => stripPrefix(node.modelId) === 'SKULKING_COLONY_ELITE' && Number(node.stats?.damage_taken) > 20)
    .find(node => !cardTimeline.some(item => item.floor < node.floor && (item.type === 'skill' || item.type === 'power')));
  if (skulkingFight) {
    const skulking = resolveEncounterLabel(codex, skulkingFight.modelId);
    moments.push({
      id: 'skulking-bloodbath',
      parts: locale === 'zh'
        ? [
          { text: '你信心满满走进了精英房间, 结果运气不佳, 遇到了' },
          buildTagPart('encounter', { label: skulking, imageUrl: null }),
          { text: ', 被狠狠放了一波' },
          { text: '大血', tone: 'red' },
          { text: '.' },
        ]
        : [
          { text: 'You walked into an elite room full of confidence, then ran into ' },
          buildTagPart('encounter', { label: skulking, imageUrl: null }),
          { text: ' and got chunked for ' },
          { text: 'massive damage', tone: 'red' },
          { text: '.' },
        ],
    });
  }
  const runicPyramidGain = relicTimeline.find(item => stripPrefix(item.id) === 'RUNIC_PYRAMID');
  if (runicPyramidGain) {
    const runicPyramid = resolveRelicLabel(codex, 'RELIC.RUNIC_PYRAMID');
    moments.push({
      id: 'runic-pyramid',
      parts: locale === 'zh'
        ? [
          { text: `你在第 ${runicPyramidGain.floor} 层拿到了` },
          buildTagPart('relic', runicPyramid),
          ...(run.win
            ? [{ text: ', 你感受到一股不属于这个游戏的力量带领你走向胜利.' }]
            : [{ text: ', 这无异于打开了官方外挂' }, { text: '...但你居然没能走到最后!?', tone: 'red' }]),
        ]
        : [
          { text: `You found ` },
          buildTagPart('relic', runicPyramid),
          { text: ` on floor ${runicPyramidGain.floor}. It practically felt like cheating` },
          ...(run.win
            ? [{ text: '.' }]
            : [{ text: '...and you still did not make it to the end!?', tone: 'red' }]),
        ],
    });
  }
  const flawlessActCombat = analysis.nodes
    .reduce((acts, node) => {
      if (!COMBAT_ROOM_TYPES.has(node.roomType)) return acts;
      const entry = acts[node.actIndex] || { actIndex: node.actIndex, count: 0, flawless: true };
      entry.count += 1;
      if (Number(node.stats?.damage_taken || 0) > 0) entry.flawless = false;
      acts[node.actIndex] = entry;
      return acts;
    }, [])
    .filter(act => act?.count >= 3 && act.flawless)
    .sort((left, right) => right.actIndex - left.actIndex)[0];
  if (flawlessActCombat) {
    moments.push({
      id: 'flawless-act-combat',
      parts: locale === 'zh'
        ? [
          { text: '你在' },
          buildTagPart('act', { label: actNames[flawlessActCombat.actIndex], imageUrl: null }),
          { text: `进行了${flawlessActCombat.count}场战斗. 那些怪物的攻击凶猛, 却连你的皮毛都触碰不到.` },
        ]
        : [
          { text: 'In ' },
          buildTagPart('act', { label: actNames[flawlessActCombat.actIndex], imageUrl: null }),
          { text: `, you fought ${flawlessActCombat.count} battles. The monsters came at you fiercely, but could not even lay a scratch on you.` },
        ],
    });
  }
  if (run.win && analysis.restCount === 0) {
    moments.push({
      id: 'no-rest-win',
      parts: locale === 'zh'
        ? [
          { text: '和多数人不同, 你完全没有' },
          { text: '休息', tone: 'red' },
          { text: '过, 马不停蹄地冲上了塔顶. 你的黑眼圈让建筑师' },
          { text: '惊呆', tone: 'gold' },
          { text: '了.' },
        ]
        : [
          { text: 'Unlike most climbers, you never rested at all and charged straight to the top. The Architect was left utterly stunned.' },
        ],
    });
  }
  const lastBossNode = run.win
    ? analysis.nodes
      .filter(node => node.roomType === 'boss')
      .sort((left, right) => right.floor - left.floor)[0]
    : null;
  const enteredLastBossHp = lastBossNode
    ? Number(analysis.nodes.find(node => node.floor === lastBossNode.floor - 1)?.stats?.current_hp || 0)
    : 0;
  if (lastBossNode && enteredLastBossHp > 0 && enteredLastBossHp < 5) {
    moments.push({
      id: 'last-boss-last-stand',
      parts: locale === 'zh'
        ? [
          { text: `第 ${lastBossNode.floor} 层, 你拖着残破之躯面对强大的 ` },
          buildTagPart('encounter', { label: resolveEncounterLabel(codex, lastBossNode.modelId), imageUrl: null }),
          { text: '. 但你没有放弃!' },
        ]
        : [
          { text: `On floor ${lastBossNode.floor}, you dragged your broken body into the final fight against ` },
          buildTagPart('encounter', { label: resolveEncounterLabel(codex, lastBossNode.modelId), imageUrl: null }),
          { text: '. But you did not give up!' },
        ],
    });
  }
  const finalRelicIds = safeArray(analysis.player.relics).map(item => stripPrefix(item?.id || item));
  if (['LANTERN', 'CANDELABRA', 'CHANDELIER'].every(id => finalRelicIds.includes(id))) {
    const lantern = resolveRelicLabel(codex, 'RELIC.LANTERN');
    const candelabra = resolveRelicLabel(codex, 'RELIC.CANDELABRA');
    const chandelier = resolveRelicLabel(codex, 'RELIC.CHANDELIER');
    moments.push({
      id: 'lights',
      parts: locale === 'zh'
        ? [
          { text: '你集齐了' },
          buildTagPart('relic', lantern),
          { text: ', ' },
          buildTagPart('relic', candelabra),
          { text: ' 和 ' },
          buildTagPart('relic', chandelier),
          { text: ', 你的眼前' },
          { text: '一片明亮', tone: 'gold' },
          { text: '.' },
        ]
        : [
          { text: 'You assembled ' },
          buildTagPart('relic', lantern),
          { text: ', ' },
          buildTagPart('relic', candelabra),
          { text: ', and ' },
          buildTagPart('relic', chandelier),
          { text: '. Suddenly, everything felt ' },
          { text: 'bright', tone: 'gold' },
          { text: '.' },
        ],
    });
  }
  const act3Bosses = analysis.nodes.filter(node => node.actIndex === 2 && node.roomType === 'boss');
  if (act3Bosses.length === 2 && act3Bosses.every(node => Number(node.stats?.damage_taken || 0) === 0)) {
    moments.push({
      id: 'perfect-act3-bosses',
      parts: locale === 'zh'
        ? [
          { text: '真是一场大胜! 最后的双重 Boss 对你造成了 ' },
          { text: '0', tone: 'red' },
          { text: ' 点伤害. ' },
          { text: '你是怎么做到的?!', tone: 'red-italic' },
        ]
        : [
          { text: 'What a finish. The final pair of bosses dealt ' },
          { text: '0', tone: 'red' },
          { text: ' damage to you. ' },
          { text: 'How did you even do that?!', tone: 'red-italic' },
        ],
    });
  }
  const quadcastGain = cardTimeline.find(item => item.id === 'QUADCAST');
  const darknessGain = cardTimeline.find(item => item.id === 'DARKNESS');
  if (quadcastGain && !darknessGain && !run.win) {
    const quadcast = resolveCardLabel(codex, { id: 'CARD.QUADCAST' });
    const darkness = resolveCardLabel(codex, { id: 'CARD.DARKNESS' });
    moments.push({
      id: 'quadcast-miss',
      parts: locale === 'zh'
        ? [
          { text: `你在第 ${quadcastGain.floor} 层拿到了` },
          buildTagPart('card', quadcast),
          { text: ', 但无论如何都找不到' },
          buildTagPart('card', darkness),
          { text: ', 饮恨败北...', tone: 'red' },
        ]
        : [
          { text: `You picked up ` },
          buildTagPart('card', quadcast),
          { text: ` on floor ${quadcastGain.floor}, but never found ` },
          buildTagPart('card', darkness),
          { text: '. The run ended in defeat...', tone: 'red' },
        ],
    });
  }
  if (quadcastGain && darknessGain && run.win) {
    const quadcast = resolveCardLabel(codex, { id: 'CARD.QUADCAST' });
    moments.push({
      id: 'quadcast-darkness',
      parts: locale === 'zh'
        ? [
          { text: `你在第 ${quadcastGain.floor} 层拿到了` },
          buildTagPart('card', quadcast),
          { text: ', 你用它释放你的黑球, 轻松赢下这局. 你觉得这个游戏还是太简单了...' },
        ]
        : [
          { text: `You picked up ` },
          buildTagPart('card', quadcast),
          { text: ` on floor ${quadcastGain.floor}, used it to evoke your Dark orbs, and coasted to a win. The game felt a little too easy...` },
        ],
    });
  }
  const sealedThroneGain = cardTimeline.find(item => item.id === 'THE_SEALED_THRONE');
  if (sealedThroneGain && run.win) {
    const sealedThrone = resolveCardLabel(codex, { id: 'CARD.THE_SEALED_THRONE' });
    moments.push({
      id: 'sealed-throne',
      parts: locale === 'zh'
        ? [
          { text: `你在第 ${sealedThroneGain.floor} 层拿到了` },
          buildTagPart('card', sealedThrone),
          { text: ', 你感觉到源源不断的星辉在汇集. 你只是随便打牌就赢下了这局.' },
        ]
        : [
          { text: `You found ` },
          buildTagPart('card', sealedThrone),
          { text: ` on floor ${sealedThroneGain.floor}. Stars kept gathering around you, and the run ended up winning itself.` },
        ],
    });
  }
  const finalGold = Number(analysis.nodes[analysis.nodes.length - 1]?.stats?.current_gold || 0);
  if (finalGold > 1000) {
    moments.push({
      id: 'gold-hoard',
      parts: locale === 'zh'
        ? [
          { text: '你带着 ' },
          { text: `${finalGold} 金币`, tone: 'gold' },
          { text: ' 回到了塔底. 不论输赢, 你至少赚了.' },
        ]
        : [
          { text: 'You came back down the Spire with ' },
          { text: `${finalGold} gold`, tone: 'gold' },
          { text: '. Win or lose, at least you made a profit.' },
        ],
    });
  }
  const skippedBossFloor = Array.from(new Set(analysis.bossRewardNodes.map(node => node.floor)))
    .filter(floor => {
      const nodes = analysis.bossRewardNodes.filter(node => node.floor === floor);
      return nodes.length && nodes.every(node => safeArray(node.stats?.card_choices).length && safeArray(node.stats.card_choices).every(choice => !choice?.was_picked));
    })
    .sort((left, right) => right - left)[0];
  if (skippedBossFloor) {
    const regret = resolveCardLabel(codex, { id: 'CARD.REGRET' });
    moments.push({
      id: 'boss-skip',
      parts: locale === 'zh'
        ? [
          { text: `你在第 ${skippedBossFloor} 层跳过了 Boss 的稀有卡牌奖励` },
          ...(run.win
            ? [{ text: '. 真是个有' }, { text: '独特理解', tone: 'gold' }, { text: '的家伙!' }]
            : [{ text: ', 然后玩脱了. 你感到' }, buildTagPart('card', regret), { text: '...' }]),
        ]
        : [
          { text: `On floor ${skippedBossFloor}, you skipped every rare boss card reward` },
          ...(run.win
            ? [{ text: '. That is certainly ' }, { text: 'a unique line', tone: 'gold' }, { text: ' to take.' }]
            : [{ text: ', then everything unraveled. You were left with ' }, buildTagPart('card', regret), { text: '.' }]),
        ],
    });
  }
  const bossCount = analysis.nodes.filter(node => node.roomType === 'boss').length;
  if (!analysis.actEliteCounts.some(count => count > 0) && bossCount >= 2) {
    const badLuck = resolveCardLabel(codex, { id: 'CARD.BAD_LUCK' });
    moments.push({
      id: 'no-elites',
      parts: locale === 'zh'
        ? [
          { text: '你躲避了全部精英, 来到了高塔深处, ' },
          ...(run.win
            ? [{ text: '然后以' }, { text: '精妙', tone: 'gold' }, { text: '的战术取得了' }, { text: '胜利', tone: 'green' }, { text: '.' }]
            : [{ text: '然后被踹回了塔底. 你觉得这一定是' }, buildTagPart('card', badLuck), { text: ', 下次还要躲避精英才行.' }]),
        ]
        : [
          { text: 'You dodged every elite and still pushed deep into the Spire, ' },
          ...(run.win
            ? [{ text: 'then closed it out with ' }, { text: 'precision', tone: 'gold' }, { text: ' and ' }, { text: 'victory', tone: 'green' }, { text: '.' }]
            : [{ text: 'only to get kicked back down the tower. Surely it was ' }, buildTagPart('card', badLuck), { text: ', so skipping elites again must be right.' }]),
        ],
    });
  }
  return moments;
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
    removedCards: analysis.actRemovedCounts.reduce((sum, value) => sum + value, 0),
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
  const moments = buildMoments(codex, analysis, run, locale);

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
        icon: '💗',
        label: t(locale, 'finalHp'),
        value: finalHpPoint ? `${finalHpPoint.current}/${finalHpPoint.max}` : t(locale, 'unknown'),
        detail: analysis.lowestHpPoint ? `${t(locale, 'lowestHp')} ${analysis.lowestHpPoint.current}/${analysis.lowestHpPoint.max} · ${t(locale, 'floor')} ${analysis.lowestHpPoint.floor}` : '',
      },
      {
        icon: '🃏',
        label: t(locale, 'finalDeck'),
        value: String(pathStats.finalDeck),
        detail: `${t(locale, 'chosenCards')}: ${formatCountByAct(locale, analysis.actCardRewardCounts, actNames)} / ${t(locale, 'removedCards')} ${pathStats.removedCards}`,
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
    momentsTitle: t(locale, 'moments'),
    momentsEmpty: t(locale, 'noMoments'),
    moments,
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
      actRemovedCounts: analysis.actRemovedCounts,
      actEliteCounts: analysis.actEliteCounts,
      goldSpent: pathStats.goldSpent,
      cardRewards: pathStats.cardRewards,
      removedCards: pathStats.removedCards,
    },
  };
}

export async function buildReportFromText(text, options = {}) {
  return buildReportFromRun(parseRunText(text), options);
}
