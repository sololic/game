// rpg-server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS 설정 (프론트엔드 URL에 맞게 수정해야 함)
// React 개발 서버 (vite/CRA)의 기본 포트 3000, 5173 등을 여기에 허용해야 합니다.
const io = new Server(server, {
  cors: {
origin: 'https://game-q152.vercel.app', 
        methods: ["GET", "POST"]
  }
});

// const io = new Server(server, {
//   cors: {
// origin: 'https://game-production-48c8.up.railway.app', 
//         methods: ["GET", "POST"]
//   }
// });

// const PORT = 3456; // 서버 포트

// --------------------
// 1. 임시 데이터베이스 (실제 데이터베이스로 대체 필요)
// --------------------
const playerSaves = {}; // { userId: { level: 1, ... } }
const duelQueue = []; // 대결 대기열

// --------------------
// 2. HTTP (API) 라우트 설정
// --------------------
app.use(express.json());

// 임시 저장 API (간단한 POST 요청)
app.post('/api/save/:userId', (req, res) => {
    const userId = req.params.userId;
    const data = req.body.player; 
    playerSaves[userId] = data;
    console.log(`[API] 유저 ${userId} 데이터 저장됨.`);
    res.status(200).send({ message: 'Save successful' });
});

// 임시 불러오기 API
app.get('/api/load/:userId', (req, res) => {
    const userId = req.params.userId;
    const data = playerSaves[userId];
    if (data) {
        console.log(`[API] 유저 ${userId} 데이터 불러옴.`);
        res.status(200).json({ player: data });
    } else {
        console.log(`[API] 유저 ${userId} 저장 데이터 없음.`);
        res.status(404).send({ message: 'No save data found' });
    }
});


// --------------------
// 3. WebSocket (Socket.io) 설정
// --------------------

// 클라이언트가 연결되면 실행
io.on('connection', (socket) => {
    console.log(`[SOCKET] 새로운 클라이언트 연결: ${socket.id}`);
    let currentUserId = null; // 이 소켓에 연결된 유저 ID

    // 1. 유저 인증/등록 이벤트 (로그인 시 호출)
    socket.on('registerUser', (userId) => {
        currentUserId = userId;
        socket.join(userId); // 유저 ID로 된 개인 방 생성
        console.log(`[SOCKET] ${socket.id}를 유저 ${userId}로 등록.`);
    });

    // 2. 듀얼 찾기/대기 이벤트
    socket.on('searchForDuel', () => {
        if (!currentUserId) return socket.emit('error', 'User not registered');
        if (duelQueue.includes(currentUserId)) return;

        duelQueue.push(currentUserId);
        console.log(`[DUEL] 유저 ${currentUserId} 대기열에 추가. 현재 대기열: ${duelQueue}`);

        // 매칭 시도
        if (duelQueue.length >= 2) {
            const player1Id = duelQueue.shift();
            const player2Id = duelQueue.shift();
            
            // 실제 데이터는 DB에서 로드해야 하지만, 여기서는 임시 데이터 사용
            const player1Data = { id: player1Id, name: `용사 ${player1Id.slice(-1)}`, level: 10, hp: 150 };
            const player2Data = { id: player2Id, name: `경쟁자 ${player2Id.slice(-1)}`, level: 10, hp: 150 };

            const duelRoom = `duel_${Date.now()}`;
            io.to(player1Id).emit('matchFound', { room: duelRoom, opponent: player2Data, isFirstPlayer: true });
            io.to(player2Id).emit('matchFound', { room: duelRoom, opponent: player1Data, isFirstPlayer: false });
            
            console.log(`[DUEL] ${player1Id}와 ${player2Id} 매칭 완료. 방: ${duelRoom}`);
        } else {
             io.to(currentUserId).emit('duelStatus', { message: '상대방을 기다리는 중...' });
        }
    });

    // 3. 듀얼 액션 이벤트 (공격, 스킬 사용 등)
    socket.on('duelAction', (data) => {
        // 🚨 이 곳에서 턴 체크, 유효성 검사, 데미지 계산, 상대방에게 결과 전송 등의 복잡한 로직이 실행됩니다.
        console.log(`[DUEL ACTION] ${data.userId}의 액션: ${data.action}`);
        // 예시: 상대방에게 공격 결과를 전달
        // io.to(data.opponentId).emit('opponentAction', { damage: data.damage, log: data.log });
    });

    // 연결 종료
    socket.on('disconnect', () => {
        console.log(`[SOCKET] 클라이언트 연결 해제: ${socket.id}`);
        // 대기열에서 제거
        const index = duelQueue.indexOf(currentUserId);
        if (index > -1) {
            duelQueue.splice(index, 1);
            console.log(`[DUEL] ${currentUserId} 대기열에서 제거됨.`);
        }
        // 듀얼 중이었다면 상대방에게 연결 끊김 알림
    });
});

// --------------------
// 4. 서버 시작
// --------------------
// 환경 변수에서 포트 번호를 가져옵니다. (Railway는 PORT 환경 변수를 사용)
const PORT = process.env.PORT || 3456; 
// 0.0.0.0은 모든 IP에서 접근을 허용한다는 의미입니다.
const HOST = '0.0.0.0'; 

server.listen(PORT, HOST, () => {
    // 로그 메시지도 HOST를 사용하도록 변경합니다.
    console.log(`✅ 서버가 http://${HOST}:${PORT} 에서 실행 중입니다.`);
});