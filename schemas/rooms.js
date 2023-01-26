const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomId: {
    type: Number,
    required: true,
  },

  turn: {
    type: Number,
    required: true,
  },

  table: {
    blackCards: [Number],
    whiteCards: [Number],
    users: [Number],
  },

  users: [
    {
      userId: Number,
      sids: Number,
      username: String,
      isReady: Boolean,
      isAlive: Boolean,
      hand: [{ color: String, value: Number, isOpen: Boolean }], // [ {color: black, value: 3 , isOpen: true}, {color: black, value: 3 , isOpen: true}, {color: black, value: 3 , isOpen: true} ]
    },
  ],
});

module.exports = mongoose.model("room", roomSchema);
