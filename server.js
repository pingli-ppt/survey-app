const express = require("express");
const mongoose = require("./db"); // 你的 MongoDB 连接文件
const Survey = require("./models/Survey");
const Response = require("./models/Response");
const User = require("./models/User");

const app = express();

// JSON 支持
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// 测试接口
app.get("/", (req, res) => {
  res.send("后端启动成功 🚀");
});

// 注册用户
app.post("/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const user = new User({ username, password, email });
    await user.save();
    res.json({ message: "注册成功", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取用户创建的问卷（前端加载下拉）
app.get("/my-surveys", async (req, res) => {
  try {
    const surveys = await Survey.find({});
    res.json(surveys);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建问卷
app.post("/create-survey", async (req, res) => {
  try {
    const { surveyId, title, description, allowAnonymous } = req.body;
    const survey = new Survey({
      surveyId,
      title,
      description,
      allow_multiple_submit: true,
      creatorId: null,
      status: "draft",
      allowAnonymous,
      deadline: new Date(Date.now() + 7*24*60*60*1000), // 一周后截止
      questions: []
    });
    await survey.save();
    res.json({ message: "问卷创建成功 ✅", survey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加题目
app.post("/add-question", async (req, res) => {
  try {
    const { surveyId, questionId, type, required, config } = req.body;
    const survey = await Survey.findOne({ surveyId });
    if (!survey) return res.status(404).send("问卷不存在 ❌");

    survey.questions.push({
      questionId,
      type,
      required,
      config,
      logic: []
    });

    await survey.save();
    res.json({ message: "题目添加成功 ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取问卷详情
app.get("/get-survey", async (req, res) => {
  try {
    const { surveyId } = req.query;
    const survey = await Survey.findOne({ surveyId });
    if (!survey) return res.status(404).send("问卷不存在 ❌");
    res.json(survey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加跳转逻辑
app.post("/add-logic", async (req, res) => {
  try {
    const { surveyId, sourceQuestionId, targetQuestionId, optionValue } = req.body;
    const survey = await Survey.findOne({ surveyId });
    if (!survey) return res.status(404).send("问卷不存在 ❌");

    const logic = {
      sourceQuestionId,
      conditions: [
        {
          type: "option_selected",
          optionValue
        }
      ],
      operator: "equals",
      targetQuestionId,
      priority: 1
    };

    survey.questions.forEach(q => {
      if (q.questionId === sourceQuestionId) {
        q.logic.push(logic);
      }
    });

    await survey.save();
    res.json({ message: "跳转逻辑添加成功 ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 提交答卷
app.post("/submit-response", async (req, res) => {
  try {
    const { surveyId, respondentId, respondentName, isAnonymous, answers } = req.body;
    const survey = await Survey.findOne({ surveyId });
    if (!survey) return res.status(404).send("问卷不存在 ❌");

    // 必填题校验
    for (let q of survey.questions) {
      if (q.required) {
        const ans = answers.find(a => a.questionId === q.questionId);
        if (!ans || ans.value === "" || ans.value == null) {
          return res.status(400).send(`题目 ${q.questionId} 是必填 ❌`);
        }
      }
    }

    const response = new Response({
      surveyId: survey._id,
      responseId: new mongoose.Types.ObjectId(),
      respondentId: respondentId || null,
      respondentName: respondentName || null,
      isAnonymous: isAnonymous || false,
      answers
    });

    await response.save();
    res.json({ message: "答卷提交成功 ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取问卷统计
app.get("/get-survey-stats", async (req, res) => {
  try {
    const { surveyId } = req.query;
    const survey = await Survey.findOne({ surveyId });
    if (!survey) return res.status(404).send("问卷不存在 ❌");

    const responses = await Response.find({ surveyId: survey._id });

    const stats = {};
    survey.questions.forEach(q => {
      stats[q.questionId] = {};
      if (q.type === "single_choice" || q.type === "multi_choice") {
        q.config.options.forEach(opt => stats[q.questionId][opt.value] = 0);
      }
    });

    responses.forEach(r => {
      r.answers.forEach(a => {
        if (Array.isArray(a.value)) {
          a.value.forEach(v => stats[a.questionId][v]++);
        } else {
          if (stats[a.questionId] && stats[a.questionId][a.value] !== undefined) stats[a.questionId][a.value]++;
        }
      });
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("服务器运行在 http://localhost:3000");
});