const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ""
  },
  survey_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Survey"
  }]
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model("User", UserSchema);