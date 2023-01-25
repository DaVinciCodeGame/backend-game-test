const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./users")

const app = express();
dotenv.config();

mongoose.set("strictQuery", false);

//DB settings
mongoose.connect(process.env.DAVINCICODEDB);
var DB = mongoose.connection;

DB.once("open", function () {
  console.log("DB connected");
});

DB.on("error", function (err) {
  console.log("DB ERROR: ", err);
});

const me = new User({
  userId: 2,

  sids: "sids-connect-test",

  username: "haha",

  isReady: false,

  isAlive: true,

  hand: [],

});

me.save()
  .then(() => {
    console.log(me);
  })
  .catch((err) => {
    console.log("Error : " + err);
  });

app.listen(3000, function () {
  console.log("server on! https://localhost:3000");
});
