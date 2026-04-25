# VarietySpecialMapper

综艺特别篇纠偏插件。

## 解决的问题

很多国产综艺在 PT 站命名时，会把 `纯享`、`陪看`、`夜聊`、`惩罚室`、`聚会` 之类的扩展内容继续挂在正片季里，结果 Emby 按 TMDB 刮削时对不上集数。

这个插件会在 **整理完成后、刮削前** 做一次纠偏：

- 识别扩展内容类型
- 查询 TMDB 特别篇（S0）集列表
- 计算对应的特别篇集号
- 把文件移动到 `Specials/` 目录
- 把文件名改成 `S00E??`
- 让 MoviePilot 后续按正确季集继续刮削

## 当前版本

- 支持基于 `tmdbid + 类型关键词 + 期数` 自动映射
- 支持手工补充 `manual_matches`
- 默认内置《喜人奇妙夜》示例规则

## 规则说明

配置页的 `规则 JSON` 是一个数组，每个节目一条规则。

核心字段：

- `tmdbid`: 节目 TMDB ID
- `match_titles`: 辅助匹配标题
- `specials_folder`: 特别篇目录名，默认 `Specials`
- `types`: 类型定义
  - `source_keywords`: 从文件名识别这个类型
  - `tmdb_keywords`: 从 TMDB 特别篇标题识别这个类型
- `manual_matches`: 个别不规则内容可手工指定

## 注意

- 当前版本只处理 **本地存储**
- `requirements.txt` 暂时不需要
- 如果节目命名非常野，建议补一条 `manual_matches`
