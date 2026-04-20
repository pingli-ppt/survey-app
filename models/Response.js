const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  value: mongoose.Schema.Types.Mixed
});

const ResponseSchema = new mongoose.Schema({
  surveyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Survey",
    required: true
  },
  responseId: {
    type: String,
    unique: true,
    default: () => `RES_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  },
  respondentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  respondentName: {
    type: String,
    default: ""
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  answers: [AnswerSchema],
  ipAddress: {
    type: String,
    default: ""
  },
  userAgent: {
    type: String,
    default: ""
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

ResponseSchema.index({ surveyId: 1 });
ResponseSchema.index({ "answers.questionId": 1 });

module.exports = mongoose.model("Response", ResponseSchema);