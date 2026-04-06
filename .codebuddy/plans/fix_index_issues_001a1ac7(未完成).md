---
name: fix_index_issues
overview: 解决用户反馈的 4 个体验问题：优化 AI 汇总食物名称、完善体重卡片展示、修复进度环灰色 Bug（竞态条件）及增加显式的饮食记录编辑/删除功能。
todos:
  - id: update-cloud-function
    content: 优化 ai-record 云函数，动态拼接并返回聚合食物名称
    status: pending
  - id: fix-weight-display
    content: 在首页体重卡片中追加展示目标体重
    status: pending
  - id: fix-race-condition
    content: 使用 Promise.all 重构首页数据加载，修复进度环并发变灰 Bug
    status: pending
  - id: add-edit-delete-ui
    content: 为饮食流水添加点击操作菜单，实现记录的编辑与删除功能
    status: pending
---

## Product Overview

解决当前首页的四个核心体验与展示问题，涉及 AI 数据展示优化、界面信息补充、生命周期竞态问题修复以及数据管理交互完善。

## Core Features

- 优化 AI 饮食聚合逻辑，将固定的“一整份 (总计)”修改为展示真实食材名称，如“一整份 (牛肉面等)”。
- 在首页“体重管理”健康习惯卡片中，补充展示用户的目标体重，便于直观对比。
- 修复异步加载竞态条件导致的 Bug：今日摄入与运动消耗接口并发返回时间不一致，导致热量进度条未能正确计算超标比例（呈现灰色而非红色）。
- 取消“长按删除”的隐蔽交互，改为点击饮食记录弹出选项菜单，支持直观的“删除记录”和“编辑记录”（可手动修改菜品名与热量）。

## Tech Stack

- 微信小程序原生语法 (WXML/WXSS/JS)
- CloudBase Node.js 云函数

## Implementation Approach

1. **云函数聚合名称优化**: 修改 `ai-record` 云函数的聚合数据逻辑，通过提取 `formattedData` 中各食材名称并限制长度，动态生成“一整份(食物A、食物B等)”的标题。
2. **体重展示补充**: 在 `index.wxml` 对应卡片直接引入 `{{targetWeight}}` 变量拼接文本。
3. **Promise 竞态重构**: 将 `fetchTodayRecords` 中分离的 `DietRecord` 和 `SportRecord` 数据库查询通过 `Promise.all` 组合，在两者皆 resolve 后再统一计算总摄入、运动消耗和进度条百分比，从而彻底修复首次加载由于返回先后导致的圆环颜色失效问题。
4. **ActionSheet 与编辑弹窗**: 将原 `bindlongpress` 事件改为 `bindtap`，唤起 `wx.showActionSheet`。增加 `showEditRecordModal` 状态和对应的 WXML 弹窗组件，利用云开发 SDK `doc(id).update()` 方法对记录名与卡路里进行直接修改。

## Directory Structure

```
project-root/
├── cloudfunctions/
│   └── ai-record/
│       └── index.js             # [MODIFY] 优化数组聚合逻辑，动态拼接聚合菜品名称
└── miniprogram/
    └── pages/
        └── index/
            ├── index.wxml       # [MODIFY] 追加目标体重展示；修改流水项点击事件；新增编辑弹窗组件
            └── index.js         # [MODIFY] 使用 Promise.all 重构 fetchTodayRecords；增加 ActionSheet 及编辑记录逻辑
```