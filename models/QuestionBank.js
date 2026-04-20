const mongoose = require("mongoose");

const QuestionBankSchema = new mongoose.Schema({
  baseId: {
    type: String,
    unique: true,
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  currentVersion: {
    type: Number,
    default: 1
  },
  
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  
  usageCount: {
    type: Number,
    default: 0
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

QuestionBankSchema.index({ ownerId: 1, isPublic: 1 });
QuestionBankSchema.index({ sharedWith: 1 });

QuestionBankSchema.statics.generateBaseId = function() {
  return `QB_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
};

module.exports = mongoose.model("QuestionBank", QuestionBankSchema);