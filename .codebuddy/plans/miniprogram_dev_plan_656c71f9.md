---
name: miniprogram_dev_plan
overview: 基于 HTML 原型完成极简减脂伴侣小程序的前端页面开发，以及云开发数据库与云函数的搭建。
todos:
  - id: translate-frontend
    content: 参考[skill:miniprogram-development]将HTML原型拆分开发为小程序原生页面与组件
    status: completed
  - id: setup-database
    content: 创建云数据库集合并编写数据流转基础云函数
    status: completed
    dependencies:
      - translate-frontend
  - id: develop-ai-function
    content: 使用[skill:ai-model-nodejs]开发AI热量识别核心云函数并与前端联调
    status: completed
    dependencies:
      - setup-database
  - id: write-test-cases
    content: 基于[skill:spec-workflow]编写详细系统测试用例并执行完整功能测试
    status: completed
    dependencies:
      - develop-ai-function
---

## 产品概述

当前“AI 极简减脂伴侣”已完成前期产品PRD设计与静态UI原型开发，并初步初始化了微信小程序云开发环境。为了达到最终可上线的标准，目前处于“**待完成核心业务代码开发**”阶段。测试环节必须在所有核心功能代码开发完成后才能进行。

## 目前未完成的开发环节

1. **前端工程化移植**：现有的静态 UI (`output/index.html`) 是单文件 HTML，需要拆分翻译为微信小程序的原生规范结构（WXML, WXSS, JS），并实现自定义底部 Tabbar 和动态路由切换。
2. **云开发后端与数据库搭建**：需要设计并创建云数据库集合（用户信息、饮食记录、运动记录），并编写处理数据读取与保存的基础云函数。
3. **核心 AI 接口对接**：为了保护 AI 秘钥，需要在后端云函数中接入大模型（如豆包、Kimi 或 Hunyuan），处理前端传来的语音、文本或图片，实现热量自动识别并返回结构化数据。
4. **前后端联调与状态管理**：将前端的虚拟数据替换为从云端获取的真实数据，打通完整的业务闭环。

## 测试环节规划

在上述开发环节全部竣工后，将正式进入测试环节。测试计划将覆盖以下维度：

- 核心功能测试（AI记录准确度、图文识别并发、CRUD操作等）
- 异常边界测试（网络断开、服务端超时、非常规输入等）
- UI交互与兼容性测试
届时将输出标准的测试用例文档，并逐一执行。

## 技术选型

- **前端开发框架**：微信小程序原生开发 (WXML, WXSS, JavaScript)。由于需保持极简和高性能，避免引入过重的前端框架。
- **后端服务层**：微信云开发 (CloudBase / Node.js)。无需单独购买服务器，直接在微信开发者工具中使用。
- **数据持久化**：云开发数据库 (NoSQL)，方便敏捷开发和 JSON 数据的灵活存取。
- **AI 能力**：基于 `@cloudbase/node-sdk` 或其他第三方大模型 API，部署在云函数侧。

## 架构设计

### 系统架构

- **表现层 (前端)**：4个主业务页面（首页、数据、运动、我的）+ 1个自定义全局 Tabbar 组件 + 1个 AI 弹窗组件。
- **业务逻辑层 (云函数)**：
- `user-service`：处理用户配置、目标体重与基础信息的读写。
- `ai-service`：接收图片/语音/文本，组装 Prompt 请求大模型，解析出对应的卡路里与营养素，写入数据库。
- `record-service`：查询与统计每日/每周的饮食和运动数据。
- **数据层 (云数据库)**：
- `users` 集合：存储用户 OpenID、目标体重、当前体重、习惯打卡配置。
- `diet_records` 集合：存储每次 AI 识别生成的餐饮流水记录。
- `sport_records` 集合：存储每日运动消耗及步数记录。

### 核心目录结构规划

```text
project-root/
├── miniprogram/
│   ├── custom-tab-bar/      # [NEW] 自定义底部导航栏组件
│   ├── components/
│   │   └── ai-modal/        # [NEW] AI 拍照语音输入弹窗组件
│   ├── pages/               # [NEW] 原型拆分出的四大主页面
│   │   ├── home/
│   │   ├── stats/
│   │   ├── sport/
│   │   └── mine/
│   └── app.js               # [MODIFY] 全局状态与云环境初始化
└── cloudfunctions/
    ├── ai_calorie_calc/     # [NEW] 核心云函数：调用大模型识别食物/运动热量
    └── db_operations/       # [NEW] 基础云函数：处理所有数据库增删改查逻辑
```

## 实施策略与性能优化

1. **样式转换**：利用 TailwindCSS 转换思路，将原型的类名转换为全局或局部 WXSS，保持界面的高还原度。
2. **云函数冷启动优化**：整合数据请求逻辑，避免细碎的多次网络请求。对于高频的数据展示（如今日剩余热量），可考虑前端本地初步缓存（StorageSync）。
3. **安全机制**：微信小程序的敏感信息及大模型 API Key 绝对不可硬编码在前端，必须借助云函数进行转接，并在云数据库中严格配置安全规则。

## Agent Extensions

### Skill

- **miniprogram-development**
- Purpose: 指导微信小程序前端代码规范、目录结构及原生组件开发。
- Expected outcome: 产出符合官方标准规范、高性能的小程序前端代码。
- **ai-model-nodejs**
- Purpose: 在云开发 Node.js 云函数中接入和部署大模型 AI 能力。
- Expected outcome: 成功部署能够进行多模态输入（图片/文本）并输出卡路里数据的后端接口。
- **spec-workflow**
- Purpose: 制定严谨的软件测试流程，撰写专业的测试用例文档。
- Expected outcome: 产出覆盖核心功能、异常处理及UI兼容的测试用例报告。