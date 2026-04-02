const mongoose = require("mongoose");

// 题目配置结构
const QuestionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ""
  },
  type: {
    type: String,
    enum: ["single_choice", "multi_choice", "text", "number"],
    required: true
  },
  required: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  config: {
    options: [{
      value: String,
      label: String
    }],
    minSelect: Number,
    maxSelect: Number,
    minLength: Number,
    maxLength: Number,
    minValue: Number,
    maxValue: Number,
    integerOnly: Boolean
  },
  logic: [{
    conditions: [{
      type: {
        type: String, 
      },
      optionValue: String,
      optionValues: [String],
      operator: String,  // equals, contains, range
      min: Number,
      max: Number
    }],
    targetQuestionId: String,
    priority: Number
  }]
});

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
  description: String,
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
  deadline: Date,
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  questions: [QuestionSchema]
}, {
  timestamps: true
});

// 生成唯一 surveyId
SurveySchema.statics.generateSurveyId = function() {
  return `SURVEY_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
};

module.exports = mongoose.model("Survey", SurveySchema);