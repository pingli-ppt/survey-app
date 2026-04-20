const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const authMiddleware = require("./middleware/auth");
const questionRoutes = require("./routes/questions");

const User = require("./models/User");
const Survey = require("./models/Survey");
const Response = require("./models/Response");

const app = express();
const PORT = 3000;
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

// 路由
app.use("/api/questions", questionRoutes);

// ========== 用户 API ==========

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空" });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "用户名已存在" });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = new User({ username, password: hashedPassword, email });
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    
    res.json({
      success: true,
      message: "注册成功",
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error("注册错误:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
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

app.get("/api/me", authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ========== 问卷 API ==========

// 获取我的单个问卷详情（带完整题目信息）
app.get("/api/my-survey/:surveyId", authMiddleware, async (req, res) => {
  try {
    const survey = await Survey.findOne({ 
      surveyId: req.params.surveyId, 
      creatorId: req.user._id 
    });
    
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在" });
    }
    
    // 获取每个题目的详细信息
    const questionsWithDetails = [];
    for (const sq of survey.questions) {
      const QuestionVersion = require("./models/QuestionVersion");
      const version = await QuestionVersion.findOne({ versionId: sq.versionId });
      
      if (version) {
        questionsWithDetails.push({
          questionId: sq.versionId,
          title: version.title,
          type: version.type,
          required: true,
          config: version.config,
          order: sq.order,
          logic: sq.logic
        });
      }
    }
    
    // 按 order 排序
    questionsWithDetails.sort((a, b) => (a.order || 0) - (b.order || 0));
    
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
        questions: questionsWithDetails,
        createdAt: survey.createdAt
      }
    });
  } catch (err) {
    console.error("获取问卷详情错误:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/create-survey", authMiddleware, async (req, res) => {
  try {
    const { title, description, allowAnonymous, allowMultipleSubmit, deadline } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: "问卷标题不能为空" });
    }
    
    const surveyId = Survey.generateSurveyId();
    
    const survey = new Survey({
      surveyId,
      title,
      description: description || "",
      allowAnonymous: allowAnonymous || false,
      allowMultipleSubmit: allowMultipleSubmit !== false,
      status: "draft",
      deadline: deadline || null,
      creatorId: req.user._id,
      questions: []
    });
    
    await survey.save();
    
    await User.updateOne(
      { _id: req.user._id },
      { $push: { survey_ids: survey._id } }
    );
    
    res.json({ success: true, message: "问卷创建成功", survey });
  } catch (err) {
    console.error("创建问卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

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

app.post("/api/add-question", authMiddleware, async (req, res) => {
  try {
    const { surveyId, questionId, title, type, required, config } = req.body;
    
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
    res.json({ success: true, message: "题目添加成功" });
  } catch (err) {
    console.error("添加题目错误:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/add-logic", authMiddleware, async (req, res) => {
  try {
    const { surveyId, sourceQuestionId, conditions, targetQuestionId, priority } = req.body;
    
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
    
    question.logic = question.logic || [];
    question.logic.push({
      conditions,
      targetQuestionId,
      priority: priority || question.logic.length + 1
    });
    
    await survey.save();
    
    res.json({ success: true, message: "跳转逻辑添加成功" });
  } catch (err) {
    console.error("添加跳转逻辑错误:", err);
    res.status(500).json({ error: err.message });
  }
});

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

// 获取问卷详情（新版）
app.get("/api/survey/:surveyId", async (req, res) => {
  try {
    const survey = await Survey.findOne({ surveyId: req.params.surveyId });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在" });
    }
    
    // 获取每个题目的详情
    const questions = [];
    for (const sq of survey.questions) {
      // 从 QuestionVersion 获取题目内容
      const QuestionVersion = require("./models/QuestionVersion");
      const version = await QuestionVersion.findOne({ versionId: sq.versionId });
      
      if (version) {
        questions.push({
          questionId: sq.versionId,
          title: version.title,
          type: version.type,        // 🔥 关键：必须有 type
          required: true,
          config: version.config || {}
        });
      } else {
        console.warn(`版本不存在: ${sq.versionId}`);
      }
    }
    
    res.json({
      success: true,
      survey: {
        surveyId: survey.surveyId,
        title: survey.title,
        description: survey.description || "",
        allowAnonymous: survey.allowAnonymous,
        deadline: survey.deadline,
        questions: questions
      }
    });
  } catch (err) {
    console.error("获取问卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

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
    
    const response = new Response({
      surveyId: survey._id,
      respondentName: isAnonymous ? null : (respondentName || "匿名用户"),
      isAnonymous: isAnonymous || false,
      answers: answers || [],
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

app.post("/api/test-jump", async (req, res) => {
  try {
    const { surveyId, currentQuestionId, answer } = req.body;
    
    const survey = await Survey.findOne({ surveyId });
    if (!survey) {
      return res.status(404).json({ error: "问卷不存在" });
    }
    
    const currentQ = survey.questions.find(q => q.questionId === currentQuestionId);
    if (!currentQ || !currentQ.logic?.length) {
      return res.json({ success: true, nextQuestionId: null });
    }
    
    let nextId = null;
    for (const rule of currentQ.logic) {
      let match = true;
      for (const cond of rule.conditions) {
        if (cond.type === "option_selected") {
          if (answer !== cond.optionValue) match = false;
        } else if (cond.type === "value_range") {
          const num = Number(answer);
          if (isNaN(num) || num < cond.min || num > cond.max) match = false;
        }
      }
      if (match) {
        nextId = rule.targetQuestionId;
        break;
      }
    }
    
    res.json({ success: true, nextQuestionId: nextId });
  } catch (err) {
    console.error("跳转测试错误:", err);
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
    
    // 构建统计结果
    const stats = {
      totalResponses: responses.length,
      questions: {}
    };
    
    // 🔥 修复：从 QuestionVersion 获取题目信息
    for (const sq of survey.questions) {
      const QuestionVersion = require("./models/QuestionVersion");
      const version = await QuestionVersion.findOne({ versionId: sq.versionId });
      
      if (version) {
        stats.questions[sq.versionId] = {
          title: version.title,        // 🔥 从版本表获取标题
          type: version.type,
          total: 0
        };
        
        // 根据题型初始化统计结构
        if (version.type === "single_choice" && version.config?.options) {
          stats.questions[sq.versionId].options = {};
          version.config.options.forEach(opt => {
            stats.questions[sq.versionId].options[opt.value] = { label: opt.label, count: 0 };
          });
        }
        else if (version.type === "multi_choice" && version.config?.options) {
          stats.questions[sq.versionId].options = {};
          version.config.options.forEach(opt => {
            stats.questions[sq.versionId].options[opt.value] = { label: opt.label, count: 0 };
          });
          stats.questions[sq.versionId].totalSelections = 0;
        }
        else if (version.type === "text") {
          stats.questions[sq.versionId].answers = [];
        }
        else if (version.type === "number") {
          stats.questions[sq.versionId].values = [];
          stats.questions[sq.versionId].sum = 0;
          stats.questions[sq.versionId].avg = 0;
          stats.questions[sq.versionId].min = null;
          stats.questions[sq.versionId].max = null;
        }
      }
    }
    
    // 统计答卷数据
    for (const r of responses) {
      for (const a of r.answers) {
        const qStat = stats.questions[a.questionId];
        if (!qStat) continue;
        
        qStat.total++;
        
        if (qStat.type === "single_choice" && qStat.options && qStat.options[a.value]) {
          qStat.options[a.value].count++;
        }
        else if (qStat.type === "multi_choice" && Array.isArray(a.value)) {
          for (const v of a.value) {
            if (qStat.options && qStat.options[v]) {
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
    
    // 计算数字题平均值
    for (const qId in stats.questions) {
      const qStat = stats.questions[qId];
      if (qStat?.type === "number" && qStat.values && qStat.values.length > 0) {
        qStat.avg = (qStat.sum / qStat.values.length).toFixed(2);
      }
    }
    
    res.json({ success: true, stats });
  } catch (err) {
    console.error("统计错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📝 前端页面: http://localhost:${PORT}`);
  console.log(`📚 题库管理: http://localhost:${PORT}/question-bank.html`);
  console.log(`🔌 API 接口: http://localhost:${PORT}/api\n`);
});