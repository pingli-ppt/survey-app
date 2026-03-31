const mongoose = require("./db");

const User = require("./models/User");
const Survey = require("./models/Survey");
const Response = require("./models/Response");

async function test() {
  try {

    // 等待数据库连接（关键！）
    await mongoose.connection.asPromise();

    console.log("开始测试...");

    // 👇 后面写测试逻辑

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
  }
}

test();