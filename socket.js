const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("redis");
const { log } = require("console");
const { type } = require("os");
const connect = require("./schemas");
connect();

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

let DB = [
  {
    roomId: 0,
    turn: 0,
    table: {
      blackCards: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      whiteCards: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      users: [], //[{userId:1}, {userId:4}, {userId:3}, {userId:2}]
    },

    users: [
      {
        userId: 0,
        sids: 0,
        username: 0,
        isReady: false,
        isAlive: true,
        hand: [], // [ {color: black, value: 3 , isOpen: true}, {color: black, value: 3 , isOpen: true}, {color: black, value: 3 , isOpen: true} ]
      },
    ],
  },
];

io.on("connection", async (socket) => {
  console.log("connect", socket.id);
  socket.onAny(async (e) => {
    console.log(`SocketEvent:${e}`);
  });

  socket.on("send-message", (msg, room, addMyMessage) => {
    console.log(msg);
    console.log(room);
    // 소켓 아이디에 맞는 닉네임을 뽑아서 msg와 같이 전송

    socket.to(room).emit("receive-message", msg);
    addMyMessage(msg);
  });

  socket.on("connect", (userId) => {
    //DB room 돌면서 userId 있는지 확인하고 삭제
  });

  socket.on("you-joined", async ({ userID, roomID }) => {
    
    userCount = (userCount + 1) % 4;
    console.log("유저 입장", userCount, ":::::", socket.id);

    await client.hSet(`rooms:${roomID}:users:${socket.userID}`, {
      userID: socket.userID,
    });
    await client.hSet(`rooms:${roomID}:users:${socket.userID}`, {
      socketId: socket.id,
    });
    await client.hSet(`rooms:${roomID}:users:${socket.userID}`, {
      username: userCount,
    });
    await client.hSet(`rooms:${roomID}:users:${socket.userID}`, {
      isReady: "false",
    });
    await client.hSet(`rooms:${roomID}:users:${socket.userID}`, {
      yourSeat: userCount,
    });
    const roomInfo = await client.hGetAll(
      `rooms:${roomID}:users:${socket.userID}`
    );
    console.log(roomInfo);
  });

  socket.on("ready", async ({ userID, roomID }) => {
    // FIXME: 변수 -> redis.lenth로 변경 필요
    const userInfo = await client.hGetAll(
      `rooms:${roomID}:users:${socket.userID}`
    );

    console.log("userID:", userID, typeof userID);
    console.log("roomID:", roomID, typeof roomID);

    await client.hSet(`rooms:${roomID}:users:${socket.userID}`, {
      isReady: userInfo.isReady === "false" ? "true" : "false",
    });

    if (userInfo.isReady === "false") {
      //{userId:userId}
      // `userId`
      const some = userID;
      await client.hSet(`rooms:${roomID}`, { [userID]: some });
      const test2 = await client.hGetAll(`rooms:${roomID}`);
      console.log("추가", test2);

      let userLength = await client.hLen(`rooms:${roomID}`);
      userLength = 2;

      if (userLength == 2) {
        console.log("test");
        // 유저 별로 socket.Id 찾아서 뿌려주기.
        io.to(socket.id).emit("game-start");
      }
    } else {
      await client.hDel(`rooms:${roomID}`, `${userID}`);

      const test2 = await client.hGetAll(`rooms:${roomID}`);
      console.log("삭제", test2);
    }
  });

  socket.on("first-draw", async (userId, black, roomId, myCard) => {
    // fn (본인 카드 & 잔여 카드 )
    // socket.to(roomId).emit("all-users-cards", [사람들 카드 + 잔여 카드])
    const white = 3 - black;

    let getCards = [];
    let roomIndex = 0;
    let uesrIndex = 0;

    for (let j = 0; j < DB.length; j++) {
      if (DB[j].roomId === roomId) {
        roomIndex = j;
        break;
      }
    }

    for (let i = 0; i < black; i++) {
      let cardLength = DB[roomIndex].table.blackCards.length;
      let CardIndex = Math.floor(Math.random() * Number(cardLength));
      let randomCard = DB[roomIndex].table.blackCards[CardIndex];
      getCards = [
        ...getCards,
        { color: "black", value: Number(randomCard), isOpen: false },
      ];
      DB[roomIndex].table.blackCards.splice(CardIndex, 1);
    }

    for (let i = 0; i < white; i++) {
      let cardLength = DB[roomIndex].table.whiteCards.length;
      let CardIndex = Math.floor(Math.random() * Number(cardLength));
      let randomCard = DB[roomIndex].table.whiteCards[CardIndex];
      getCards = [
        ...getCards,
        { color: "white", value: Number(randomCard), isOpen: false },
      ];
      DB[roomIndex].table.whiteCards.splice(CardIndex, 1);
    }

    getCards
      .sort((a, b) => a.value - b.value)
      .sort((a, b) => {
        if (a.value === b.value) {
          if (a.color < b.color) return -1;
          else if (b.color < a.color) return 1;
          else return 0;
        }
      });

    for (let i = 0; i < 4; i++) {
      if (DB[roomIndex].users[i].userId === userId) {
        uesrIndex = i;
        break;
      }
    }
    DB[roomIndex].users[uesrIndex].hand = getCards;
    myCard(getCards);

    // FIXME 나머지 사람들의 카드 보내주기
    let sendAllData = {};

  // TODO: 뽑을 카드가 없다.
    if(DB.table.blackCards.length === 0 && DB.table.whiteCards.length === 0){
      const turn = DB[flag].turn;

      socket.to(socket.data.roomId).emit("no-cards-to-draw", "SELECT_CARD_AS_SECURITY", turn)
    }

    
    // TODO: 뽑을 카드가 있는가?
    // TODO: 양쪽 색이 다 있는가 ? -> client 색 정하기 socket.to(roomId).emit("select-color", )
    // TODO: 뽑힌 카드가 조커인가? 숫자인가?
    // TODO: 각 요청마다 현재 게임을 진행중인 사람의 턴 첨부
    
    // const userIdAndCard = { userId, cards: socket.card };

    // for (let i = 0; i < data.length; i++) {
    //   //오류난 부분 체크필요 ㄱ
    //   if (data[flag].roomData[i].userId == userId) {
    //     data[flag].roomData[i].cards = socket.card;
    //     break;
    //   }
    // }

    // if (data[flag].roomData.length === 4) {
    //   socket
    //     .to(roomId)
    //     .emit("allUsersFirstCard", data, { countBlack, countWhite });
    // }
  });

  socket.on("select-card-as-security",(userId, color, value) => {
    socket.data.security= {color:color, value:value};
    io.to(socket.Id).emit("select-target")
  })

  socket.on("join", (roomId) => {
    console.log(roomId);
    socket.join(roomId);
    socket.data.roomId = roomId
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

  // socket.on("selectFirstCard", ({ userId, black, roomId }, addMyCard) => {
  //   const whiteCard = 3 - black;

  //   let count = 0;
  //   let getCards = [];
  //   let flag = 0;

  //   for (let j = 0; j < DB.length; j++) {
  //     if (DB[j].roomId === roomId) {
  //       flag = j;
  //       break;
  //     }
  //   }

  //   for(let i=0; count < black; i++){
  //     const cardLength = DB[j].table.blackCards.length
  //     const randomCard =  Math.floor(Math.random() * cardLength);
  //     getCards = [...getCards, { color: "black", value: randomCard }];

  //   }

  //   for (let i = 0; count < black; i++) {
  //     const number = Math.floor(Math.random() * 12);

  //     if (data[flag].blackCardList[number] === null) {
  //       data[flag].blackCardList[number] = userId;
  //       arr1 = [...arr1, { color: "black", value: number }];
  //       count++;
  //     }
  //   }

  //   count = 0;
  //   for (let i = 0; count < whiteCard; i++) {
  //     number = Math.floor(Math.random() * 12);

  //     if (data[flag].whiteCardList[number] === null) {
  //       data[flag].whiteCardList[number] = userId;
  //       arr1 = [...arr1, { color: "white", value: number }];
  //       count++;
  //     }
  //   }

  //   countBlack = 0;
  //   countWhite = 0;
  //   for (let i = 0; i < data[flag].blackCardList.length; i++) {
  //     if (data[flag].blackCardList[i] !== null) {
  //       countBlack++;
  //     }

  //     if (data[flag].whiteCardList[i] !== null) {
  //       countWhite++;
  //     }
  //   }
  //   socket["card"] = arr1;

  //   socket.card
  //     .sort((a, b) => a.value - b.value)
  //     .sort((a, b) => {
  //       if (a.value === b.value) {
  //         if (a.color < b.color) return -1;
  //         else if (b.color < a.color) return 1;
  //         else return 0;
  //       }
  //     });

  //   const userIdAndCard = { userId, cards: socket.card };

  //   for (let i = 0; i < data.length; i++) {
  //     // FIXME: error
  //     if (data[flag].roomData[i].userId == userId) {
  //       data[flag].roomData[i].cards = socket.card;
  //       break;
  //     }
  //   }

  //   if (data[flag].roomData.length === 4) {
  //     socket
  //       .to(roomId)
  //       .emit("allUsersFirstCard", data, { countBlack, countWhite });
  //   }
  // });

  // socket.on("selectCard", (roomId, userId, black) => {
  //   for (let j = 0; j < data.length; j++) {
  //     if (data[j].roomId === roomId) {
  //       flag = j;
  //       break;
  //     }
  //   }
  //   if (black) {
  //     let count = 0;
  //     let arr1 = [];
  //     for (let i = 0; count < 1; i++) {
  //       const number = Math.floor(Math.random() * 13);
  //       if (data[flag].blackCardList[number] === null) {
  //         data[flag].blackCardList[number] = userId;

  //         count++;
  //       }
  //     }
  //   } else {
  //     count = 0;
  //     for (let i = 0; count < 1; i++) {
  //       number = Math.floor(Math.random() * 13);

  //       if (data[flag].whiteCardList[number] === null) {
  //         data[flag].whiteCardList[number] = userId;

  //         count++;
  //       }
  //     }
  //   }
  // });

  // socket.on("selectUser", (userId, getCard) => {
  //   for (i = 0; i < gamingUser.length; i++) {
  //     if (gamingUser[i].userId == userId) {
  //       getCard(gamingUser[i]);
  //       break;
  //     }
  //   }
  // });
});

server.listen(3001, () => {
  console.log("Server is Listening");
});
