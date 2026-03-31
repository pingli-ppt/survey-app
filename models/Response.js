// models/Response.js
const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
  questionId: String,
  type: String,
  value: mongoose.Schema.Types.Mixed
});

const ResponseSchema = new mongoose.Schema({
  surveyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Survey"
  },
  responseId: String,

  respondentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  respondentName: String,
  isAnonymous: Boolean,

  answers: [AnswerSchema],

  completedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Response", ResponseSchema);