const mongoose = require("mongoose");

// 问卷中的题目关联结构
const SurveyQuestionSchema = new mongoose.Schema({
  questionBankId: {
    type: String,
    required: true
  },
  versionId: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  logic: {
    type: Object,
    default: null
  }
}, { _id: false });

const SurveySchema = new mongoose.Schema({
  surveyId: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  allowAnonymous: {
    type: Boolean,
    default: false
  },
  allowMultipleSubmit: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ["draft", "published", "closed"],
    default: "draft"
  },
  deadline: {
    type: Date,
    default: null
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  questions: [SurveyQuestionSchema]
}, {
  timestamps: true
});

SurveySchema.statics.generateSurveyId = function() {
  return `SURVEY_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
};

module.exports = mongoose.model("Survey", SurveySchema);