const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("redis");
const { log } = require("console");

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

let userCount = 0;
let readyCount = 0;

io.on("connection", async (socket) => {
  console.log("connect", socket.id);
  socket.onAny(async (e) => {
    console.log(`SocketEvent:${e}`);
  });

  socket.on("you-joined", async ({ userId, roomId }) => {
    socket["userId"] = userId;
    userCount = (userCount + 1) % 4;
    console.log("유저 입장", userCount, ":::::", socket.id);

    await client.hSet(`rooms:${roomId}:users:${socket.userId}`, {
      userId: socket.userId,
    });
    await client.hSet(`rooms:${roomId}:users:${socket.userId}`, {
      socketId: socket.id,
    });
    await client.hSet(`rooms:${roomId}:users:${socket.userId}`, {
      username: userCount,
    });
    await client.hSet(`rooms:${roomId}:users:${socket.userId}`, {
      isReady: "false",
    });
    await client.hSet(`rooms:${roomId}:users:${socket.userId}`, {
      yourSeat: userCount,
    });
    const roomInfo = await client.hGetAll(
      `rooms:${roomId}:users:${socket.userId}`
    );
    console.log(roomInfo);
  });

  socket.on("ready", async ({ userId, roomId }) => {
    // FIXME: 변수 -> redis.lenth로 변경 필요
    const userInfo = await client.hGetAll(
      `rooms:${roomId}:users:${socket.userId}`
    );

    if (userInfo.isReady === "false") {
      await client.hSet(`rooms:${roomId}:users:${socket.userId}`, {
        isReady: "true",
      });

      readyCount = readyCount + 1;
      await client.hSet(`rooms:${roomId}`, { ready: readyCount });
      const ready = await client.hGetAll(`rooms:${roomId}`);

      if (readyCount > 3) {
        // room 초기화
        // 명령어를 못찾는 이유
        for (let i = 0; i < 13; i++) {
          await client.hSet(`rooms:${roomId}:table:black`, {
            color: "black",
            value: `${i}`,
            isOpened: "false",
          });

          await client.hSet(`rooms:${roomId}:table:white`, {
            color: "white",
            value: `${i}`,
            isOpened: "false",
          });
        }

        io.to(roomId).emit("game-start");
      }
    } else {
      await client.hSet(`rooms:${roomId}:users:${socket.userId}`, {
        isReady: "false",
      });

      readyCount = readyCount - 1;
      await client.hSet(`rooms:${roomId}`, { ready: readyCount });
      const ready = await client.hGetAll(`rooms:${roomId}`);
      console.log(ready);
    }
  });

  socket.on("first-draw", async ({ userId, black, roomId }) => {
    const whiteCard = 3 - black;

    console.log("socket ids:", socket.id);
    const tableWhiteCard = await client.hGetAll(`rooms:${roomId}:table:white`);
    console.log("tableWhiteCard test console :::", tableWhiteCard);

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

  socket.on("send_message", (msg, room, addMyMessage) => {
    console.log(msg);
    console.log(room);

    socket.to(room).emit("receive_message", msg);
    addMyMessage(msg);
  });

  socket.on("joined", (roomID) => {
    socket.join(roomID);
    // if (users[roomID]) {
    //   const length = users[roomID].length;
    //   if (length === 4) {
    //     socket.emit("room full");
    //     return;
    //   }
    //   users[roomID].push(socket.id);
    // } else {
    //   users[roomID] = [socket.id];
    // }
    // socketToRoom[socket.id] = roomID;
    // const usersInThisRoom = users[roomID].filter((id) => id !== socket.id);

    // socket.emit("all users", usersInThisRoom);
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
