# MoviePilot-Plugins-TenTomato

老大的 MoviePilot 插件仓库。

## 当前插件

- **SimpleTextBoard / 简单文本面板**
  - 一个最小可用的 MoviePilot V2 示例插件
  - 支持配置标题、正文
  - 支持在插件详情页和仪表板展示文本

- **VarietySpecialMapper / 综艺特别篇纠偏**
  - 解决国产综艺扩展内容和 TMDB 特别篇对不上的问题
  - 在整理完成后、刮削前自动把扩展内容改到 `Specials/S00E??`
  - 支持按“通用词库 -> 节目 -> 季 -> 类型”管理规则
  - 支持关键词可视化新增 / 删除、统一保存新增节目和季规则
  - 默认内置《喜人奇妙夜》《妻子的浪漫旅行》示例规则

- **IdentifierHelper / 自定义识别词助手**
  - 可视化管理 MoviePilot 自定义识别词
  - 支持树形分类、空分类/空子分类持久化
  - 列表页操作即保存，原始文本页自动保存
  - 适合把常用识别词按动漫、电影、字幕组、系列等维度整理

## 仓库结构

```text
.
├── icons/
├── package.v2.json
└── plugins.v2/
    ├── identifierhelper/
    ├── simpletextboard/
    └── varietyspecialmapper/
```

## 在 MoviePilot 中添加插件市场

将这个仓库地址加入插件市场：

```text
https://github.com/nbyyzjw/MoviePilot-Plugins-TenTomato
```

然后按需安装插件即可。
