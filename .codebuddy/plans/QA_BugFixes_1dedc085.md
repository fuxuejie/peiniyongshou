---
name: QA_BugFixes
overview: 修复 QA 审查发现的 3 个核心 Bug：统一首页与我的页面的“目标体重”及“坚持天数”数据源，补充首页缺口重算逻辑，并清理 app.js 中已废弃的静默登录接口。
todos:
  - id: clean-app-js
    content: 清理 app.js 中废弃的 getUserInfo API 代码
    status: completed
  - id: fix-weight-sync
    content: 修复首页体重设置数据一致性，同步计算热量差
    status: completed
  - id: sync-join-days
    content: 将云端“已坚持天数”真实计算逻辑同步至首页
    status: completed
---

## 产品概述

作为专业测试人员，对小程序全链路代码进行走查与走测，发现并修复潜在的隐患和未解决的遗留问题。

## 核心发现与功能需求

经代码走查，系统核心闭环已打通，但仍存在以下三个数据一致性与冗余代码问题：

1. **目标体重数据未同步 (数据一致性缺陷)**：在首页（`index.js`）修改体重时，仅更新了独立的 `targetWeight` 变量，未同步更新存储中全局的 `userInfo.targetWeight`，导致「我的」页面读取不到首页更新的数据。同时，首页在更新体重后，未触发「推荐每日热量差（recommendDeficit）」的重新计算。
2. **首页“坚持天数”为假数据 (逻辑缺陷)**：首页展示的“今天是你坚持记录的第 X 天”依然使用了未接管的旧逻辑（读取本地写死的假数据或固定值 1），应与「我的」页面保持一致，从云端拉取真实第一条记录来动态计算 `joinDays`。
3. **过期 API 残留 (代码冗余)**：`app.js` 内部残留了微信官方早已废弃的 `wx.getUserInfo` 相关授权代码，在当前的个人信息（头像昵称填写）模式下已完全无用，存在潜在的合规审查报错风险。

## 技术方案

1. **废弃 API 清理 (`app.js`)**

- 彻底移除 `app.js` 中 `wx.getSetting` 及内嵌的 `wx.getUserInfo` 冗余代码，仅保留干净的 `wx.cloud.init` 逻辑。

2. **状态共享与一致性修复 (`index.js`)**

- 改造 `confirmWeight` 函数：在保存当前体重与目标体重时，一并读取本地 `userInfo` 缓存，更新其 `targetWeight` 并回写缓存。
- 同步执行热量缺口计算：提取目标天数 `targetDays`，利用公式 `Math.round((weightDiff * 7700) / targetDays)` 实时计算最新推荐缺口，并更新至页面与本地缓存 `recommendDeficit` 中。

3. **首页云端“坚持天数”同步 (`index.js` & `index.wxml`)**

- 将 `mine.js` 中的 `fetchUserStats` 异步获取云端最早期记录以计算真实 `joinDays` 的逻辑，复用到 `index.js`。
- 在 `index.js` 的 `onShow` 阶段触发拉取，确保用户每次回到首页看到的都是真实累计天数。
- 修改 `index.wxml` 模板，将原有的 `{{consecutiveDays || 1}}` 替换为响应式的云端天数绑定。

## 目录与文件变更

- `/miniprogram/app.js`  # [MODIFY] 清理无用的 wx.getUserInfo
- `/miniprogram/pages/index/index.js` # [MODIFY] 修复体重更新及数据打通，引入坚持天数计算
- `/miniprogram/pages/index/index.wxml` # [MODIFY] 更新视图绑定变量名