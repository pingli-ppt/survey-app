const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Survey = require("../models/Survey");
const QuestionBank = require("../models/QuestionBank");
const QuestionVersion = require("../models/QuestionVersion");
const QuestionUsage = require("../models/QuestionUsage");
const Response = require("../models/Response");
const authMiddleware = require("../middleware/auth");

// ========== 1. 创建题目 ==========
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { title, type, config, isPublic, changeNote } = req.body;
    
    if (!title || !type) {
      return res.status(400).json({ error: "标题和类型不能为空" });
    }
    
    const baseId = QuestionBank.generateBaseId();
    const version = 1;
    const versionId = QuestionVersion.generateVersionId(baseId, version);
    
    const questionBank = new QuestionBank({
      baseId,
      ownerId: req.user._id,
      currentVersion: version,
      isPublic: isPublic || false
    });
    await questionBank.save();
    
    const questionVersion = new QuestionVersion({
      versionId,
      baseId,
      version,
      parentVersionId: null,
      title,
      type,
      config: config || {},
      changeNote: changeNote || "初始版本",
      createdBy: req.user._id
    });
    await questionVersion.save();
    
    res.json({
      success: true,
      message: "题目创建成功",
      data: {
        baseId,
        versionId,
        version: 1,
        title,
        type,
        config
      }
    });
  } catch (err) {
    console.error("创建题目错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 2. 获取我的题目列表 ==========
router.get("/my-questions", authMiddleware, async (req, res) => {
  try {
    const questions = await QuestionBank.find({ ownerId: req.user._id })
      .sort({ createdAt: -1 });
    
    const result = [];
    for (const q of questions) {
      const latestVersion = await QuestionVersion.findOne({ 
        baseId: q.baseId, 
        version: q.currentVersion 
      });
      if (latestVersion) {
        result.push({
          baseId: q.baseId,
          currentVersion: q.currentVersion,
          title: latestVersion.title,
          type: latestVersion.type,
          isPublic: q.isPublic,
          usageCount: q.usageCount,
          createdAt: q.createdAt
        });
      }
    }
    
    res.json({ success: true, questions: result });
  } catch (err) {
    console.error("获取题目列表错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 3. 获取共享题目（其他用户公开或专门分享给我的） ==========
router.get("/shared-questions", authMiddleware, async (req, res) => {
  try {
    const questions = await QuestionBank.find({
      $or: [
        { isPublic: true },
        { sharedWith: req.user._id }
      ],
      ownerId: { $ne: req.user._id }
    }).sort({ createdAt: -1 });
    
    const result = [];
    for (const q of questions) {
      const latestVersion = await QuestionVersion.findOne({ 
        baseId: q.baseId, 
        version: q.currentVersion 
      });
      if (latestVersion) {
        const owner = await User.findById(q.ownerId).select("username");
        result.push({
          baseId: q.baseId,
          currentVersion: q.currentVersion,
          title: latestVersion.title,
          type: latestVersion.type,
          ownerId: q.ownerId,
          ownerName: owner ? owner.username : "未知用户",
          isPublic: q.isPublic,
          usageCount: q.usageCount,
          createdAt: q.createdAt
        });
      }
    }
    
    res.json({ success: true, questions: result });
  } catch (err) {
    console.error("获取共享题目错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 4. 获取题目详情（含所有版本） ==========
router.get("/:baseId", authMiddleware, async (req, res) => {
  try {
    const { baseId } = req.params;
    
    const questionBank = await QuestionBank.findOne({ baseId });
    if (!questionBank) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    const isOwner = questionBank.ownerId.toString() === req.user._id.toString();
    const isShared = questionBank.isPublic || 
      questionBank.sharedWith.some(id => id.toString() === req.user._id.toString());
    
    if (!isOwner && !isShared) {
      return res.status(403).json({ error: "无权限访问" });
    }
    
    const versions = await QuestionVersion.find({ baseId }).sort({ version: 1 });
    const currentVersion = versions.find(v => v.version === questionBank.currentVersion);
    
    res.json({
      success: true,
      data: {
        baseId,
        ownerId: questionBank.ownerId,
        currentVersion: questionBank.currentVersion,
        isPublic: questionBank.isPublic,
        sharedWith: questionBank.sharedWith,
        usageCount: questionBank.usageCount,
        versions: versions.map(v => ({
          versionId: v.versionId,
          version: v.version,
          title: v.title,
          type: v.type,
          config: v.config,
          changeNote: v.changeNote,
          createdAt: v.createdAt
        })),
        current: currentVersion ? {
          versionId: currentVersion.versionId,
          title: currentVersion.title,
          type: currentVersion.type,
          config: currentVersion.config
        } : null
      }
    });
  } catch (err) {
    console.error("获取题目详情错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 5. 创建新版本 ==========
router.post("/:baseId/new-version", authMiddleware, async (req, res) => {
  try {
    const { baseId } = req.params;
    const { title, type, config, changeNote } = req.body;
    
    const questionBank = await QuestionBank.findOne({ baseId });
    if (!questionBank) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    if (questionBank.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "只有所有者可以修改题目" });
    }
    
    const oldVersion = questionBank.currentVersion;
    const newVersion = oldVersion + 1;
    const versionId = QuestionVersion.generateVersionId(baseId, newVersion);
    const parentVersionId = QuestionVersion.generateVersionId(baseId, oldVersion);
    
    const oldVersionData = await QuestionVersion.findOne({ 
      baseId, 
      version: oldVersion 
    });
    
    const newVersionData = new QuestionVersion({
      versionId,
      baseId,
      version: newVersion,
      parentVersionId,
      title: title || oldVersionData.title,
      type: type || oldVersionData.type,
      config: config || oldVersionData.config,
      changeNote: changeNote || `从 v${oldVersion} 修改`,
      createdBy: req.user._id
    });
    await newVersionData.save();
    
    questionBank.currentVersion = newVersion;
    questionBank.updatedAt = new Date();
    await questionBank.save();
    
    res.json({
      success: true,
      message: `已创建新版本 v${newVersion}`,
      data: {
        oldVersion,
        newVersion,
        versionId,
        changeNote: changeNote || `从 v${oldVersion} 修改`
      }
    });
  } catch (err) {
    console.error("创建新版本错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 6. 恢复旧版本 ==========
router.post("/:baseId/restore/:version", authMiddleware, async (req, res) => {
  try {
    const { baseId, version } = req.params;
    const targetVersion = parseInt(version);
    
    const questionBank = await QuestionBank.findOne({ baseId });
    if (!questionBank) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    if (questionBank.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "只有所有者可以恢复版本" });
    }
    
    const targetVersionData = await QuestionVersion.findOne({ 
      baseId, 
      version: targetVersion 
    });
    if (!targetVersionData) {
      return res.status(404).json({ error: "版本不存在" });
    }
    
    const newVersion = questionBank.currentVersion + 1;
    const versionId = QuestionVersion.generateVersionId(baseId, newVersion);
    const parentVersionId = QuestionVersion.generateVersionId(baseId, targetVersion);
    
    const restoredVersion = new QuestionVersion({
      versionId,
      baseId,
      version: newVersion,
      parentVersionId,
      title: targetVersionData.title,
      type: targetVersionData.type,
      config: targetVersionData.config,
      changeNote: `恢复到 v${targetVersion}`,
      createdBy: req.user._id
    });
    await restoredVersion.save();
    
    questionBank.currentVersion = newVersion;
    questionBank.updatedAt = new Date();
    await questionBank.save();
    
    res.json({
      success: true,
      message: `已恢复到 v${targetVersion}，当前为 v${newVersion}`,
      data: {
        restoredVersion: targetVersion,
        newVersion,
        versionId
      }
    });
  } catch (err) {
    console.error("恢复版本错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 7. 分享题目（设置公开或分享给特定用户） ==========
router.post("/:baseId/share", authMiddleware, async (req, res) => {
  try {
    const { baseId } = req.params;
    const { userIds, isPublic } = req.body;
    
    const questionBank = await QuestionBank.findOne({ baseId });
    if (!questionBank) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    if (questionBank.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "只有所有者可以分享题目" });
    }
    
    if (isPublic !== undefined) {
      questionBank.isPublic = isPublic;
    }
    
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      for (const userId of userIds) {
        if (!questionBank.sharedWith.includes(userId)) {
          questionBank.sharedWith.push(userId);
        }
      }
    }
    
    await questionBank.save();
    
    res.json({
      success: true,
      message: "分享设置已更新",
      data: {
        isPublic: questionBank.isPublic,
        sharedWith: questionBank.sharedWith
      }
    });
  } catch (err) {
    console.error("分享题目错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 8. 获取可分享用户列表 ==========
router.get("/shareable-users", authMiddleware, async (req, res) => {
  try {
    // 获取除了自己以外的所有用户
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("username _id")
      .limit(50);
    
    res.json({
      success: true,
      users: users.map(u => ({ id: u._id, username: u.username }))
    });
  } catch (err) {
    console.error("获取用户列表错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 9. 取消分享（移除特定用户的访问权限） ==========
router.delete("/:baseId/share/:userId", authMiddleware, async (req, res) => {
  try {
    const { baseId, userId } = req.params;
    
    const questionBank = await QuestionBank.findOne({ baseId });
    if (!questionBank) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    if (questionBank.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "只有所有者可以管理分享" });
    }
    
    questionBank.sharedWith = questionBank.sharedWith.filter(
      id => id.toString() !== userId
    );
    await questionBank.save();
    
    res.json({
      success: true,
      message: "已取消分享",
      data: { sharedWith: questionBank.sharedWith }
    });
  } catch (err) {
    console.error("取消分享错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 10. 获取题目使用情况 ==========
router.get("/:baseId/usage", authMiddleware, async (req, res) => {
  try {
    const { baseId } = req.params;
    
    const questionBank = await QuestionBank.findOne({ baseId });
    if (!questionBank) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    const isOwner = questionBank.ownerId.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ error: "只有所有者可以查看使用情况" });
    }
    
    const usages = await QuestionUsage.find({ baseId })
      .populate("surveyId", "surveyId title status");
    
    const versions = await QuestionVersion.find({ baseId }).sort({ version: 1 });
    
    const surveyIds = usages.map(u => u.surveyId._id);
    const responses = await Response.find({ 
      surveyId: { $in: surveyIds } 
    });
    
    const versionStats = {};
    for (const version of versions) {
      versionStats[version.version] = {
        versionId: version.versionId,
        title: version.title,
        type: version.type,
        config: version.config,
        totalResponses: 0,
        answers: []
      };
    }
    
    for (const response of responses) {
      for (const answer of response.answers) {
        const version = versions.find(v => v.versionId === answer.questionId);
        if (version) {
          versionStats[version.version].totalResponses++;
          versionStats[version.version].answers.push(answer.value);
        }
      }
    }
    
    // 计算详细统计
    for (const [verNum, stats] of Object.entries(versionStats)) {
      const version = versions.find(v => v.version === parseInt(verNum));
      if (stats.answers.length > 0) {
        if (version.type === "number") {
          const numbers = stats.answers.filter(v => !isNaN(Number(v))).map(v => Number(v));
          stats.detailedStats = {
            avg: numbers.length ? (numbers.reduce((a,b) => a+b, 0) / numbers.length).toFixed(2) : null,
            min: numbers.length ? Math.min(...numbers) : null,
            max: numbers.length ? Math.max(...numbers) : null,
            count: numbers.length,
            allValues: numbers
          };
        } else if (version.type === "single_choice" && version.config?.options) {
          const counts = {};
          version.config.options.forEach(opt => {
            counts[opt.value] = { label: opt.label, count: 0, percentage: 0 };
          });
          stats.answers.forEach(ans => {
            if (counts[ans]) counts[ans].count++;
          });
          const total = stats.answers.length;
          for (const key in counts) {
            counts[key].percentage = total > 0 ? ((counts[key].count / total) * 100).toFixed(1) : 0;
          }
          stats.detailedStats = counts;
        } else if (version.type === "multi_choice" && version.config?.options) {
          const counts = {};
          version.config.options.forEach(opt => {
            counts[opt.value] = { label: opt.label, count: 0, percentage: 0 };
          });
          let totalSelections = 0;
          stats.answers.forEach(ans => {
            if (Array.isArray(ans)) {
              ans.forEach(v => {
                if (counts[v]) counts[v].count++;
                totalSelections++;
              });
            }
          });
          for (const key in counts) {
            counts[key].percentage = totalSelections > 0 ? ((counts[key].count / totalSelections) * 100).toFixed(1) : 0;
          }
          stats.detailedStats = {
            options: counts,
            totalSelections: totalSelections,
            totalRespondents: stats.answers.length,
            avgPerPerson: (totalSelections / stats.answers.length).toFixed(1)
          };
        } else if (version.type === "text") {
          stats.detailedStats = {
            answers: stats.answers,
            count: stats.answers.length
          };
        }
      }
    }
    
    const surveys = usages.map(u => ({
      surveyId: u.surveyId?.surveyId || "未知",
      title: u.surveyId?.title || "未知",
      status: u.surveyId?.status || "未知",
      versionUsed: u.versionId,
      responseCount: u.responseCount,
      lastUsedAt: u.lastUsedAt
    }));
    
    res.json({
      success: true,
      data: {
        baseId,
        totalUsage: usages.length,
        surveys,
        versions: versionStats,
        currentVersion: questionBank.currentVersion
      }
    });
  } catch (err) {
    console.error("查看使用情况错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 11. 跨问卷统计 ==========
router.get("/:baseId/cross-stats", authMiddleware, async (req, res) => {
  try {
    const { baseId } = req.params;
    
    const questionBank = await QuestionBank.findOne({ baseId });
    if (!questionBank) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    const isOwner = questionBank.ownerId.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ error: "只有所有者可以查看跨问卷统计" });
    }
    
    const versions = await QuestionVersion.find({ baseId }).sort({ version: 1 });
    const usages = await QuestionUsage.find({ baseId });
    const surveyIds = usages.map(u => u.surveyId);
    const responses = await Response.find({ 
      surveyId: { $in: surveyIds } 
    });
    
    const versionStats = {};
    for (const version of versions) {
      versionStats[version.version] = {
        versionId: version.versionId,
        title: version.title,
        type: version.type,
        config: version.config,
        totalResponses: 0,
        answers: []
      };
    }
    
    for (const response of responses) {
      for (const answer of response.answers) {
        const version = versions.find(v => v.versionId === answer.questionId);
        if (version) {
          versionStats[version.version].totalResponses++;
          versionStats[version.version].answers.push(answer.value);
        }
      }
    }
    
    // 计算每个版本的详细统计
    for (const [verNum, stats] of Object.entries(versionStats)) {
      const version = versions.find(v => v.version === parseInt(verNum));
      if (stats.answers.length > 0) {
        if (version.type === "number") {
          const numbers = stats.answers.filter(v => !isNaN(Number(v))).map(v => Number(v));
          stats.summary = {
            avg: numbers.length ? (numbers.reduce((a,b) => a+b, 0) / numbers.length).toFixed(2) : null,
            min: numbers.length ? Math.min(...numbers) : null,
            max: numbers.length ? Math.max(...numbers) : null,
            count: numbers.length,
            allValues: numbers
          };
        } else if (version.type === "single_choice" && version.config?.options) {
          const counts = {};
          version.config.options.forEach(opt => {
            counts[opt.value] = { label: opt.label, count: 0, percentage: 0 };
          });
          stats.answers.forEach(ans => {
            if (counts[ans]) counts[ans].count++;
          });
          const total = stats.answers.length;
          for (const key in counts) {
            counts[key].percentage = total > 0 ? ((counts[key].count / total) * 100).toFixed(1) : 0;
          }
          stats.summary = counts;
        } else if (version.type === "multi_choice" && version.config?.options) {
          const counts = {};
          version.config.options.forEach(opt => {
            counts[opt.value] = { label: opt.label, count: 0, percentage: 0 };
          });
          let totalSelections = 0;
          stats.answers.forEach(ans => {
            if (Array.isArray(ans)) {
              ans.forEach(v => {
                if (counts[v]) counts[v].count++;
                totalSelections++;
              });
            }
          });
          for (const key in counts) {
            counts[key].percentage = totalSelections > 0 ? ((counts[key].count / totalSelections) * 100).toFixed(1) : 0;
          }
          stats.summary = {
            options: counts,
            totalSelections: totalSelections,
            totalRespondents: stats.answers.length,
            avgPerPerson: (totalSelections / stats.answers.length).toFixed(1)
          };
        } else if (version.type === "text") {
          stats.summary = {
            answers: stats.answers,
            count: stats.answers.length
          };
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        baseId,
        currentVersion: questionBank.currentVersion,
        versions: versionStats
      }
    });
  } catch (err) {
    console.error("跨问卷统计错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 12. 更新题目版本（创建新版本） ==========
router.put("/:baseId/update-version", authMiddleware, async (req, res) => {
  try {
    const { baseId } = req.params;
    const { title, config, changeNote } = req.body;
    
    const questionBank = await QuestionBank.findOne({ baseId });
    if (!questionBank) {
      return res.status(404).json({ error: "题目不存在" });
    }
    
    if (questionBank.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "只有所有者可以修改题目" });
    }
    
    const currentVersionData = await QuestionVersion.findOne({ 
      baseId, 
      version: questionBank.currentVersion 
    });
    
    if (!currentVersionData) {
      return res.status(404).json({ error: "当前版本不存在" });
    }
    
    const newVersion = questionBank.currentVersion + 1;
    const versionId = QuestionVersion.generateVersionId(baseId, newVersion);
    
    const newVersionData = new QuestionVersion({
      versionId,
      baseId,
      version: newVersion,
      parentVersionId: currentVersionData.versionId,
      title: title || currentVersionData.title,
      type: currentVersionData.type,
      config: config || currentVersionData.config,
      changeNote: changeNote || `更新题目内容`,
      createdBy: req.user._id
    });
    await newVersionData.save();
    
    questionBank.currentVersion = newVersion;
    questionBank.updatedAt = new Date();
    await questionBank.save();
    
    res.json({
      success: true,
      message: `题目已更新，新版本 v${newVersion}`,
      data: {
        newVersion,
        versionId,
        changeNote: changeNote || `更新题目内容`
      }
    });
  } catch (err) {
    console.error("更新题目版本错误:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== 13. 从题库选题创建问卷 ==========
router.post("/create-survey-from-bank", authMiddleware, async (req, res) => {
  try {
    const { title, description, allowAnonymous, allowMultipleSubmit, deadline, selectedQuestions } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: "问卷标题不能为空" });
    }
    
    if (!selectedQuestions || selectedQuestions.length === 0) {
      return res.status(400).json({ error: "请至少选择一个题目" });
    }
    
    const Survey = require("../models/Survey");
    const User = require("../models/User");
    const QuestionVersion = require("../models/QuestionVersion");
    const QuestionUsage = require("../models/QuestionUsage");
    const QuestionBank = require("../models/QuestionBank");
    
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
    
    for (let i = 0; i < selectedQuestions.length; i++) {
      const sq = selectedQuestions[i];
      const version = await QuestionVersion.findOne({ versionId: sq.versionId });
      if (!version) {
        console.warn(`题目版本不存在: ${sq.versionId}`);
        continue;
      }
      
      survey.questions.push({
        questionBankId: version.baseId,
        versionId: sq.versionId,
        order: i,
        logic: null
      });
      
      await QuestionUsage.updateOne(
        { versionId: sq.versionId, surveyId: survey._id },
        { 
          $setOnInsert: { versionId: sq.versionId, baseId: version.baseId, surveyId: survey._id },
          $set: { lastUsedAt: new Date() }
        },
        { upsert: true }
      );
      
      await QuestionBank.updateOne(
        { baseId: version.baseId },
        { $inc: { usageCount: 1 }, $set: { updatedAt: new Date() } }
      );
    }
    
    await survey.save();
    
    await User.updateOne(
      { _id: req.user._id },
      { $push: { survey_ids: survey._id } }
    );
    
    res.json({
      success: true,
      message: "问卷创建成功",
      data: { survey }
    });
  } catch (err) {
    console.error("创建问卷错误:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;