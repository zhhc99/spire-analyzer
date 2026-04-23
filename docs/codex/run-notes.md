# run 格式与参考记录

## `.run` 结构

- 顶层关键字段: `players`, `acts`, `map_point_history`, `start_time`, `run_time`, `seed`, `ascension`, `win`
- `players[]` 保存最终牌组, 最终遗物, 角色, 玩家 id
- `map_point_history[act][floor]` 是逐节点历史
- 节点里最常用的数据在 `rooms[0]` 和对应玩家的 `player_stats[]`

## 本项目当前使用的字段

- 战斗与房间: `map_point_type`, `rooms[0].room_type`, `rooms[0].model_id`, `rooms[0].turns_taken`
- 生命与金币: `current_hp`, `max_hp`, `damage_taken`, `gold_spent`
- 牌组变化: `cards_gained`, `cards_removed`, `cards_transformed`
- 选卡: `card_choices`
- 休息处: `rest_site_choices`
- 先古: `ancient_choice`

## Spire Codex

- 主要使用 `/api/cards`, `/api/relics`, `/api/encounters`, `/api/characters`, `/api/acts`
- 中文语言码为 `zhs`, 英文语言码为 `eng`
- 请求失败时允许回退到英文或原始 ID, 但要明确提示

## history 路径

- Windows: `%APPDATA%/SlayTheSpire2/steam/<steamid>/profile*/saves/history`
- macOS: `~/Library/Application Support/SlayTheSpire2/steam/<steamid>/profile*/saves/history`
- Linux / Steam Deck: `~/.local/share/SlayTheSpire2/steam/<steamid>/profile*/saves/history`
