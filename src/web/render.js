function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getChartMeta(chartId) {
  if (chartId === 'hp') return { icon: '💗', colorClass: 'chart-hp' };
  return { icon: '🃏', colorClass: 'chart-deck' };
}

function renderEntity(entity, picked) {
  if (!entity) return '';
  const rarityClass = entity.rarity ? ` rarity-${entity.rarity}` : '';
  return `
    <span class="pick-pill${picked ? ' picked' : ''}">
      ${picked ? '<span class="pick-state">✓</span>' : ''}
      ${entity.imageUrl ? `<img src="${escapeHtml(entity.imageUrl)}" alt="">` : ''}
      <span class="entity-label${rarityClass}">${escapeHtml(entity.label)}</span>
    </span>
  `;
}

function renderChoiceItem(item) {
  return `
    <article class="choice-item">
      <div class="choice-head">
        <strong>${escapeHtml(item.label)}</strong>
        ${item.detail ? `<span>${escapeHtml(item.detail)}</span>` : ''}
      </div>
      <div class="choice-pills">
        ${item.picked ? renderEntity(item.picked, true) : ''}
        ${item.skipped.map(entry => renderEntity(entry, false)).join('')}
      </div>
    </article>
  `;
}

function renderCompactPick(item, locale) {
  const source = getCompactSourceMeta(item.source, locale);
  const rarityClass = item.rarity ? ` rarity-${item.rarity}` : '';
  return `
    <span class="compact-pick ${source.className}${item.state === 'removed' ? ' removed' : ''}${item.state === 'picked' ? ' picked' : ''}">
      <span class="compact-pick-floor">F${item.floor}</span>
      <span class="compact-pick-source">${source.emoji}</span>
      ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : ''}
      <span class="entity-label${rarityClass}">${escapeHtml(item.label)}</span>
    </span>
  `;
}

function getCompactSourceMeta(source, locale) {
  if (source === 'ancient') return { className: 'ancient', label: locale === 'zh' ? '先古' : 'Ancient', emoji: '🧿' };
  if (source === 'remove') return { className: 'remove', label: locale === 'zh' ? '移除' : 'Remove', emoji: '❌' };
  if (source === 'elite') return { className: 'elite', label: locale === 'zh' ? '精英' : 'Elite', emoji: '😈' };
  if (source === 'boss') return { className: 'boss', label: 'Boss', emoji: '👑' };
  if (source === 'event') return { className: 'event', label: locale === 'zh' ? '事件' : 'Event', emoji: '🎲' };
  if (source === 'treasure') return { className: 'treasure', label: locale === 'zh' ? '宝箱' : 'Treasure', emoji: '🎁' };
  if (source === 'shop') return { className: 'shop', label: locale === 'zh' ? '商店' : 'Shop', emoji: '🛒' };
  return { className: 'normal', label: locale === 'zh' ? '普通' : 'Normal', emoji: '⚪' };
}

function renderCardActivity(entry, locale) {
  const source = getCompactSourceMeta(entry.source, locale);
  const rarityClass = entry.rarity ? ` rarity-${entry.rarity}` : '';
  return `
    <span class="pick-pill activity-pill ${source.className}${entry.state === 'picked' ? ' picked' : ''}${entry.state === 'removed' ? ' removed' : ''}">
      ${entry.state === 'picked' ? '<span class="pick-state">✓</span>' : entry.state === 'removed' ? '<span class="pick-state">✕</span>' : '<span class="pick-state"></span>'}
      <span class="activity-source">${escapeHtml(source.emoji)}</span>
      ${entry.imageUrl ? `<img src="${escapeHtml(entry.imageUrl)}" alt="">` : ''}
      <span class="entity-label${rarityClass}">${escapeHtml(entry.label)}</span>
    </span>
  `;
}

function renderCompactRelic(item, locale) {
  const source = getCompactSourceMeta(item.source, locale);
  return `
    <span class="compact-pick ${source.className}">
      <span class="compact-pick-floor">F${item.floor}</span>
      <span class="compact-pick-source">${source.emoji}</span>
      ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : ''}
      <span>${escapeHtml(item.label)}</span>
    </span>
  `;
}

function renderMoment(moment) {
  return `
    <article class="moment-item">
      ${moment.parts.map(part => `
        ${part.tone === 'tag'
          ? `
            <span class="moment-part tone-tag">
              ${part.imageUrl ? `<img src="${escapeHtml(part.imageUrl)}" alt="">` : ''}
              <span class="entity-label${part.rarity ? ` rarity-${part.rarity}` : ''}">${escapeHtml(part.text)}</span>
            </span>
          `
          : `<span class="moment-part${part.tone ? ` tone-${part.tone}` : ''}">${escapeHtml(part.text)}</span>`}
      `).join('')}
    </article>
  `;
}

function renderIcon(name) {
  if (name === 'list') {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `;
  }
  if (name === 'folder') {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4.2l1.6 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `;
  }
  if (name === 'chevron') {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
  if (name === 'upload') {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 20H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4.1l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M12 16V9m0 0-2.5 2.5M12 9l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Zm0 0c2.2 2 3.5 5.2 3.5 9S14.2 19 12 21m0-18c-2.2 2-3.5 5.2-3.5 9s1.3 7 3.5 9m-8-9h18M4.9 8.5h14.2M4.9 15.5h14.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  `;
}

function buildChartShape(chart) {
  const allPoints = chart.series.flatMap(series => series.points);
  if (!allPoints.length) return { svg: '' };
  const width = 660;
  const height = 248;
  const left = 52;
  const right = 14;
  const top = 18;
  const bottom = 38;
  const maxX = Math.max(...allPoints.map(point => point.x));
  const minY = Number.isFinite(chart.yMin) ? chart.yMin : Math.min(...allPoints.map(point => point.y));
  const maxY = Math.max(...allPoints.map(point => point.y));
  const xScale = value => left + (maxX === 0 ? 0 : (value / maxX) * (width - left - right));
  const yScale = value => height - bottom - ((value - minY) / Math.max(maxY - minY, 1)) * (height - top - bottom);
  const ticks = [minY, Math.round((minY + maxY) / 2), maxY].filter((value, index, list) => list.indexOf(value) === index);
  const endX = xScale(maxX);
  return {
    svg: `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chart.title)}">
        ${ticks.map(value => `
          <g>
            <line x1="${left}" y1="${yScale(value)}" x2="${width - right}" y2="${yScale(value)}" stroke="rgba(255,255,255,.08)"></line>
            <text x="${left - 10}" y="${yScale(value) + 5}" text-anchor="end" class="chart-tick">${value}</text>
          </g>
        `).join('')}
        <text x="${left}" y="${height - 8}" class="chart-tick">0</text>
        <text x="${width - right}" y="${height - 8}" text-anchor="end" class="chart-tick">F${maxX}</text>
        ${chart.series.map(series => {
          const path = series.points.map((point, index) => `${index ? 'L' : 'M'} ${xScale(point.x)} ${yScale(point.y)}`).join(' ');
          return `<path d="${path}" fill="none" stroke="${series.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>`;
        }).join('')}
        <line class="chart-hover-line" x1="${endX}" y1="${top}" x2="${endX}" y2="${height - bottom}" stroke="rgba(255,255,255,.25)" stroke-dasharray="4 4"></line>
        ${chart.series.map(series => {
          const point = series.points[series.points.length - 1];
          return `<circle class="chart-hover-dot" cx="${xScale(point.x)}" cy="${yScale(point.y)}" r="4" fill="${series.color}"></circle>`;
        }).join('')}
        <rect class="chart-hitbox" x="${left}" y="${top}" width="${width - left - right}" height="${height - top - bottom}" fill="transparent"></rect>
      </svg>
    `,
  };
}

function renderChart(chart) {
  const shape = buildChartShape(chart);
  const meta = getChartMeta(chart.id);
  return `
    <section class="panel panel-chart" data-chart-id="${escapeHtml(chart.id)}">
      <div class="panel-head">
        <h3>${meta.icon} ${escapeHtml(chart.title)}</h3>
      </div>
      <div class="chart-wrap ${meta.colorClass}">
        <div class="chart-shell">${shape.svg}</div>
        <div class="chart-tooltip" hidden></div>
      </div>
    </section>
  `;
}

function renderPanel(title, content, extraClass = '') {
  return `
    <section class="panel ${extraClass}">
      <div class="panel-head"><h3>${escapeHtml(title)}</h3></div>
      ${content}
    </section>
  `;
}

function renderLocaleButton(state) {
  return `
    <button class="icon-btn" type="button" data-locale="${state.locale === 'zh' ? 'en' : 'zh'}" title="${state.locale === 'zh' ? 'English' : '中文'}" aria-label="${state.locale === 'zh' ? 'English' : '中文'}">
      ${renderIcon('globe')}
    </button>
  `;
}

function renderHighlightedPath(pathText) {
  return escapeHtml(pathText).replace(/&lt;steam id&gt;/g, '<mark>&lt;steam id&gt;</mark>');
}

function renderLoading(state) {
  if (!state.loading) return '';
  return `
    <div class="loading-overlay" aria-live="polite">
      <div class="loading-spinner"></div>
      <div class="loading-label">${escapeHtml(state.text.loading)}</div>
    </div>
  `;
}

export function renderApp(state) {
  const report = state.report;
  if (!report) {
    const hasRuns = state.runEntries.length > 0;
    if (hasRuns) {
      return `
        <div class="page">
          <header class="topbar">
            <div class="topbar-row">
              <div class="topbar-main">
                <div class="topbar-title">Spire Analyzer</div>
                <div class="topbar-meta">
                  <span>${escapeHtml(state.text.sourceHint)}</span>
                </div>
              </div>
              <div class="topbar-actions">
                ${renderLocaleButton(state)}
                ${state.canChooseDirectory ? `<button class="icon-btn" type="button" data-action="choose-directory" title="${escapeHtml(state.text.chooseDirectory)}" aria-label="${escapeHtml(state.text.chooseDirectory)}">${renderIcon('folder')}</button>` : ''}
                <button class="icon-btn" type="button" data-action="choose-file" title="${escapeHtml(state.text.changeFile)}" aria-label="${escapeHtml(state.text.changeFile)}">${renderIcon('upload')}</button>
              </div>
            </div>
          </header>
          ${state.error ? `<section class="notice-stack"><div class="notice notice-error">${escapeHtml(state.error)}</div></section>` : ''}
          <section class="panel run-list-panel">
            <div class="panel-head">
              <h3>${escapeHtml(state.text.runListTitle)}</h3>
              <span class="run-list-count">${escapeHtml(state.text.scanResults)}: ${state.runEntries.length}</span>
            </div>
            <div class="run-list">
              ${state.runEntries.map(entry => `
                <button class="run-entry${entry.id === state.activeRunId ? ' active' : ''}" type="button" data-run-entry="${escapeHtml(entry.id)}">
                  <div class="run-entry-main">
                    <div class="run-entry-title-row">
                      <strong>${escapeHtml(entry.title)}</strong>
                      <span class="status-pill status-${entry.resultTone}">${escapeHtml(entry.resultLabel)}</span>
                    </div>
                    <div class="run-entry-meta">${escapeHtml(entry.metaLine)}</div>
                    <div class="run-entry-path">${escapeHtml(entry.pathLabel)}</div>
                  </div>
                </button>
              `).join('')}
            </div>
          </section>
          ${renderLoading(state)}
        </div>
      `;
    }
    return `
      <div class="page page-upload-only">
        <div class="floating-actions">
          ${renderLocaleButton(state)}
        </div>
        <div class="upload-stack">
          <section class="upload-card${state.dragActive ? ' drag-active' : ''}" data-dropzone="true">
            <div class="upload-card-title">Spire Analyzer</div>
            <button class="upload-drop-box" type="button" data-action="choose-source">
              <span class="upload-drop-title">${escapeHtml(state.text.uploadCta)}</span>
              <span class="upload-drop-subtitle">${escapeHtml(state.text.uploadDropCta)}</span>
            </button>
            <div class="upload-source-actions">
              ${state.canChooseDirectory ? `<button class="filled-btn" type="button" data-action="choose-directory">${renderIcon('folder')}<span>${escapeHtml(state.text.chooseDirectory)}</span></button>` : ''}
              <button class="filled-btn subtle-btn" type="button" data-action="choose-file">${renderIcon('upload')}<span>${escapeHtml(state.text.chooseRunFile)}</span></button>
            </div>
            <div class="support-note">${escapeHtml(state.text.sourceHint)}</div>
            <div class="path-block">
              <div class="path-label">${escapeHtml(state.text.savePath)}</div>
              <div class="path-code-wrap">
                <pre><code>${renderHighlightedPath(state.historyPath)}</code></pre>
                <button class="copy-btn" type="button" data-copy-path="true" title="${escapeHtml(state.text.copyPath)}" aria-label="${escapeHtml(state.text.copyPath)}">⧉</button>
              </div>
              ${state.copyMessage ? `<div class="path-copy-note">${escapeHtml(state.copyMessage)}</div>` : ''}
            </div>
            ${state.error ? `<div class="notice notice-error">${escapeHtml(state.error)}</div>` : ''}
          </section>
        </div>
        ${renderLoading(state)}
      </div>
    `;
  }

  const statusClass = `status-${report.resultTone}`;
  const selectedFloor = report.floorDetails.find(item => item.floor === state.selectedFloor) || report.floorDetails[report.floorDetails.length - 1] || null;
  const selectedFloorIndex = selectedFloor ? report.floorDetails.findIndex(item => item.floor === selectedFloor.floor) : -1;
  return `
    <div class="page">
      <header class="topbar">
        <div class="topbar-row">
          <div class="topbar-main">
            <div class="topbar-title">${escapeHtml(report.title)}</div>
            <div class="topbar-meta">
              <span class="status-pill ${statusClass}">${escapeHtml(report.resultLabel)}</span>
              <span>${escapeHtml(report.metaLine)}</span>
            </div>
          </div>
          <div class="topbar-actions">
            ${renderLocaleButton(state)}
            ${state.canChooseDirectory ? `<button class="icon-btn" type="button" data-action="choose-directory" title="${escapeHtml(state.text.chooseDirectory)}" aria-label="${escapeHtml(state.text.chooseDirectory)}">${renderIcon('folder')}</button>` : ''}
            <button class="icon-btn" type="button" data-action="choose-file" title="${escapeHtml(state.text.changeFile)}" aria-label="${escapeHtml(state.text.changeFile)}">${renderIcon('upload')}</button>
            ${state.runEntries.length > 0 ? `<button class="icon-btn icon-btn-accent" type="button" data-action="show-runs" title="${escapeHtml(state.text.openRunList)}" aria-label="${escapeHtml(state.text.openRunList)}">${renderIcon('list')}</button>` : ''}
          </div>
        </div>
        ${report.players.length > 1 ? `
          <div class="player-switch">
            ${report.players.map(player => `<button class="player-pill${player.selected ? ' active' : ''}" type="button" data-player="${player.id}">${escapeHtml(player.label)}</button>`).join('')}
          </div>
        ` : ''}
      </header>

      ${report.warnings.length ? `<section class="notice-stack">${report.warnings.map(item => `<div class="notice">${escapeHtml(item)}</div>`).join('')}</section>` : ''}

      <section class="stat-strip">
        ${report.heroStats.map(item => `
          <article class="stat-token">
            <div class="stat-top">
              <span class="stat-icon">${item.icon}</span>
              <span class="stat-label">${escapeHtml(item.label)}</span>
            </div>
            <div class="stat-value${item.detail ? '' : ' stat-value-last'}">${escapeHtml(item.value)}</div>
            ${item.detail ? `<div class="stat-detail">${escapeHtml(item.detail)}</div>` : ''}
          </article>
        `).join('')}
      </section>

      <section class="report-grid">
        ${renderChart(report.charts[0])}
        ${renderChart(report.charts[1])}
        ${renderPanel(report.momentsTitle, report.moments.length ? `<div class="moment-list">${report.moments.map(renderMoment).join('')}</div>` : `<div class="empty">${escapeHtml(report.momentsEmpty)}</div>`, 'panel-full')}
        ${renderPanel(report.allCardPicksTitle, report.allCardPicks.length ? `
          <div class="pick-groups">
            <div class="pick-legend">
              ${['normal', 'remove', 'elite', 'boss', 'shop', 'event'].map(source => {
                const meta = getCompactSourceMeta(source, state.locale);
                return `<span class="compact-pick-kind ${meta.className}">${escapeHtml(`${meta.emoji} ${meta.label}`)}</span>`;
              }).join('')}
            </div>
            ${report.allCardPicks.map(group => `
              <article class="pick-group">
                <strong>${escapeHtml(group.actName)}</strong>
                <div class="compact-picks">
                  ${group.picks.map(item => renderCompactPick(item, state.locale)).join('')}
                </div>
              </article>
            `).join('')}
          </div>
        ` : `<div class="empty">${escapeHtml(report.allCardPicksEmpty)}</div>`, 'panel-full')}
        ${renderPanel(report.allRelicsTitle, report.allRelics.length ? `
          <div class="pick-groups">
            <div class="pick-legend">
              ${['normal', 'elite', 'boss', 'treasure', 'event', 'shop', 'ancient'].map(source => {
                const meta = getCompactSourceMeta(source, state.locale);
                return `<span class="compact-pick-kind ${meta.className}">${escapeHtml(`${meta.emoji} ${meta.label}`)}</span>`;
              }).join('')}
            </div>
            ${report.allRelics.map(group => `
              <article class="pick-group">
                <strong>${escapeHtml(group.actName)}</strong>
                <div class="compact-picks">
                  ${group.relics.map(item => renderCompactRelic(item, state.locale)).join('')}
                </div>
              </article>
            `).join('')}
          </div>
        ` : `<div class="empty">${escapeHtml(report.allRelicsEmpty)}</div>`, 'panel-full')}
        ${renderPanel(report.floorDetailsTitle, selectedFloor ? `
          <div class="floor-detail">
            <div class="floor-detail-head">
              <div class="floor-page-nav">
                <button class="icon-btn floor-step-btn" type="button" data-floor-step="prev" title="${escapeHtml(state.text.previousFloor)}" aria-label="${escapeHtml(state.text.previousFloor)}"${selectedFloorIndex <= 0 ? ' disabled' : ''}>
                  <span class="floor-step-arrow left">${renderIcon('chevron')}</span>
                </button>
                <div class="floor-page-indicator">${selectedFloorIndex + 1} / ${report.floorDetails.length}</div>
                <button class="icon-btn floor-step-btn" type="button" data-floor-step="next" title="${escapeHtml(state.text.nextFloor)}" aria-label="${escapeHtml(state.text.nextFloor)}"${selectedFloorIndex >= report.floorDetails.length - 1 ? ' disabled' : ''}>
                  <span class="floor-step-arrow">${renderIcon('chevron')}</span>
                </button>
              </div>
              <div class="floor-picker" data-floor-picker>
                <button class="floor-picker-btn" type="button" data-floor-menu-toggle>
                  <span>${escapeHtml(selectedFloor.optionLabel)}</span>
                  ${renderIcon('chevron')}
                </button>
                <div class="floor-picker-menu${state.floorMenuOpen ? ' open' : ''}">
                  ${report.floorDetails.map(item => `
                    <button class="floor-picker-option${item.floor === selectedFloor.floor ? ' selected' : ''}" type="button" data-floor-option="${item.floor}">
                      ${escapeHtml(item.optionLabel)}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
            <article class="floor-card">
              <strong>${escapeHtml(selectedFloor.title)}</strong>
              <span>${escapeHtml(selectedFloor.subtitle)}</span>
              <div class="floor-stats">
                ${selectedFloor.hp ? `<span>💗 ${escapeHtml(selectedFloor.hp)}</span>` : ''}
                ${selectedFloor.gold ? `<span>🪙 ${escapeHtml(selectedFloor.gold)}</span>` : ''}
                <span>💥 ${escapeHtml(state.locale === 'zh' ? `${String(selectedFloor.damageTaken)} 伤害` : `${String(selectedFloor.damageTaken)} dmg`)}</span>
                ${selectedFloor.turnsTaken ? `<span>🔄 ${escapeHtml(state.locale === 'zh' ? `${String(selectedFloor.turnsTaken)} 回合` : `${String(selectedFloor.turnsTaken)} turns`)}</span>` : ''}
                ${selectedFloor.restAction ? `<span>🔥 ${escapeHtml(selectedFloor.restAction)}</span>` : ''}
              </div>
              ${selectedFloor.cardActivities.length ? `
                <div class="floor-section">
                  <div class="floor-section-title">🃏 ${escapeHtml(report.text.choices)}</div>
                  <div class="choice-pills">
                    ${selectedFloor.cardActivities.map(entry => renderCardActivity(entry, state.locale)).join('')}
                  </div>
                </div>
              ` : ''}
              ${selectedFloor.ancientChoice ? `
                <div class="floor-section">
                  <div class="floor-section-title">🧿 ${escapeHtml(report.ancientChoicesTitle)}</div>
                  <div class="choice-pills">
                    ${selectedFloor.ancientChoice.picked ? renderEntity(selectedFloor.ancientChoice.picked, true) : ''}
                    ${selectedFloor.ancientChoice.skipped.map(entry => renderEntity(entry, false)).join('')}
                  </div>
                </div>
              ` : ''}
              ${selectedFloor.rewardItems.length ? `
                <div class="floor-section">
                  <div class="floor-section-title">🎁 ${escapeHtml(report.text.rewards)}</div>
                  <div class="choice-pills">
                    ${selectedFloor.rewardItems.map(entry => renderEntity(entry, true)).join('')}
                  </div>
                </div>
              ` : ''}
            </article>
          </div>
        ` : '<div class="empty">-</div>', 'panel-full')}
        ${renderPanel(report.ancientChoicesTitle, report.ancientChoices.length ? `<div class="choice-list">${report.ancientChoices.map(renderChoiceItem).join('')}</div>` : '<div class="empty">-</div>', 'panel-third')}
        ${renderPanel(report.bossRewardsTitle, report.bossRewards.length ? `<div class="choice-list">${report.bossRewards.map(renderChoiceItem).join('')}</div>` : `<div class="empty">${escapeHtml(report.bossRewardsEmpty)}</div>`, 'panel-third')}
        ${renderPanel(report.openingRewardsTitle, report.openingRewards.length ? `<div class="choice-list">${report.openingRewards.map(renderChoiceItem).join('')}</div>` : `<div class="empty">${escapeHtml(report.openingRewardsEmpty)}</div>`, 'panel-third')}
        ${renderPanel(report.toughestFightsTitle, report.toughestFights.length ? `<div class="fight-list">${report.toughestFights.map(item => `
          <article class="fight-item">
            <strong>${escapeHtml(item.titleLead)} <span class="damage-accent">${escapeHtml(item.damageText)}</span></strong>
            <span>${escapeHtml(item.subtitle)}</span>
          </article>
        `).join('')}</div>` : `<div class="empty">${escapeHtml(report.toughestFightsEmpty)}</div>`, 'panel-full')}
      </section>
      ${renderLoading(state)}
    </div>
  `;
}
