const mongoose = require("mongoose");

const QuestionUsageSchema = new mongoose.Schema({
  versionId: {
    type: String,
    required: true,
    index: true
  },
  baseId: {
    type: String,
    required: true,
    index: true
  },
  surveyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Survey",
    required: true
  },
  
  responseCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

QuestionUsageSchema.index({ versionId: 1, surveyId: 1 }, { unique: true });
QuestionUsageSchema.index({ baseId: 1 });

module.exports = mongoose.model("QuestionUsage", QuestionUsageSchema);