// db.js
const mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/survey_db");

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected ✅");
});

module.exports = mongoose;
