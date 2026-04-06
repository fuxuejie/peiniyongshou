---
name: ai-compression
overview: 动态梯级压缩图片以兼顾AI识别准确率和云函数1MB体积限制
todos:
  - id: refactor-compress-logic
    content: 使用 Promise 封装 ai-modal.js 中的单次图片压缩和 Base64 读取功能
    status: completed
  - id: implement-cascading-strategy
    content: 在 sendText 中实现三档动态梯级降级循环机制并处理 750000 阈值
    status: completed
    dependencies:
      - refactor-compress-logic
  - id: add-fallback-handling
    content: 补充所有层级的 try-catch 异常处理与状态恢复兜底逻辑
    status: completed
    dependencies:
      - implement-cascading-strategy
---

## 产品概述

优化微信小程序中 AI 记录弹窗的图片处理机制，彻底解决向云函数发送图片 Base64 时频繁触发的 1MB Payload 体积超限报错，同时保障大模型的图像识别精准度。

## 核心功能

- 引入前端动态梯级压缩机制，废除固定参数的“一刀切”式压缩。
- 优先采用“一档”（宽度 800，质量 60）以提供最高清晰度。
- 若压缩后 Base64 长度达到 750,000 字符警戒线，自动降级至“二档”（宽度 600，质量 30）或“三档”（宽度 400，质量 15）。
- 如果三档极限压缩后仍不满足条件，则安全拦截请求，友好提示用户裁剪。

## 技术栈

- 微信小程序原生 API：`wx.compressImage`, `wx.getFileSystemManager`
- 异步控制：`Promise` + `async/await` 

## 实现方案

### 核心策略

在 `ai-modal.js` 的 `sendText` 方法中引入梯级压缩算法。将原本单次调用 `wx.compressImage` 的回调形式，重构为基于 `async/await` 和 Promise 封装的循环检测机制。

1. **定义档位配置**：声明 `const tiers = [{ width: 800, quality: 60 }, { width: 600, quality: 30 }, { width: 400, quality: 15 }];`
2. **循环压缩与校验**：依次读取档位参数进行图片压缩，使用 FileSystemManager 读取为 base64 字符串。
3. **阈值判断**：若 `base64Str.length < 750000`，立即中断循环，调用 `doRecognizeWithBase64`。若超标则进入下一档。
4. **失败兜底**：若循环结束仍未拿到合格的 base64 字符串，弹出 `wx.showToast` 提示过大，结束流程。
5. **异常恢复**：确保在整个流程通过 `try...catch` 块包裹，发生任何 API 层面读取或压缩异常时，均可正确执行 `wx.hideLoading()` 和 `this.setData({ isLoading: false })` 恢复组件状态。

### 目录结构

```text
/Users/fuxuejie/CodeBuddy/小程序/
└── miniprogram/
    └── components/
        └── ai-modal/
            └── ai-modal.js  # [MODIFY] 重构 sendText 内部逻辑，引入异步梯级压缩算法及超限降级机制
```