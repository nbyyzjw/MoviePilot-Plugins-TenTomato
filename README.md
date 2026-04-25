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
  - 默认内置《喜人奇妙夜》示例规则

## 仓库结构

```text
.
├── icons/
├── package.v2.json
└── plugins.v2/
    ├── simpletextboard/
    └── varietyspecialmapper/
```

## 在 MoviePilot 中添加插件市场

将这个仓库地址加入插件市场：

```text
https://github.com/nbyyzjw/MoviePilot-Plugins-TenTomato
```

然后按需安装插件即可。
