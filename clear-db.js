// clear-db.js
const mongoose = require("mongoose");

async function clearDB() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/survey_db");
    console.log("✅ 已连接到数据库");
    
    // 删除 surveys 集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    const hasSurveys = collections.some(c => c.name === 'surveys');
    
    if (hasSurveys) {
      await mongoose.connection.db.dropCollection('surveys');
      console.log("✅ surveys 集合已删除");
    } else {
      console.log("⚠️ surveys 集合不存在");
    }
    
    console.log("✅ 数据库清理完成");
  } catch (err) {
    console.error("❌ 错误:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("数据库连接已关闭");
  }
}

clearDB();