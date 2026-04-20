const mongoose = require("mongoose");
const Survey = require("../models/Survey");
const QuestionBank = require("../models/QuestionBank");
const QuestionVersion = require("../models/QuestionVersion");
const QuestionUsage = require("../models/QuestionUsage");

async function migrate() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/survey_db");
    console.log("✅ 数据库已连接");
    
    const surveys = await Survey.find({});
    console.log(`找到 ${surveys.length} 个问卷需要迁移`);
    
    let questionCount = 0;
    let versionCount = 0;
    
    for (const survey of surveys) {
      console.log(`处理问卷: ${survey.title}`);
      
      for (let i = 0; i < survey.questions.length; i++) {
        const oldQ = survey.questions[i];
        
        // 检查是否已迁移（通过内容匹配）
        let existingQuestion = await QuestionBank.findOne({
          ownerId: survey.creatorId,
          // 通过标题和类型匹配
        });
        
        // 简化：为每个旧题目创建新题目
        const baseId = QuestionBank.generateBaseId();
        const versionId = `${baseId}_v1`;
        
        // 创建题目库
        const questionBank = new QuestionBank({
          baseId,
          ownerId: survey.creatorId,
          currentVersion: 1,
          isPublic: false
        });
        await questionBank.save();
        
        // 创建版本
        const questionVersion = new QuestionVersion({
          versionId,
          baseId,
          version: 1,
          parentVersionId: null,
          title: oldQ.title,
          type: oldQ.type,
          config: oldQ.config || {},
          changeNote: "从旧问卷迁移",
          createdBy: survey.creatorId,
          createdAt: survey.createdAt
        });
        await questionVersion.save();
        
        // 更新问卷中的题目引用
        survey.questions[i].questionBankId = baseId;
        survey.questions[i].versionId = versionId;
        
        // 创建使用记录
        await QuestionUsage.updateOne(
          { versionId, surveyId: survey._id },
          { 
            $setOnInsert: { versionId, baseId, surveyId: survey._id },
            $set: { lastUsedAt: new Date() }
          },
          { upsert: true }
        );
        
        questionCount++;
        versionCount++;
      }
      
      // 保存更新后的问卷
      await survey.save();
      console.log(`  迁移了 ${survey.questions.length} 道题目`);
    }
    
    console.log(`\n✅ 迁移完成！`);
    console.log(`   - 迁移问卷数: ${surveys.length}`);
    console.log(`   - 迁移题目数: ${questionCount}`);
    console.log(`   - 创建版本数: ${versionCount}`);
    
    process.exit(0);
  } catch (err) {
    console.error("❌ 迁移失败:", err);
    process.exit(1);
  }
}

migrate();