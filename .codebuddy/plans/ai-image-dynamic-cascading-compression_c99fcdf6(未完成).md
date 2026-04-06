---
name: ai-image-dynamic-cascading-compression
overview: 在 ai-modal 组件中实现图片的动态梯级压缩机制，优先保证高清晰度，在体积超限时逐级降级，彻底解决云函数 1MB 限制与 AI 识别准确率的冲突。
todos:
  - id: encapsulate-compress-promise
    content: 在 ai-modal.js 中封装基于 Promise 的图片压缩与 Base64 读取辅助方法
    status: pending
  - id: refactor-send-text
    content: 重构 sendText 方法以应用三档动态梯级降级压缩机制并对接识别接口
    status: pending
    dependencies:
      - encapsulate-compress-promise
---

## 需求概览

为微信小程序的 `ai-modal` 组件实现“动态梯级图片压缩机制”，以彻底解决调用大模型识别热量时由于图片过大导致的云函数 1MB 传输限制问题，同时最大限度地保留图片清晰度以提高大模型的识别准确率。

## 核心功能点

1. **多级降级压缩**：当用户上传图片后，系统将按顺序尝试三档压缩策略，直至满足 Base64 字符串长度安全线（`< 750,000`）：

- **一档（优先高清晰度）**：宽度 800px，压缩质量 60。
- **二档（适度降级）**：若一档结果超限，自动回退至宽度 600px，压缩质量 30。
- **三档（极限兜底）**：若二档依然超限，强行回退至宽度 400px，压缩质量 15。

2. **安全拦截**：若三档压缩后依然超出限制，或发生异常，则终止上传，提示用户重新裁剪或更换图片。
3. **流程平滑**：压缩过程采用异步链式调用（Promise 化），避免回调地狱，同时保留完整的 `Loading` UI 状态，成功后将合规的 Base64 字符串送入大模型处理方法 `doRecognizeWithBase64`。

## 技术选型与实现方案

- **平台环境**：微信原生小程序
- **核心 API**：`wx.compressImage` (压缩图片) 和 `wx.getFileSystemManager().readFileSync(..., 'base64')` (读取 Base64)

## 架构与逻辑设计

由于 `wx.compressImage` 采用传统的 `success/fail` 回调模式，直接实现三层嵌套会导致代码极度冗余且难以维护（回调地狱）。因此，核心实现策略为：

1. **Promise 封装**：在 `ai-modal.js` 中新增一个辅助工具方法（例如 `compressAndGetBase64`），接收 `width` 和 `quality` 参数，内部返回一个 Promise，只有当压缩成功且 Base64 长度 `< 750000` 时 resolve，否则 reject。
2. **异步链式回退（Cascading Fallback）**：在 `sendText` 方法中，使用 `async/await` 或 Promise `.catch()` 链条，依次尝试三档参数。只要有一档 resolve 就中断后续压缩并直接请求云端；如果全都 reject，则统一在最后的 catch 块中进行错误提示和重置 UI 状态。

## 目录结构变更

```
/Users/fuxuejie/CodeBuddy/小程序/
└── miniprogram/
    └── components/
        └── ai-modal/
            └── ai-modal.js  # [MODIFY] 重构图片压缩逻辑，封装 Promise 方法并实现三档梯级降级策略
```