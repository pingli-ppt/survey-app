// models/Survey.js
const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  questionId: String,
  type: String,
  required: Boolean,
  config: {
    options: [
      {
        value: String,
        label: String
      }
    ],
    minSelect: Number,
    maxSelect: Number,
    minLength: Number,
    maxLength: Number,
    minValue: Number,
    maxValue: Number,
    integerOnly: Boolean
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  logic: [
    {
      sourceQuestionId: String,
      conditions: [
        {
          type: String,
          optionValue: String,
          operator: String,
          value: Number
        }
      ],
      operator: String,
      targetQuestionId: String,
      priority: Number
    }
  ]
});

const SurveySchema = new mongoose.Schema({
  surveyId: {
    type: String,
    unique: true
  },
  title: String,
  description: String,
  allow_multiple_submit: Boolean,

  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  status: String,
  allowAnonymous: Boolean,
  deadline: Date,
  publishedAt: Date,

  questions: [QuestionSchema]

}, {
  timestamps: true
});

module.exports = mongoose.model("Survey", SurveySchema);