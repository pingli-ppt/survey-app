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
  respondentName: String,
  isAnonymous: {
    type: Boolean,
    default: false
  },
  answers: [AnswerSchema],
  ipAddress: String,
  userAgent: String
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model("Response", ResponseSchema);