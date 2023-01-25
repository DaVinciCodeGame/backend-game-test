const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: {
    type: Number,
    required: true,
  },

  sids: {
    type: String,
    required: true,
  },

  username: {
    type: String,
    required: true,
  },

  isReady: {
    type: Boolean,
    required: true,
  },

  isAlive: {
    type: Boolean,
    required: true,
  },

  hand: [{ color: String, value: Number, isOpen: String }],
});

module.exports = mongoose.model("user", userSchema);
