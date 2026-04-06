---
name: fix_index_issues
overview: 解决用户反馈的体验问题：优化 AI 汇总食物名称、完善体重卡片展示、修复进度环灰色 Bug及增加显式的饮食记录编辑和删除功能。
todos:
  - id: update-ai-record
    content: 修改 ai-record 云函数动态拼接一整份的食物名称
    status: completed
  - id: deploy-ai-record
    content: 使用 [mcp:manageFunctions] 部署 ai-record 云函数
    status: completed
    dependencies:
      - update-ai-record
  - id: fix-async-race
    content: 重构 index.js 首页数据加载逻辑，用 Promise.all 修复进度条竞态
    status: completed
  - id: update-ui-elements
    content: 修改 index.wxml 体重展示并新增饮食编辑记录弹窗
    status: completed
  - id: add-edit-logic
    content: 在 index.js 中实现饮食记录的 ActionSheet 与编辑更新逻辑
    status: completed
    dependencies:
      - update-ui-elements
---

## 用户需求分析

1. **AI 汇总名称优化**：当前 AI 识别多个食材时，汇总项固定显示为“一整份 (总计)”，难以回忆具体吃了什么。需要展示出具体的食物名称（如：一整份 (烤串、炒面等)）。
2. **体重展示增强**：首页“体重管理”习惯打卡组件中，目前只显示当前体重，需同时展示出设定的目标体重。
3. **环形进度条状态修复**：热量超标时，本该显示红色的进度环有时却显示灰色。这是由于获取“饮食记录”与“运动记录”是并行的异步请求，存在竞态条件导致计算时的基础数据为空。
4. **饮食记录操作显性化**：原有的长按删除隐藏较深。需改为点击后弹出“编辑/删除”菜单，并提供支持用户手动修改饮食名称与热量的编辑弹窗。

## 核心功能点

- 云函数：动态拼接食材名称生成汇总项标题。
- 逻辑层：使用 `Promise.all` 重构首页数据请求，确保热量结余与进度百分比计算完全正确。
- 视图层：更新体重卡片 UI，增加列表项的点击交互提示，新增编辑单条饮食记录的弹窗。

## 技术实现方案

### 1. 云端逻辑优化

- 修改 `cloudfunctions/ai-record/index.js`，在自动聚合逻辑中，提取 `formattedData` 中的 `name` 字段，截取前 3 个并以顿号连接拼接为 `一整份 (食物A、食物B等)`，替换原有的固定文本。

### 2. 异步请求改造 (竞态条件修复)

- 重构 `miniprogram/pages/index/index.js` 中的 `fetchTodayRecords()` 函数，将 `DietRecord` 和 `SportRecord` 的数据库查询使用 `Promise.all` 包装。
- 等待两项请求全部返回后，统一计算 `todayIntake` (今日摄入) 和 `sportBurned` (运动消耗)，然后再利用最新的这几个值精确计算 `progressPercent` 进度条百分比，杜绝渲染异常。

### 3. 组件 UI 与交互更新

- **体重管理组件**：在 `index.wxml` 的体重区块添加文本渲染：`{{currentWeight}} kg / 目标 {{targetWeight}} kg`。
- **记录列表操作**：
- 移除 `bindlongpress="onDeleteRecord"`，改为 `bindtap="onRecordOptions"`。
- 在 `index.js` 添加 `onRecordOptions`，调用 `wx.showActionSheet` 显示 `['编辑', '删除']` 选项。
- 保留原有删除逻辑，新增编辑逻辑：点击编辑后显示带有 `name` 和 `calorie` 输入框的自定义 Modal。
- **编辑弹窗实现**：
- 复用已有的 `.modal-mask` 和 `.modal-content` 样式类。
- `wx:if="{{showEditRecordModal}}"` 控制展示。
- 点击确定时请求云数据库 `db.collection('DietRecord').doc(id).update()` 更新记录。

## 核心受影响文件

```text
project-root/
├── cloudfunctions/
│   └── ai-record/
│       └── index.js      # [MODIFY] 动态拼接聚合食物名称
└── miniprogram/
    └── pages/
        └── index/
            ├── index.wxml  # [MODIFY] 添加体重目标展示、添加点击交互提示、新增编辑弹窗
            └── index.js    # [MODIFY] Promise.all 修复状态竞态，新增编辑与菜单逻辑
```