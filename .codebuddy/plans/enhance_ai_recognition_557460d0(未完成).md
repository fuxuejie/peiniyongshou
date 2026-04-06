---
name: enhance_ai_recognition
overview: 全面升级 AI 识别能力：优化提示词、重构支持图文同传、并提供最多 3 个候选结果供用户单选。
todos:
  - id: update-cloud-function
    content: 修改 ai-record 云函数优化提示词并返回JSON数组
    status: completed
  - id: refactor-modal-ui
    content: 更新 ai-modal 视图与样式以支持图片预览和多候选Tab
    status: completed
    dependencies:
      - update-cloud-function
  - id: refactor-modal-logic
    content: 重构 ai-modal 逻辑层支持图文同传及多结果状态切换
    status: completed
    dependencies:
      - refactor-modal-ui
  - id: deploy-function
    content: 使用 [mcp:cloudbase] 工具部署 ai-record 云函数
    status: completed
    dependencies:
      - refactor-modal-logic
---

## 产品概述

综合优化小程序 AI 食物识别流程，通过组合“升级提示词”、“图文同传”以及“多候选结果”三种方案，彻底解决图片识别不准、容错率低的问题，提升用户体验和数据准确性。

## 核心功能

1. **专业人设提示词（方案一）**：赋予 AI “10年经验临床营养师”的系统设定，要求其仔细分析图片中的食材、烹饪方式，并进行合理的克重与热量估算。
2. **图文同传（方案二）**：支持用户先选取图片进行本地预览，接着在输入框补充额外的文字细节（例如：“这是半份猪脚饭，没吃肥肉”），点击“识别”时将图片与文字一同发给大模型。
3. **多结果候选列表（方案三）**：AI 将每次返回 1-3 个最可能的候选食物结果，界面增加候选项标签（Tab）供用户单选切换，用户选中最符合真实情况的候选项后，再进行记录提交。

## 架构与技术方案

### 1. 云端逻辑重构 (Cloud Function)

- **Prompt Engineering**: 针对 `ai-record` 云函数，修改组装发给大模型的 `messages`。新增营养师人设，并明确要求大模型必须以 JSON 数组格式（`[{ name, weight, calorie, carbs, protein, fat }]`）返回 1~3 个候选结果。
- **解析逻辑适配**: 云函数通过正则或结构化 JSON 解析出该数组，并原样返回给前端。

### 2. 小程序前端重构 (Mini Program Logic & UI)

- **状态管理 (`ai-modal.js`)**: 
- 新增 `tempImagePath`：记录用户选中的本地图片临时路径，取代此前“选图即请求上传”的逻辑。
- 新增 `aiResults` (Array)：用于接收云端返回的候选数组。
- 新增 `selectedCandidateIndex`：记录当前选中的食物候选项索引，对应的详情即为要展示的卡路里及三大营养素。
- **交互与网络请求**:
- **图文收集**：点击“拍照”只负责选择图片并更新 `tempImagePath`。
- **强制压缩与合并发送 (`sendText`)**：点击“识别”时，绝对不使用云存储上传（容易引发网络或权限报错）。而是将图片通过 `wx.compressImage`（强压至宽 800px，quality 20）后转换为极小的 **Base64 字符串**，将 Base64 与 `inputText`（如果有）合并发送至云函数；若无图片则仅发送文本。此举可彻底避免云函数 1MB 载荷超限（data exceed max size）的问题。
- **多结果切换**：点击不同候选标签更新 `selectedCandidateIndex`，动态计算呈现的热量视图。

### 目录结构

```text
cloudfunctions/ai-record/
└── index.js            # [MODIFY] 升级提示词，支持解析和返回多个候选结果的 JSON 数组
miniprogram/components/ai-modal/
├── ai-modal.js         # [MODIFY] 重构交互链路：支持本地图片暂存、图文合并上传、候选食物切换
├── ai-modal.wxml       # [MODIFY] 新增图片本地缩略图预览区及删除按钮；新增多个候选食物的 Tab 切换布局
└── ai-modal.wxss       # [MODIFY] 新增缩略图与候选食物 Tab 的样式
```

## Agent Extensions

### MCP

- **cloudbase**
- Purpose: 重新部署更新后的云函数代码到腾讯云开发环境。
- Expected outcome: `ai-record` 云函数成功更新并生效，支持新的图文同传与多候选数组响应。