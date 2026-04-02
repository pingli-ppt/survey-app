const mongoose = require("mongoose");

const MONGODB_URI = "mongodb://127.0.0.1:27017/survey_db";

mongoose.connect(MONGODB_URI);

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB 连接成功");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB 连接失败:", err);
});

module.exports = mongoose;