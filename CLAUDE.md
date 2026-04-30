# 北京花期地图

MapLibre GL JS v4.7.1 交互式地图，展示北京各植物花期点位。Canvas2D 花粉粒子系统 +  Glass-morphism 面板。

## 技术栈

- MapLibre GL JS v4.7.1
- 原生 JS，Canvas2D
- OpenFreeMap 矢量瓦片 (WGS-84，无 GCJ-02 转换)
- 自定义 desaturated 地图样式，fill-extrusion 3D 建筑 (zoom 13+)

## 数据

源数据来自北京市园林绿化局"花开北京"2026 赏花地图与赏花指南。约 30+ 点位，13 种植物，16 区。

## 文件结构

- `index.html` — HTML 结构，glass 面板布局
- `app.js` — 地图逻辑、标记、花粉粒子、UI 交互
- `data.js` — 点位数据、植物颜色/图片、月度风场模型、花粉剖面
- `styles.css` — 完整 glass-morphism 样式
- `assets/plants/` — 植物图标图片

## 当前状态

- 3D depth 模式默认开启（pitch 48, bearing 315，东南视角）
- 结构层（骨架）默认关闭
- 面板默认收起，通过浮动按钮切换
- 默认 zoom: 11.2，中心点 [116.42, 39.93]
- 无地图导航控件（缩放用滚轮/双指）
- 无底部图例
- 月度风场模型驱动花粉粒子方向
- "适配当月"/"全城"按钮用于 fit-to-bounds
- 过场动画：页面加载后 1200ms 播放，6 段精选（3 月樱花→4 月海棠→5 月牡丹→6 月荷花→10 月银杏→全景），总长约 14 秒，支持跳过

## 注意事项

- 坐标均为 WGS-84，无需转换
- 花粉 Canvas 覆盖层 z-index: 420，面板 z-index: 650
