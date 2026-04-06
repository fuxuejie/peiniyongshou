---
name: generate-ui-prototype
overview: 根据PRD文档，生成单文件HTML格式的产品UI原型设计稿，输出到 output 目录，采用 TDesign 设计规范与 Tailwind CSS。
design:
  architecture:
    framework: html
    component: tdesign
  styleKeywords:
    - 极简
    - 现代
    - 移动优先
    - 卡片式布局
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 24px
      weight: 600
    subheading:
      size: 16px
      weight: 500
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#0052D9"
      - "#366EF4"
    background:
      - "#F3F4F6"
      - "#FFFFFF"
    text:
      - "#111827"
      - "#6B7280"
    functional:
      - "#E34D59"
      - "#2BA471"
todos:
  - id: create-output-dir
    content: 创建 output 目录用于存放生成的 UI 设计文件
    status: completed
  - id: generate-ui-html
    content: 使用 Tailwind CSS 在 output/index.html 中实现移动端小程序界面的单页面设计
    status: completed
    dependencies:
      - create-output-dir
---

## 产品概述

基于前期的《AI极简减脂伴侣小程序》PRD，设计并生成一份单文件HTML的UI设计稿。该页面需直观呈现小程序的核心交互和视觉风格。

## 核心功能展示

- **极简输入交互**：首页醒目的拍照/语音识别入口大按钮。
- **数据可视化看板**：以“今日剩余热量”为核心的环形进度展示，以及当天的热量差数据统计。
- **健康打卡模块**：体重记录、习惯打卡（如饮水等）的自定义卡片化展示。
- **底部导航**：包含“首页”、“数据”、“我的”等主要模块入口。

## 技术栈

- 前端结构：纯 HTML5
- 样式方案：Tailwind CSS (通过 CDN 引入)
- UI 规范：参考 TDesign 移动端视觉规范

## 目录结构

```
/Users/fuxuejie/CodeBuddy/小程序/
└── output/
    └── index.html  # [NEW] 单文件UI设计稿，包含移动端页面结构、内部引入的 Tailwind CSS 样式以及极简交互效果模拟。
```

## 设计理念

采用移动端优先布局，整体风格保持现代与极简。使用 TDesign 标志性的科技蓝作为主色调，界面以浅灰色背景搭配白色卡片，强化内容的层级感与可读性。首页中心位置聚焦于“今日剩余可摄入热量”，底部悬浮宽大的主操作按钮（拍照/语音记录），最大限度降低用户的认知负荷与操作门槛。