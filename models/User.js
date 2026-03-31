// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: String,
  survey_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Survey"
  }],
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model("User", UserSchema);