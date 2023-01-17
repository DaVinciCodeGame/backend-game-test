const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("redis");
const { log } = require("console");
const e = require("express");

dotenv.config();
app.use(cors());

//redis 기본 정리 및 연결 시작
const client = createClient({
  url: process.env.REDIS_HOST,
});
const connectClient = async () => {
  return await client.connect();
};

connectClient()
  .then(async () => {
    await client.set("resdi", "연결 test");
  })
  .catch((err) => {
    console.log(err.message);
  });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    method: ["GET", "POST"],
  },
});

const users = {};
const socketToRoom = {};

const data = [];
let whiteCard = 0;
let sampleData = [
  {
    roomId: 3,
    blackCardList: [null, 1, 1, 1, 2, 2, 2, null, null, null, null, null, null],
    whiteCardList: [null, 4, 4, 4, 3, 3, 3, null, null, null, null, null, null],
    roomData: [
      {
        userId: 4,
        gameSids: "12D73jwD0ioJeJLGAAAD",
        cards: [
          { color: "white", value: 1 },
          { color: "white", value: 2 },
          { color: "white", value: 3 },
        ],
      },
      {
        userId: 1,
        gameSids: "12D73jwD0ioJeJLGAAAC",
        cards: [
          { color: "black", value: 1 },
          { color: "black", value: 2 },
          { color: "black", value: 3 },
        ],
      },
      {
        userId: 2,
        gameSids: "12D73jwD0ioJeJLGAYFE",
        cards: [
          { color: "black", value: 4 },
          { color: "black", value: 5 },
          { color: "black", value: 6 },
        ],
      },
      {
        userId: 3,
        gameSids: "12D73jwD0ioJeJLGAAAD",
        cards: [
          { color: "white", value: 4 },
          { color: "white", value: 5 },
          { color: "white", value: 6 },
        ],
      },
    ],
  },
];

let countBlack = 0;
let countWhite = 0;
let gamingUser = [];

io.on("connection", (socket) => {
  socket.onAny(async (e) => {
    console.log(`SocketEvent:${e}`);
  });

  socket.on("send_message", (data, addMyMessage) => {
    socket.to(data.room).emit("receive_message", data.msg);
    addMyMessage(data.msg);
  });

  socket.on("join_room", ({ roomId, userId, people }, gameStartFn) => {
    socket["userId"] = userId;

    socket.join(roomId);

    if (data.find((el) => el.roomId === roomId)) {
      data.map((el) => {
        if (el.roomId === roomId) {
          el.roomData.push({ userId, gameSids: socket.id });
        }
      });
    } else {
      data.push({
        roomId,
        blackCardList: new Array(13).fill(null),
        whiteCardList: new Array(13).fill(null),
        roomData: [{ userId, gameSids: socket.id }],
      });
    }

    data.map((el) => {
      if (el.roomData.length === people) {
        socket.to(roomId).emit("gameStart", "gameStart");
        gameStartFn();
      }
    });
  });

  socket.on("getPlace", ({ roomId, userId, people }, fn) => {
    data.map((el) => {
      if (el.roomId == roomId && el.roomData.length === people) {
        let count = 0;
        let userTemp = [];

        for (let i = 0; i < people; i++) {
          if (el.roomData[i].userId === userId) {
            for (let j = 2; j < people; j = (j + 1) % people) {
              userTemp.push(el.roomData[j]);
              count++;
              if (count === people) {
                break;
              }
            }
            if (count === people) {
              break;
            }
          }
        }

        el.roomData = userTemp;
        fn(data);
      }
    });
  });

  socket.on("nickName", (nickName) => {
    socket["nickName"] = nickName;
  });

  socket.on("whisper", (nickName, msg, addMyMessage) => {
    const targetSoc = [...io.sockets.sockets];
    const target = targetSoc.filter((el) => el[1].nickName === nickName);
    if (target[0][0]) socket.to(target[0][0]).emit("receive_message", msg);
    addMyMessage(msg);
  });

  socket.on("joinRtcRoom", (roomID) => {
    if (users[roomID]) {
      const length = users[roomID].length;
      if (length === 4) {
        socket.emit("room full");
        return;
      }
      users[roomID].push(socket.id);
    } else {
      users[roomID] = [socket.id];
    }
    socketToRoom[socket.id] = roomID;
    const usersInThisRoom = users[roomID].filter((id) => id !== socket.id);

    socket.emit("all users", usersInThisRoom);
  });

  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });
  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("disconnect-signal", () => {
    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter((id) => id !== socket.id);
      users[roomID] = room;
    }
  });

  socket.on("gameStart", (roomId, userId) => {
    socket["userId"] = socket.id;
  });

  socket.on("selectFirstCard", ({ userId, black, roomId }, addMyCard) => {
    const whiteCard = 3 - black;

    let count = 0;
    let arr1 = [];
    let flag = 0;

    for (let j = 0; j < data.length; j++) {
      if (data[j].roomId === roomId) {
        flag = j;
        break;
      }
    }

    for (let i = 0; count < black; i++) {
      const number = Math.floor(Math.random() * 12);

      if (data[flag].blackCardList[number] === null) {
        data[flag].blackCardList[number] = userId;
        arr1 = [...arr1, { color: "black", value: number }];
        count++;
      }
    }

    count = 0;
    for (let i = 0; count < whiteCard; i++) {
      number = Math.floor(Math.random() * 12);

      if (data[flag].whiteCardList[number] === null) {
        data[flag].whiteCardList[number] = userId;
        arr1 = [...arr1, { color: "white", value: number }];
        count++;
      }
    }

    countBlack = 0;
    countWhite = 0;
    for (let i = 0; i < data[flag].blackCardList.length; i++) {
      if (data[flag].blackCardList[i] !== null) {
        countBlack++;
      }

      if (data[flag].whiteCardList[i] !== null) {
        countWhite++;
      }
    }
    socket["card"] = arr1;

    socket.card
      .sort((a, b) => a.value - b.value)
      .sort((a, b) => {
        if (a.value === b.value) {
          if (a.color < b.color) return -1;
          else if (b.color < a.color) return 1;
          else return 0;
        }
      });

    const userIdAndCard = { userId, cards: socket.card };

    for (let i = 0; i < data.length; i++) {
      //오류난 부분 체크필요 ㄱ
      if (data[flag].roomData[i].userId == userId) {
        data[flag].roomData[i].cards = socket.card;
        break;
      }
    }

    if (data[flag].roomData.length === 4) {
      socket
        .to(roomId)
        .emit("allUsersFirstCard", data, { countBlack, countWhite });
    }
  });

  socket.on("selectCard", (roomId, userId, black) => {
    for (let j = 0; j < data.length; j++) {
      if (data[j].roomId === roomId) {
        flag = j;
        break;
      }
    }
    if (black) {
      let count = 0;
      let arr1 = [];
      for (let i = 0; count < 1; i++) {
        const number = Math.floor(Math.random() * 13);
        if (data[flag].blackCardList[number] === null) {
          data[flag].blackCardList[number] = userId;

          count++;
        }
      }
    } else {
      count = 0;
      for (let i = 0; count < 1; i++) {
        number = Math.floor(Math.random() * 13);

        if (data[flag].whiteCardList[number] === null) {
          data[flag].whiteCardList[number] = userId;

          count++;
        }
      }
    }
  });

  socket.on("selectUser", (userId, getCard) => {
    for (i = 0; i < gamingUser.length; i++) {
      if (gamingUser[i].userId == userId) {
        getCard(gamingUser[i]);
        break;
      }
    }
  });
});

server.listen(3001, () => {
  console.log("Server is Listening");
});
