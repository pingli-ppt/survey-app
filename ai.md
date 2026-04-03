

---

# 项目报告

---

## 一、项目目标

本项目实现了一个基于 MongoDB 的在线问卷系统。系统支持用户注册登录、创建问卷、设计题目、填写问卷以及查看统计结果。相比简单的表单系统，本项目额外实现了题目跳转逻辑和较完整的数据校验机制。

在开发过程中，主要目标不是做复杂界面，而是把数据流和逻辑跑通，并保证结构具有一定扩展性。

---

## 二、系统整体设计

系统采用典型的前后端分离结构：

* 前端：原生 HTML + JavaScript，实现交互和页面渲染
* 后端：Node.js + Express 提供 API
* 数据库：MongoDB（通过 Mongoose 管理）

整体流程：

> 用户登录 → 创建问卷 → 添加题目 → 发布 → 他人填写 → 系统统计结果

---

### 模块划分

系统可以拆成几个比较清晰的部分：

#### 1. 用户模块

负责注册、登录以及身份校验（JWT）

#### 2. 问卷模块

负责问卷创建、发布、关闭、查询等操作

#### 3. 题目模块

题目直接嵌套在问卷中，支持不同类型及配置

#### 4. 答卷模块

保存用户填写的答案

#### 5. 统计模块

根据答卷数据动态计算结果

---

## 三、MongoDB 数据库设计

---

### 1. 集合划分

系统最终使用了三个主要集合：

---

### （1）User 集合

```js
{
"_id": ObjectId("用户唯一ID"),
"username": "zhangsan", // 用户名
"password": "$2b$10$...", // 加密后的密码
"email": "zhangsan@example.com", // 邮箱（可选）
"createdAt": ISODate("2024-01-01T00:00:00Z")//创建时间
"survey_ids": [ObjectId] // 冗余：用户的问卷列表
}

```

特点：

* 使用数组保存用户创建的问卷引用，
* survey_ids 冗余存储，避免每次查询用户问卷时都关联 surveys 集合

---

### （2）Survey 集合

```js
{
"_id": ObjectId("问卷唯一ID"),
"surveyId": "SURV_20240001", // 业务ID，用于URL：/survey/SURV_20240001
"creatorId": ObjectId("创建者ID"), // 关联 users._id
"title": "问卷标题", 
"description": "说明"
"allow_multiple_submit": true，
"status": "draft", // draft, published, closed
"allowAnonymous": false, // 是否允许匿名填写
"deadline": ISODate("2024-12-31T23:59:59Z"), // 截止时间
"createdAt": ISODate("2024-01-01T00:00:00Z"),
"publishedAt": ISODate("..."), // 发布时间
}

```
特点：
* surveyId 作为业务可读 ID，便于 URL 使用
* creatorId 关联用户集合
* 冗余存储 allowAnonymous / allowMultipleSubmit，方便快速判断问卷属性
---

### Question 结构（嵌套在 Survey 中）

```js
{
"questionId": "q1", // 题目编号，如 q1, q2，用于跳转
"surveyId": ObjectId("所属问卷ID"),
"order": 1,                       // 显示顺序
"type": "single_choice", // single_choice, multi_choice, text, number
"required": true, // 是否必填
"createdAt": ISODate("2024-01-01T00:00:00Z")
}

```
特点：

* 题目共享同一集合，通过 type 区分不同题型
* questionId 可读，支持跳转规则

---

### config（题目配置）

不同题型共用一个字段：

```js
{
  options: [{value, label}],
  minSelect,
  maxSelect,
  minLength,
  maxLength,
  minValue,
  maxValue,
  integerOnly
}
```

优点：
避免为每种题型单独设计结构，统一处理逻辑更简单。

---

### logic（跳转逻辑）

```js
{
"_id": ObjectId("规则唯一ID"),
"surveyId": ObjectId("所属问卷ID"),
"sourceQuestionId": "q1", // 源题目ID
"conditions": [ // 支持多个条件组合（AND）
{
"type": "option_selected", // option_selected, value_range, option_any
"optionValue": "male", // 对于选项选择
// 或用于数值范围
"operator": ">=", // >=, <=, >, <, ==
"value": 18
}
],
"operator": "AND", // 多个条件的关系：AND, OR
"targetQuestionId": "q5", // 跳转目标题目ID
"priority": 1, // 优先级，数字越小越优先
"createdAt": ISODate("2024-01-01T00:00:00Z")
}

```

* 支持单选、多选、数值题跳转
* 优先级字段解决规则冲突
---

### （3）Response 集合

```js
{
"_id": ObjectId("答卷唯一ID"),
"surveyId": ObjectId("问卷ID"),
"responseId": "RESP_001", // 答卷编号，便于追踪
"respondentId": ObjectId("填写者ID"), // 如果登录填写，关联 users._id
"respondentName": "zhangsan", // 冗余字段，便于统计查看
"isAnonymous": false, // 是否匿名填写
"answers": [ // 答案列表，按题目顺序存储
{
"questionId": "q1",
"type": "single_choice",
"value": "male" // 单选题：选项值
},
{
"questionId": "q2",
"type": "multi_choice",
"value": ["apple", "banana"] // 多选题：选项值数组
},
{
"questionId": "q3",
"type": "text",
"value": "这是一个文本答案"
},
{
"questionId": "q4",
"type": "number",
"value": 25
}
],
"completedAt": ISODate("2024-01-01T12:00:00Z"),
"ip": "192.168.1.1", // 用于防刷
"userAgent": "Mozilla/5.0..." 

}

```

特点：

* answers 使用数组存储，结构简单（id,答卷编号，填写者id,ip，useragent）
* value 使用 Mixed，兼容不同题型
* 冗余存储 respondentName，统计时无需关联用户集合
* surveyId 冗余，便于分片、快速查询

---

## 四、为什么这样设计

### 1. 为什么不用关系数据库？

MySQL问题很明显：

* 题目类型不统一，字段差异大
* 跳转逻辑是嵌套结构
* 问卷本身是层级数据（问卷 → 题目 → 逻辑）
* 若用 MySQL 需要拆成 5~6 张表，JOIN 多，改结构麻烦


---

### 2. 为什么适合 MongoDB？

MongoDB 的文档结构刚好适合这个场景：

* 问卷可以作为一个完整文档
* 题目直接嵌套
* 跳转逻辑也可以嵌套存储

这样带来的好处是：

* 查询问卷时不需要 join
* 结构更直观
* 改动成本低

---

### 3. 为什么 Response 单独拆出来？

没有把答卷放进 Survey，是因为：

* 答卷数量可能很多
* 会导致文档过大
* 并发写入会有问题

拆成独立集合后：

* 写入更安全
* 查询统计更灵活

---

## 五、核心逻辑设计

---

### 1. 校验逻辑

所有题目统一通过一个函数处理：

```js
validateAnswer(question, answer)
```

不同题型在 switch 中处理：

* 单选：是否合法选项
* 多选：数量限制
* 文本：长度限制
* 数字：范围 + 是否整数

优点：

* 所有校验集中在一处
* 易维护和扩展

---

### 2. 跳转逻辑

核心函数：

```js
getNextQuestionId()
```

执行流程：

1. 找到当前题目
2. 遍历 logic（按 priority 排序）
3. 判断 conditions 是否满足
4. 返回目标题目 ID

设计思路：

* 跳转规则写在数据库
* 后端只负责解释规则

这样做的好处：

* 不需要改代码
* 可以随意配置跳转

---

## 六、API 设计


### 接口列表

| 方法 | 路径 | 功能 | 认证 | 请求参数（Body / Query） |
|------|------|------|------|--------------------------|
| POST | `/register` | 用户注册 | 否 | `username`, `password`, `email`(可选) |
| POST | `/login` | 用户登录 | 否 | `username`, `password` |
| GET | `/me` | 获取当前用户信息 | 是 | 无 |
| GET | `/my-surveys` | 获取我的问卷列表 | 是 | 无 |
| GET | `/my-survey/:surveyId` | 获取单个问卷详情（编辑用） | 是 | URL参数：`surveyId` |
| POST | `/create-survey` | 创建问卷 | 是 | `title`, `description`(可选), `allowAnonymous`(可选), `allowMultipleSubmit`(可选), `deadline`(可选) |
| PUT | `/update-survey` | 更新问卷信息 | 是 | `surveyId`, `title`(可选), `description`(可选), `status`(可选) |
| POST | `/publish-survey/:surveyId` | 发布问卷 | 是 | URL参数：`surveyId` |
| POST | `/close-survey/:surveyId` | 关闭问卷 | 是 | URL参数：`surveyId` |
| GET | `/survey/:surveyId` | 获取问卷（公开答题页） | 否 | URL参数：`surveyId` |
| POST | `/add-question` | 添加题目 | 是 | `surveyId`, `questionId`, `title`, `type`, `required`(可选), `config`(可选) |
| PUT | `/update-question` | 更新题目 | 是 | `surveyId`, `questionId`, `title`(可选), `required`(可选), `config`(可选) |
| DELETE | `/delete-question` | 删除题目 | 是 | Body：`surveyId`, `questionId` |
| POST | `/add-logic` | 添加跳转逻辑 | 是 | `surveyId`, `sourceQuestionId`, `conditions`, `targetQuestionId`, `priority`(可选) |
| DELETE | `/delete-logic` | 删除跳转逻辑 | 是 | Body：`surveyId`, `questionId`, `logicIndex` |
| POST | `/test-jump` | 测试跳转逻辑 | 否 | Body：`surveyId`, `currentQuestionId`, `answer` |
| POST | `/submit-response` | 提交答卷 | 否 | Body：`surveyId`, `answers`, `respondentName`(可选), `isAnonymous`(可选) |
| GET | `/survey-stats/:surveyId` | 获取问卷统计结果 | 是 | URL参数：`surveyId` |

### 关键接口详解


#### 1. 添加题目 `POST /api/add-question`
- **请求参数说明**：
  - `type` 可选值：`single_choice`, `multi_choice`, `text`, `number`
  - `config` 根据类型不同包含不同字段：
    - 单选/多选：`options`（数组，每项含 `value`, `label`）
    - 多选额外：`minSelect`, `maxSelect`
    - 文本：`minLength`, `maxLength`
    - 数字：`minValue`, `maxValue`, `integerOnly`


#### 2. 添加跳转逻辑 `POST /api/add-logic`
- **支持的 conditions 类型**：
  - `option_selected`：单选选中某个值
  - `option_any`：多选答案中包含某个值
  - `value_range`：数字在某个范围内（含边界）


#### 3. 获取统计 `GET /api/survey-stats/:surveyId`
- **响应结构**：
  - 包含总答卷数 `totalResponses`
  - 每道题的统计结果，根据题型不同：
    - 单选：各选项计数
    - 多选：各选项计数及总选择次数
    - 文本：所有答案列表
    - 数字：求和、平均值、最小值、最大值
## 七、测试样例与结果

基于自动化测试脚本 `test-api.js`，测试了以下场景：

### 1. 创建问卷测试

| 测试项 | 操作 | 预期 | 实际结果 | 状态 |
|--------|------|------|----------|------|
| 注册新用户 | POST `/api/register` | 返回 token | ✅ 成功 | 通过 |
| 创建问卷 | POST `/api/create-survey` | 返回 surveyId | ✅ 成功 | 通过 |

### 2. 添加题目测试

| 测试项 | 操作 | 预期 | 实际结果 | 状态 |
|--------|------|------|----------|------|
| 添加单选题 | 提供 options | 成功 | ✅ 成功 | 通过 |
| 添加多选题 | 提供 minSelect/maxSelect | 成功 | ✅ 成功 | 通过 |
| 添加文本题 | 提供 minLength/maxLength | 成功 | ✅ 成功 | 通过 |
| 添加数字题 | 提供 minValue/maxValue | 成功 | ✅ 成功 | 通过 |

### 3. 跳转逻辑测试

| 测试项 | 操作 | 预期 | 实际结果 | 状态 |
|--------|------|------|----------|------|
| 添加跳转规则 | 单选选 male → q4 | 成功添加 | ✅ 成功 | 通过 |
| 测试跳转 | 发送 `{answer: "male"}` | 返回 nextQuestionId = "q4" | ✅ 正确 | 通过 |
| 测试不跳转 | 发送 `{answer: "female"}` | 返回 null | ✅ 正确 | 通过 |

### 4. 校验功能测试

| 测试项 | 操作 | 预期 | 实际结果 | 状态 |
|--------|------|------|----------|------|
| 必填项校验 | 提交空答案 | 400 错误，提示必填 | ✅ 正确 | 通过 |
| 单选题无效选项 | 提交不存在的 option | 400 错误 | ✅ 正确 | 通过 |
| 多选题数量超限 | 选 3 个（maxSelect=2） | 400 错误 | ✅ 正确 | 通过 |
| 数字超出范围 | 提交 150（max=120） | 400 错误 | ✅ 正确 | 通过 |
| 文本长度不足 | 提交 "短"（minLength=5） | 400 错误 | ✅ 正确 | 通过 |

### 5. 提交问卷测试

| 测试项 | 操作 | 预期 | 实际结果 | 状态 |
|--------|------|------|----------|------|
| 正常提交 | 所有题目有效答案 | 成功，返回 responseId | ✅ 成功 | 通过 |
| 匿名提交 | isAnonymous=true | 成功，不记录姓名 | ✅ 成功 | 通过 |

### 6. 统计测试

| 测试项 | 操作 | 预期 | 实际结果 | 状态 |
|--------|------|------|----------|------|
| 获取统计 | GET `/api/survey-stats/:surveyId` | 返回统计数据 | ✅ 成功 | 通过 |
| 单选统计 | 验证男/女计数 | 正确 | ✅ 通过 |
| 数字统计 | 平均值、最值 | 正确 | ✅ 通过 |

---

## 八、AI 使用过程

在整个项目开发中，AI 作为辅助工具参与了多个环节。以下是关键交互记录及人工改进说明。
### 记录1：数据库 Schema 设计

**用户 Prompt**：
> 帮我设计问卷系统的 MongoDB 数据库结构，要支持题目和跳转逻辑。

**AI 输出（首次）**：
- 提出了 5 个独立集合：`users`、`surveys`、`questions`、`rules`、`responses`。
- 理由：题目和跳转规则数量可能很大，独立存储便于扩展，避免问卷文档过大。

**人工分析与决策**：
- 考虑到本项目是简化版问卷系统，题目数量通常不超过 20 题，跳转规则也有限。
- 嵌套方案的优势：
  - 一次查询即可获得问卷全部内容（标题、题目、跳转逻辑），无需多表关联。
  - 代码更简单，不需要维护题目和规则的单独 CRUD 接口。
  - 符合 MongoDB 文档模型的设计哲学。
- **最终决定**：采用嵌套方案，将 `questions` 数组直接内嵌在 `Survey` 文档中，每个 question 内部再包含 `logic` 数组。

---


### 记录2：用户注册登录（JWT + 密码加密）

**用户 Prompt**：
> 用 Node.js + Express 写一个注册登录接口，使用 JWT。

**AI 输出**：
- 提供了基础的 `/register` 和 `/login` 路由。
- 使用 JWT 生成 token，但密码直接明文存储到数据库。
- 缺少输入长度验证和错误处理。

**人工改进**：
- 引入 `bcryptjs`，使用 `bcrypt.hash()` 加密密码，盐值设为 10。
- 添加用户名至少 3 位、密码至少 6 位的校验。
- 检查用户名是否已存在，返回友好错误信息。
- 登录时使用 `bcrypt.compare()` 验证密码。
- 封装 `authMiddleware` 中间件，从请求头提取 token 并验证用户身份。

---

### 记录3：多选题校验逻辑

**用户 Prompt**：
> 多选题的答案如何校验？

**AI 输出**：
- 给出基本思路：检查答案是否为数组，以及数组中的每个选项是否在 options 列表中。

**人工改进**：
- 增加 `minSelect` 和 `maxSelect` 配置，实现数量限制。
- 当 `minSelect === maxSelect` 时，要求用户必须选择恰好该数量的选项。
- 校验时先判断数组长度是否符合范围，再逐项检查选项合法性。

---

### 记录4：统计功能实现

**用户 Prompt**：
> 问卷统计功能怎么写？比如计算每个选项被选了多少次。

**AI 输出**：
- 给出了简单的计数逻辑，遍历所有答卷，统计每个选项出现次数。
- 未区分题型，未处理数字题的平均值、最值。

**人工改进**：
- 针对单选题：统计每个选项的计数。
- 针对多选题：统计每个选项被选中的总次数，同时记录总选择次数（totalSelections）。
- 针对文本题：收集所有文本答案，存为数组。
- 针对数字题：计算总和、平均值、最小值、最大值。
- 最终返回结构化的 stats 对象，便于前端展示。

---

### 记录5：JWT 中间件封装

**用户 Prompt**：
> 写一个 JWT 验证的中间件。

**AI 输出**：
- 提供了简单的中间件函数，从 `req.headers.authorization` 提取 token 并验证。

**人工改进**：
- 添加 token 不存在时的明确错误提示：“未登录，请先登录”。
- 添加 token 过期或无效时的提示：“登录已过期，请重新登录”。
- 验证成功后，从数据库查询用户信息（不含密码）并挂载到 `req.user`。
- 若用户已被删除，返回“用户不存在”。

---

### 记录6：跳转逻辑调试与增强

**用户 Prompt**：
> 跳转逻辑怎么调试？为什么我的规则不生效？

**AI 输出**：
- 建议打印日志，逐条检查 conditions。
- 给出了简单的 if-else 示例。

**人工改进**：
- 实现了 `getNextQuestionId` 函数，并新增 `/api/test-jump` 接口，允许前端传入当前题目 ID 和答案，返回应该跳转到的目标题目 ID。
- 处理了答案格式标准化：单选 → 字符串，多选 → 数组，数字 → Number。
- 扩展了条件类型：
  - `option_selected`（单选匹配）
  - `option_any`（多选包含某值）
  - `option_all`（多选包含所有指定值）
  - `option_exact`（多选完全匹配指定值集合）
  - `value_range`（数值区间）
- 支持按 priority 排序规则，避免顺序错乱。


---


## 九、AI 使用总结

### 9.1 AI 的优势
- **快速生成样板代码**：如 Express 路由、Mongoose 模型基本结构。
- **辅助调试语法错误**：快速识别常见语法问题。
- **生成测试脚本**：节省手动编写测试的时间。

### 9.2 AI 的局限性
- **倾向于过度设计**：AI 默认假设题目和规则数量很大，推荐独立集合，但本项目实际规模很小，嵌套更合适。
- **缺乏业务深度理解**：无法自动判断哪种方案更适合当前项目的简化需求。
- **代码完整性不足**：生成的代码经常缺少错误处理、参数校验。
- **无法处理边界情况**：如循环跳转检测、数字题整数校验等，需要人工补充。

### 9.3 人工决策的关键点
- **选择嵌套而非独立集合**：因为题目数量少、跳转规则简单，嵌套可减少查询次数，简化代码。
- **统一 config 对象**：避免为每种题型单独设计字段，提高代码复用性。
- **跳转逻辑内嵌**：便于随题目一起保存和修改。
- **补充校验和错误处理**：确保系统健壮性。

---


## 十、遇到的问题与解决方案

### 问题1：文本题允许将 0 当作“未设置”；文本题和数字题没有校验 minLength > maxLength，导致用户可能配置出无法填写的题目

**解决方案**：  
1. **在添加/更新题目时增加范围合理性校验**（见`/api/add-question` 和 `/api/update-question`）：

3. **空值处理**：空值直接跳过类型校验，避免将数字 `0` 误判为“未设置”。数字 `0` 会被当作有效值进行范围校验。


### 问题2：AI 生成的代码导致密码明文存储
**原因**：AI 没有主动使用加密库，默认给出最简单的实现。  
**解决**：手动引入 bcrypt，并修改注册和登录逻辑。。

### 问题3：AI 生成的测试脚本缺少错误场景覆盖
**原因**：AI 测试倾向过于乐观。  
**解决**：在测试脚本中，手动补充各种错误场景（必填缺失、非法选项、超限等）。

---

---




