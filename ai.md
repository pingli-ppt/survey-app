

---

# 项目报告

---

## 一、项目目标

本项目实现了一个基于 MongoDB 的在线问卷系统。系统整体参考常见问卷工具的基本功能，但在实现上做了简化，重点放在数据结构设计和核心逻辑上。

系统支持用户注册登录、创建问卷、设计题目、填写问卷以及查看统计结果。相比简单的表单系统，本项目额外实现了题目跳转逻辑和较完整的数据校验机制。

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

保存用户填写的答案，同时记录设备信息（IP、UA）

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
  username: String,
  password: String,
  email: String,
  survey_ids: [ObjectId],
  createdAt: Date
}
```

特点：

* 使用数组保存用户创建的问卷引用（冗余）（id）呢
* 密码使用 bcrypt 加密存储

---

### （2）Survey 集合

```js
{
  surveyId: String,
  title: String,
  description: String,
  allowAnonymous: Boolean,
  allowMultipleSubmit: Boolean,
  status: String,
  deadline: Date,
  creatorId: ObjectId,
  questions: [...]
}
```

**关键点：questions 是嵌套结构**（id呢，create，public）

---

### Question 结构（嵌套在 Survey 中）

```js
{
  questionId: String,
  type: "single_choice | multi_choice | text | number",
  required: Boolean,
  order: Number,
  config: {...},
  logic: [...]
}
```

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
  conditions: [
    {
      type: "option_selected | option_any | value_range",
      optionValue,
      operator,
      min,
      max
    }
  ],
  targetQuestionId: String,
  priority: Number
}
```

支持三种跳转方式：

* 单选匹配
* 多选包含
* 数值区间判断

---

### （3）Response 集合

```js
{
  surveyId: ObjectId,
  respondentName: String,
  isAnonymous: Boolean,
  answers: [
    { questionId, value }
  ],
  ipAddress: String,
  userAgent: String,
  createdAt: Date
}
```

特点：

* answers 使用数组存储，结构简单（id,答卷编号，填写者id,ip，useragent）
* value 使用 Mixed，兼容不同题型

---

## 四、为什么这样设计

### 1. 为什么不用关系数据库？

MySQL问题很明显：

* 题目类型不统一（字段差异大）
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

| 接口                    | 功能   |
| --------------------- | ---- |
| /api/register         | 注册   |
| /api/login            | 登录   |
| /api/create-survey    | 创建问卷 |
| /api/add-question     | 添加题目 |
| /api/add-logic        | 添加跳转 |
| /api/submit-response  | 提交答卷 |
| /api/survey-stats/:id | 查看统计 |

---

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

### 问题1：文本问题0当作未设置，没有校验最大值必须大于最小值

解决：

---

### 问题2：跳转逻辑调试困难，出错时信息不清晰，无法查看已有跳转规则

解决：


---

## 十一、总结

整个项目实现下来，核心收获主要在两点：

* 对 MongoDB 文档模型的理解更清晰
* 学会用“数据结构”来驱动逻辑，而不是写死代码

虽然系统功能不算复杂，但结构已经具备扩展能力，比如后续可以继续增加：

* 分页统计
* 图表展示
* 更复杂的跳转规则

---


