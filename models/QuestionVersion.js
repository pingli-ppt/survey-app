const mongoose = require("mongoose");

const QuestionVersionSchema = new mongoose.Schema({
  versionId: {
    type: String,
    unique: true,
    required: true
  },
  baseId: {
    type: String,
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true
  },
  parentVersionId: {
    type: String,
    default: null
  },
  
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["single_choice", "multi_choice", "text", "number"],
    required: true
  },
  config: {
    type: Object,
    default: {}
  },
  
  changeNote: {
    type: String,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

QuestionVersionSchema.index({ baseId: 1, version: -1 });

QuestionVersionSchema.statics.generateVersionId = function(baseId, version) {
  return `${baseId}_v${version}`;
};

module.exports = mongoose.model("QuestionVersion", QuestionVersionSchema);