const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");

const User = require("./models/User");
const Survey = require("./models/Survey");
const Response = require("./models/Response");

const app = express();
const JWT_SECRET = "survey-system-secret-key-2024";

// 连接数据库
mongoose.connect("mongodb://127.0.0.1:27017/survey_db");

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB 连接成功");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB 连接失败:", err);
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ========== 认证中间件 ==========
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "未登录，请先登录" });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    
    if (!user) {
      return res.status(401).json({ error: "用户不存在" });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "登录已过期，请重新登录" });
  }
};

// ========== 校验函数 ==========
function validateAnswer(question, answer) {
  const config = question.config || {};
  
  // 空值处理
  if (answer === undefined || answer === null || answer === "") {
    if (question.required) {
      return "此题为必填项";
    }
    return null;
  }
  
  switch (question.type) {
    case "single_choice":
      if (!config.options?.find(o => o.value === answer)) {
        return "选项无效";
      }
      break;
      
    case "multi_choice":
      if (!Array.isArray(answer)) return "答案格式错误";
      if (config.minSelect && answer.length < config.minSelect) {
        return `至少选择 ${config.minSelect} 个选项`;
      }
      if (config.maxSelect && answer.length > config.maxSelect) {
        return `最多选择 ${config.maxSelect} 个选项`;
      }
      if (config.minSelect && config.maxSelect && config.minSelect === config.maxSelect) {
        if (answer.length !== config.minSelect) {
          return `请选择 ${config.minSelect} 个选项`;
        }
      }
      break;
      
    case "text":
      const len = answer.toString().length;
      if (config.minLength && len < config.minLength) {
        return `最少需要 ${config.minLength} 个字符`;
      }
      if (config.maxLength && len > config.maxLength) {
        return `最多允许 ${config.maxLength} 个字符`;
      }
      break;
      
    case "number":
      const num = Number(answer);
      if (isNaN(num)) return "请输入数字";
      if (config.integerOnly && !Number.isInteger(num)) return "请输入整数";
      if (config.minValue !== undefined && num < config.minValue) {
        return `不能小于 ${config.minValue}`;
      }
      if (config.maxValue !== undefined && num > config.maxValue) {
        return `不能大于 ${config.maxValue}`;
      }
      break;
  }
  
  return null;
}

// ========== 跳转逻辑函数（增强版，已移除 option_all 和 option_exact）==========
async function getNextQuestionId(survey, currentQuestionId, answer) {
    const currentQ = survey.questions.find(q => q.questionId === currentQuestionId);
    if (!currentQ || !currentQ.logic?.length) return null;

    // 1. 根据题目类型标准化答案格式
    let normalizedAnswer = answer;
    if (currentQ.type === 'multi_choice') {
        if (!Array.isArray(answer)) {
            normalizedAnswer = answer ? [answer] : [];
        }
    } else if (currentQ.type === 'single_choice') {
        if (Array.isArray(answer)) {
            normalizedAnswer = answer[0];
        }
    } else if (currentQ.type === 'number') {
        normalizedAnswer = Number(answer);
        if (isNaN(normalizedAnswer)) normalizedAnswer = null;
    }

    // 2. 按优先级排序
    const sortedRules = [...currentQ.logic].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    for (const rule of sortedRules) {
        let match = true;
        for (const cond of rule.conditions) {
            if (cond.type === 'option_selected') {
                // 单选：直接比较值
                if (normalizedAnswer !== cond.optionValue) match = false;
            } 
            else if (cond.type === 'option_any') {
                // 多选：答案数组中必须包含指定选项
                if (!Array.isArray(normalizedAnswer) || !normalizedAnswer.includes(cond.optionValue)) match = false;
            } 
            else if (cond.type === 'value_range') {
                // 数字范围
                const num = Number(normalizedAnswer);
                if (isNaN(num) || num < cond.min || num > cond.max) match = false;
            }
            if (!match) break;
        }
        if (match) {
            return rule.targetQuestionId;
        }
    }
    return null;
}

// ========== 用户 API ==========

// 首页
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 注册
app.post("/api/register", async (req, res) => {
  try {
    console.log("收到注册请求:", req.body);
    
    const { username, password, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: "用户名至少3个字符" });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: "密码至少6个字符" });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "用户名已存在" });
    }
    
    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log("原始密码:", password);
    console.log("加密后密码:", hashedPassword);
    
    const user = new User({ 
      username: username.trim(), 
      password: hashedPassword,
      email: email || ""
    });
    
    await user.save();
    
    console.log("用户创建成功:", user.username);
    console.log("数据库中存储的密码:", user.password);
    
    const token = jwt.sign(
      { userId: user._id, username: user.username }, 
      JWT_SECRET, 
      { expiresIn: "7d" }
    );
    
    res.json({
      success: true,
      message: "注册成功",
      token,
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email 
      }
    });
  } catch (err) {
    console.error("注册错误:", err);
    res.status(500).json({ 
      success: false,
      error: err.message
    });
  }
});

// 获取当前用户信息
app.get("/api/me", authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// 获取我的问卷列表
app.get("/api/my-surveys", authMiddleware, async (req, res) => {
  try {
    const surveys = await Survey.find({ creatorId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, surveys });
  } catch (err) {
    console.error("获取问卷列表错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 登录
app.post("/api/login", async (req, res) => {
  try {
    console.log("收到登录请求:", req.body.username);
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    
    console.log("用户密码:", user.password);
    console.log("输入的密码:", password);
    
    const bcrypt = require("bcryptjs");
    const isValid = await bcrypt.compare(password, user.password);
    
    console.log("密码验证结果:", isValid);
    
    if (!isValid) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    
    const token = jwt.sign(
      { userId: user._id, username: user.username }, 
      JWT_SECRET, 
      { expiresIn: "7d" }
    );
    
    res.json({
      success: true,
      message: "登录成功",
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error("登录错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 创建问卷
app.post("/api/create-survey", authMiddleware, async (req, res) => {
  try {
    const { title, description, allowAnonymous, allowMultipleSubmit, deadline } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: "问卷标题不能为空" });
    }
    
    const surveyId = `SURVEY_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const survey = new Survey({
      surveyId,
      title,
      description: description || "",
      allowAnonymous: allowAnonymous || false,
      allowMultipleSubmit: allowMultipleSubmit !== false,
      status: "published",
      deadline: deadline || null,
      creatorId: req.user._id,
      questions: []
    });
    
    await survey.save();
    
    req.user.survey_ids.push(survey._id);
    await req.user.save();
    
    res.json({ success: true, message: "问卷创建成功", survey });
  } catch (err) {
    console.error("创建问卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 获取问卷（公开）
app.get("/api/survey/:surveyId", async (req, res) => {
  try {
    const survey = await Survey.findOne({ surveyId: req.params.surveyId });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在" });
    }
    
    if (survey.deadline && new Date() > survey.deadline) {
      return res.status(403).json({ error: "问卷已截止" });
    }
    
    if (survey.status !== "published") {
      return res.status(403).json({ error: "问卷未发布" });
    }
    
    res.json({
      success: true,
      survey: {
        surveyId: survey.surveyId,
        title: survey.title,
        description: survey.description,
        allowAnonymous: survey.allowAnonymous,
        deadline: survey.deadline,
        questions: survey.questions.map(q => ({
          questionId: q.questionId,
          title: q.title || q.questionId,
          type: q.type,
          required: q.required,
          config: q.config
        }))
      }
    });
  } catch (err) {
    console.error("获取问卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 添加题目
app.post("/api/add-question", authMiddleware, async (req, res) => {
  try {
    const { surveyId, questionId, title, type, required, config } = req.body;

    if (type === "text") {
      if (
        config?.minLength !== undefined &&
        config?.maxLength !== undefined &&
        config.minLength > config.maxLength
      ) {
        return res.status(400).json({
          error: "文本题：最大长度必须大于或等于最小长度"
        });
      }
    }

    if (type === "number") {
      if (
        config?.minValue !== undefined &&
        config?.maxValue !== undefined &&
        config.minValue > config.maxValue
      ) {
        return res.status(400).json({
          error: "数字题：最大值必须大于或等于最小值"
        });
      }
    }

    const survey = await Survey.findOne({ surveyId, creatorId: req.user._id });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }
    
    if (survey.questions.some(q => q.questionId === questionId)) {
      return res.status(400).json({ error: "题目ID已存在" });
    }
    
    survey.questions.push({
      questionId,
      title: title || questionId,
      type,
      required: required || false,
      order: survey.questions.length,
      config: config || {}
    });
    
    await survey.save();
    res.json({ success: true, message: "题目添加成功", question: survey.questions[survey.questions.length - 1] });
  } catch (err) {
    console.error("添加题目错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 添加跳转逻辑（已移除 option_all 和 option_exact）
app.post("/api/add-logic", authMiddleware, async (req, res) => {
  try {
    let { surveyId, sourceQuestionId, conditions, targetQuestionId, priority } = req.body;

    if (!surveyId || !sourceQuestionId || !conditions || !targetQuestionId) {
      return res.status(400).json({ error: "参数不完整" });
    }

    if (typeof conditions === "string") {
      try {
        conditions = JSON.parse(conditions);
      } catch (e) {
        return res.status(400).json({ error: "conditions 格式错误，应为数组" });
      }
    }

    if (!Array.isArray(conditions)) {
      return res.status(400).json({ error: "conditions 必须是数组" });
    }

    const survey = await Survey.findOne({ surveyId, creatorId: req.user._id });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }

    const question = survey.questions.find(q => q.questionId === sourceQuestionId);
    if (!question) {
      return res.status(404).json({ error: "源题目不存在" });
    }

    if (!survey.questions.some(q => q.questionId === targetQuestionId)) {
      return res.status(404).json({ error: "目标题目不存在" });
    }

    // 标准化 conditions（只保留 option_selected, option_any, value_range）
    const normalizedConditions = conditions.map(cond => {
      if (!cond.type) {
        throw new Error("条件缺少 type");
      }

      if (cond.type === "option_selected") {
        if (!cond.optionValue) {
          throw new Error("单选条件缺少 optionValue");
        }
        return {
          type: "option_selected",
          operator: "equals",
          optionValue: cond.optionValue
        };
      }

      if (cond.type === "option_any") {
        if (!cond.optionValue) {
          throw new Error("option_any 缺少 optionValue");
        }
        return {
          type: "option_any",
          operator: "contains",
          optionValue: cond.optionValue
        };
      }

      if (cond.type === "value_range") {
        const min = Number(cond.min);
        const max = Number(cond.max);

        if (isNaN(min) || isNaN(max)) {
          throw new Error("数值范围必须是数字");
        }

        if (min > max) {
          throw new Error("最小值不能大于最大值");
        }

        return {
          type: "value_range",
          operator: "range",
          min,
          max
        };
      }

      throw new Error(`不支持的条件类型: ${cond.type}`);
    });

    question.logic = question.logic || [];

    const finalPriority =
      priority !== undefined
        ? Number(priority)
        : question.logic.length + 1;

    question.logic.push({
      conditions: normalizedConditions,
      targetQuestionId,
      priority: finalPriority
    });

    await survey.save();

    res.json({
      success: true,
      message: "跳转逻辑添加成功",
      logic: {
        conditions: normalizedConditions,
        targetQuestionId,
        priority: finalPriority
      }
    });

  } catch (err) {
    console.error("添加跳转逻辑错误:", err);
    res.status(500).json({
      error: err.message || "服务器错误"
    });
  }
});

// 提交答卷
app.post("/api/submit-response", async (req, res) => {
  try {
    const { surveyId, answers, respondentName, isAnonymous } = req.body;
    
    const survey = await Survey.findOne({ surveyId });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在" });
    }
    
    if (survey.deadline && new Date() > survey.deadline) {
      return res.status(403).json({ error: "问卷已截止" });
    }
    
    for (const q of survey.questions) {
      const answer = answers?.find(a => a.questionId === q.questionId);
      const validationError = validateAnswer(q, answer?.value);
      if (validationError) {
        return res.status(400).json({ error: `题目 ${q.title || q.questionId}: ${validationError}` });
      }
    }
    
    const response = new Response({
      surveyId: survey._id,
      respondentName: isAnonymous ? null : (respondentName || "匿名用户"),
      isAnonymous: isAnonymous || false,
      answers: answers?.map(a => ({ questionId: a.questionId, value: a.value })) || [],
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });
    
    await response.save();
    
    res.json({ success: true, message: "提交成功", responseId: response.responseId });
  } catch (err) {
    console.error("提交答卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 获取统计结果
app.get("/api/survey-stats/:surveyId", authMiddleware, async (req, res) => {
  try {
    const survey = await Survey.findOne({ surveyId: req.params.surveyId, creatorId: req.user._id });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }
    
    const responses = await Response.find({ surveyId: survey._id });
    
    const stats = {
      totalResponses: responses.length,
      questions: {}
    };
    
    for (const q of survey.questions) {
      stats.questions[q.questionId] = {
        title: q.title || q.questionId,
        type: q.type,
        total: 0
      };
      
      if (q.type === "single_choice" && q.config?.options) {
        stats.questions[q.questionId].options = {};
        q.config.options.forEach(opt => {
          stats.questions[q.questionId].options[opt.value] = { label: opt.label, count: 0 };
        });
      }
      else if (q.type === "multi_choice" && q.config?.options) {
        stats.questions[q.questionId].options = {};
        q.config.options.forEach(opt => {
          stats.questions[q.questionId].options[opt.value] = { label: opt.label, count: 0 };
        });
        stats.questions[q.questionId].totalSelections = 0;
      }
      else if (q.type === "text") {
        stats.questions[q.questionId].answers = [];
      }
      else if (q.type === "number") {
        stats.questions[q.questionId].values = [];
        stats.questions[q.questionId].sum = 0;
        stats.questions[q.questionId].avg = 0;
        stats.questions[q.questionId].min = null;
        stats.questions[q.questionId].max = null;
      }
    }
    
    for (const r of responses) {
      for (const a of r.answers) {
        const qStat = stats.questions[a.questionId];
        if (!qStat) continue;
        
        qStat.total++;
        
        if (qStat.type === "single_choice") {
          if (qStat.options[a.value]) {
            qStat.options[a.value].count++;
          }
        }
        else if (qStat.type === "multi_choice" && Array.isArray(a.value)) {
          for (const v of a.value) {
            if (qStat.options[v]) {
              qStat.options[v].count++;
              qStat.totalSelections = (qStat.totalSelections || 0) + 1;
            }
          }
        }
        else if (qStat.type === "text") {
          qStat.answers.push(a.value);
        }
        else if (qStat.type === "number") {
          const num = Number(a.value);
          if (!isNaN(num)) {
            qStat.values.push(num);
            qStat.sum += num;
            if (qStat.min === null || num < qStat.min) qStat.min = num;
            if (qStat.max === null || num > qStat.max) qStat.max = num;
          }
        }
      }
    }
    
    for (const q of survey.questions) {
      const qStat = stats.questions[q.questionId];
      if (qStat?.type === "number" && qStat.values.length > 0) {
        qStat.avg = (qStat.sum / qStat.values.length).toFixed(2);
      }
    }
    
    res.json({ success: true, stats });
  } catch (err) {
    console.error("统计错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 测试跳转逻辑
app.post("/api/test-jump", async (req, res) => {
  try {
    const { surveyId, currentQuestionId, answer } = req.body;
    const survey = await Survey.findOne({ surveyId });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在" });
    }
    
    const nextId = await getNextQuestionId(survey, currentQuestionId, answer);
    res.json({ success: true, nextQuestionId: nextId });
  } catch (err) {
    console.error("跳转测试错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 测试接口 - 验证注册是否工作
app.get("/api/test-register", async (req, res) => {
  try {
    const { username, password } = req.query;
    
    await User.deleteOne({ username: username || "testuser" });
    
    const user = new User({ 
      username: username || "testuser", 
      password: password || "123456" 
    });
    await user.save();
    
    res.json({ 
      success: true, 
      message: "测试用户创建成功", 
      user: { username: user.username, passwordHashed: user.password.substring(0, 20) + "..." }
    });
  } catch (err) {
    console.error("测试注册错误:", err);
    res.json({ success: false, error: err.message });
  }
});

// 获取我的单个问卷详情
app.get("/api/my-survey/:surveyId", authMiddleware, async (req, res) => {
  try {
    console.log("获取问卷详情，surveyId:", req.params.surveyId);
    console.log("用户ID:", req.user._id);
    
    const survey = await Survey.findOne({ 
      surveyId: req.params.surveyId, 
      creatorId: req.user._id 
    });
    
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在" });
    }
    
    res.json({ 
      success: true, 
      survey: {
        _id: survey._id,
        surveyId: survey.surveyId,
        title: survey.title,
        description: survey.description,
        status: survey.status,
        deadline: survey.deadline,
        allowAnonymous: survey.allowAnonymous,
        allowMultipleSubmit: survey.allowMultipleSubmit,
        questions: survey.questions,
        createdAt: survey.createdAt
      }
    });
  } catch (err) {
    console.error("获取问卷详情错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 更新问卷信息
app.put("/api/update-survey", authMiddleware, async (req, res) => {
  try {
    const { surveyId, title, description, status } = req.body;
    
    const survey = await Survey.findOne({ surveyId, creatorId: req.user._id });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }
    
    if (title) survey.title = title;
    if (description !== undefined) survey.description = description;
    if (status) survey.status = status;
    
    await survey.save();
    
    res.json({ success: true, message: "问卷信息更新成功", survey });
  } catch (err) {
    console.error("更新问卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 删除题目
app.delete("/api/delete-question", authMiddleware, async (req, res) => {
  try {
    const { surveyId, questionId } = req.body;
    
    const survey = await Survey.findOne({ surveyId, creatorId: req.user._id });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }
    
    const questionIndex = survey.questions.findIndex(q => q.questionId === questionId);
    if (questionIndex === -1) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    survey.questions.splice(questionIndex, 1);
    
    survey.questions.forEach((q, idx) => {
      q.order = idx;
    });
    
    await survey.save();
    
    res.json({ success: true, message: "题目删除成功" });
  } catch (err) {
    console.error("删除题目错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 删除跳转逻辑
app.delete("/api/delete-logic", authMiddleware, async (req, res) => {
  try {
    const { surveyId, questionId, logicIndex } = req.body;
    
    const survey = await Survey.findOne({ surveyId, creatorId: req.user._id });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }
    
    const question = survey.questions.find(q => q.questionId === questionId);
    if (!question) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    if (!question.logic || logicIndex >= question.logic.length) {
      return res.status(404).json({ error: "跳转逻辑不存在" });
    }
    
    question.logic.splice(logicIndex, 1);
    
    await survey.save();
    
    res.json({ success: true, message: "跳转逻辑删除成功" });
  } catch (err) {
    console.error("删除跳转逻辑错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 更新题目
app.put("/api/update-question", authMiddleware, async (req, res) => {
  try {
    const { surveyId, questionId, title, required, config } = req.body;
    
    const survey = await Survey.findOne({ surveyId, creatorId: req.user._id });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }
    
    const question = survey.questions.find(q => q.questionId === questionId);
    if (!question) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    if (title) question.title = title;
    if (required !== undefined) question.required = required;
    if (config) {
      // 校验配置
      if (question.type === "text") {
        if (
          config.minLength !== undefined &&
          config.maxLength !== undefined &&
          config.minLength > config.maxLength
        ) {
          return res.status(400).json({
            error: "文本题：最大长度必须大于或等于最小长度"
          });
        }
      }
      if (question.type === "number") {
        if (
          config.minValue !== undefined &&
          config.maxValue !== undefined &&
          config.minValue > config.maxValue
        ) {
          return res.status(400).json({
            error: "数字题：最大值必须大于或等于最小值"
          });
        }
      }
      question.config = { ...question.config, ...config };
    }
    
    await survey.save();
    
    res.json({ success: true, message: "题目更新成功", question });
  } catch (err) {
    console.error("更新题目错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 发布问卷
app.post("/api/publish-survey/:surveyId", authMiddleware, async (req, res) => {
  try {
    const survey = await Survey.findOne({ 
      surveyId: req.params.surveyId, 
      creatorId: req.user._id 
    });
    
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }
    
    survey.status = "published";
    survey.publishedAt = new Date();
    
    await survey.save();
    
    res.json({ success: true, message: "问卷发布成功", survey });
  } catch (err) {
    console.error("发布问卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 关闭问卷
app.post("/api/close-survey/:surveyId", authMiddleware, async (req, res) => {
  try {
    const survey = await Survey.findOne({ 
      surveyId: req.params.surveyId, 
      creatorId: req.user._id 
    });
    
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在或无权限" });
    }
    
    survey.status = "closed";
    
    await survey.save();
    
    res.json({ success: true, message: "问卷已关闭", survey });
  } catch (err) {
    console.error("关闭问卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📝 前端页面: http://localhost:${PORT}`);
  console.log(`🔌 API 接口: http://localhost:${PORT}/api`);
  console.log(`\n可用接口:`);
  console.log(`  POST   /api/register     - 注册`);
  console.log(`  POST   /api/login        - 登录`);
  console.log(`  GET    /api/me           - 获取用户信息（需token）`);
  console.log(`  GET    /api/my-surveys   - 我的问卷（需token）`);
  console.log(`  POST   /api/create-survey - 创建问卷（需token）`);
  console.log(`  GET    /api/survey/:id   - 获取问卷（公开）`);
  console.log(`  POST   /api/submit-response - 提交答卷（公开）`);
  console.log(`  GET    /api/survey-stats/:id - 统计（需token）\n`);
});