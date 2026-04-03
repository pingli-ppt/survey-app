

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

如果用关系数据库：

* 至少需要拆成 5~6 张表
* JOIN 很多
* 改结构很麻烦


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
* 易维护

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

## 七、测试用例

### 1. 创建问卷

* 输入：问卷标题空置
* 结果：提示请填写此字段

* 输入：配置不允许重复提交
* 结果：没防住

* 输入：配置不允许匿名提交
* 结果：没防住

* 输入：只创建不加题目
* 结果：没有草稿模式，想要填写就报错

* 输入：相同问卷名
* 结果：没防住
---

### 2. 添加题目

* 输入：文本填空最小最大字符都设置为0
* 结果：卡bug随便填几个字符
* 输入：文本填空最小32最大0
* 结果：只限制最小32
* 输入：跳转逻辑
* 结果：报错难以查看，无展示已有跳转逻辑
* 输入：选项不写|
* 结果：不能成功添加题目也不报错

---

### 3. 校验

* 输入：只选1个（要求最少2个）
* 结果：返回错误提示-请先完成所有必填项并修正错误
* 输入：150或者1.4（限制0~120整数）
* 结果：返回错误提示-请先完成所有必填项并修正错误
* 输入：150个字符（限制0~120）
* 结果：返回错误提示-请先完成所有必填项并修正错误
---

### 4. 跳转逻辑

* 输入：Q1=A → Q5
* 结果：成功跳转
* 输入：单选想选中某个选项跳转
* 结果：缺失功能
* 没有防循环跳转


---

### 5. 提交问卷

* 输入：完整答案
* 结果：保存成功，发布问卷者可以查看
* 输入：在截止时间后访问
* 结果：不能提交，提示问卷已截止

---

### 6. 统计功能

* 多个用户提交后：

  * 单选统计正确
  * 数字平均值正确
  * 文本都可以查看
* 已关闭不统计
* “fail to fetch + 服务挂掉”

---

### 7. 登录功能

* 输入：不存在的用户名或不匹配的密码
* 结果：提示用户名或密码错误

---

## 八、AI 使用过程

### 记录1

Prompt：

> 帮我设计问卷系统 MongoDB schema

结果：

* 得到了基本结构

问题：

* 没有跳转逻辑

修改：

* 自己增加 logic 字段

---

### 记录2

Prompt：

> 写一个 Node.js 注册登录接口

问题：

* 密码没有加密

修改：

* 使用 bcrypt 手动改写

---

### 记录3

Prompt：

> 多选题如何校验

结果：

* 给了简单逻辑

修改：

* 增加 minSelect / maxSelect

---

### 记录4

Prompt：

> 问卷统计怎么写

修改：

* 自己补充平均值 / 最值

---

### 记录5

Prompt：

> JWT 登录示例

修改：

* 加入 authMiddleware

---

## 九、AI 使用总结

在开发过程中，AI 主要起到了“辅助工具”的作用。

比较有用的地方：

* 快速生成基础代码
* 提供思路（比如 schema 设计）

但也有明显问题：

* 初始设计不完整
* 部分代码不能直接运行


最终效果基本是：

AI提供骨架，核心逻辑自己完成

---

## 十、遇到的问题

### 问题1：文本题允许将 0 当作“未设置”；文本题和数字题没有校验 minLength > maxLength，导致用户可能配置出无法填写的题目

**解决方案**：  
1. **在添加/更新题目时增加范围合理性校验**（见`/api/add-question` 和 `/api/update-question`）：

3. **空值处理**：空值直接跳过类型校验，避免将数字 `0` 误判为“未设置”。数字 `0` 会被当作有效值进行范围校验。

---




