---
name: UpdateDataTabAndSportCalendar
overview: 将数据统计页的默认 Tab 更改为按日，并将运动页面的日历组件逻辑和选中规则对齐热量页（清零时间、绑定选中值、增加最大/最小可选日期）。
todos:
  - id: update-data-tab
    content: 修改数据统计页 js 和 wxml，将默认 Tab 置为按日
    status: completed
  - id: update-sport-js
    content: 在运动页 js 中增加极值日期限制并初始化干净的今日时间戳
    status: completed
  - id: update-sport-wxml
    content: 修改运动页日历组件属性，绑定选中日期与极值
    status: completed
    dependencies:
      - update-sport-js
---

## Product Overview

优化小程序的数据统计页默认视图与运动页日历组件交互体验。

## Core Features

- 数据统计页面：进入时默认展示“按日”维度的统计数据，而非此前的“按周”。
- 运动日历优化：拉齐运动页和热量页的日历组件规则，包括开放过去日期的选择权限（提供 `minDate` 和 `maxDate`）、去除初始时间戳的时分秒干扰（置为 0 点），并显式绑定选中的日期值以在日历内正确显示高亮状态。

## Tech Architecture

修改主要集中在现有的逻辑层与视图层组件配置：

- **数据统计页**：修改 `currentTab` 和 `<t-tabs>` 的默认值。
- **运动记录页**：在 `data` 中引入 `minDate`（2023年1月1日）和 `maxDate`（今天），在 `onLoad` 中对时间戳进行时分秒清零，并将属性通过 `t-calendar` 组件的双向绑定呈现出来。

## Implementation Details

### Directory Structure

```
project-root/
├── miniprogram/
│   ├── pages/
│   │   ├── data/
│   │   │   ├── data.js      # [MODIFY] 将 currentTab 默认值由 'week' 改为 'day'
│   │   │   └── data.wxml    # [MODIFY] 将 t-tabs 的 defaultValue 由 'week' 改为 'day'
│   │   └── sport/
│   │       ├── sport.js     # [MODIFY] 在 data 中注入 minDate 和 maxDate，并在 onLoad 中用0点时间戳覆盖 selectedDate 初始值
│   │       └── sport.wxml   # [MODIFY] 给 t-calendar 增加 minDate, maxDate 和 value 属性绑定
```