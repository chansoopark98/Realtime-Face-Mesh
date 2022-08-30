const express = require('express');
const app = express();
const cors = require('cors');
const WebSocket = require('ws');

const fs = require('fs');
const options = {
    key: fs.readFileSync('../../ssl/privkey.pem', 'utf8'),
    cert: fs.readFileSync('../../ssl/cert.pem', 'utf8'),
    requestCert: false,
    rejectUnauthorized: false
};
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.use(cors());
console.log(__dirname);
app.use('/assets', express.static(__dirname + '/assets'));
app.use('/styles', express.static(__dirname + '/styles'));
app.use('/modules', express.static(__dirname + '/modules'));
// const server_port = 5555;
const server_port = 5503;
const server = require('https').createServer(options, app);
const wss = new WebSocket.Server({ server })

// app.set('view engine', 'ejs'); // 렌더링 엔진 모드를 ejs로 설정
// app.set('views',  __dirname + '/views');    // ejs이 있는 폴더를 지정

app.get('/', (req, res) => {
    res.render(__dirname + '/face_pose_main_page.html');    // index.ejs을 사용자에게 전달
})

app.get('/capture', (req, res) => {
  res.render(__dirname + '/capture.html');
})

server.listen(server_port, function() {
  console.log( 'Express server listening on port ' + server.address().port );
});

const GET_IMAGE_FLAG = '$$GETIMG';
const CAMERA_SERVER_FLAG = '$$CAM_SERVER';
const CLIENT_FLAG = '$$CLIENT';
const SEND_IMAGE_FLAG = '$$SENDIMG';
const clients = new Map();
let camServer = null;

wss.on('connection', (ws, req) => {
  const clientAddress = req.socket.remoteAddress;
  const clientPort = req.socket.remotePort;
  const clientId = `${clientAddress}:${clientPort}`;

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    console.log(data)

    if (data == CAMERA_SERVER_FLAG) {
      camServer = {ws, clientId};
    }
    else if (data == CLIENT_FLAG) {
      clients.set(ws, clientId);
    }
    else if (data == GET_IMAGE_FLAG) {
      camServer.ws.send(GET_IMAGE_FLAG);
    }
    else {
      [...clients.keys()].forEach((client) => {
        client.send(data);
      });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});