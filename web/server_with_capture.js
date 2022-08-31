const express = require('express');
const app = express();
const cors = require('cors');
const WebSocket = require('ws');
const fs = require('fs');

const options = {
    key: fs.readFileSync('../ar.tsp-xr.com-key.pem', 'utf8'),
    cert: fs.readFileSync('../ar.tsp-xr.com-crt.pem', 'utf8'),
    passphrase: 'tsp190910',
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

app.get('/', (req, res) => {
    res.render(__dirname + '/face_pose_main_page.html');    // index.ejs을 사용자에게 전달
})

app.get('/capture', (req, res) => {
res.render(__dirname + '/capture.html');
})

server.listen(server_port, function() {
console.log( 'Express server listening on port ' + server.address().port );
});

const wss = new WebSocket.Server({ server })

const GET_IMAGE_FLAG = '$$GETIMG';
const CAMERA_SERVER_FLAG = '$$CAM_SERVER';
const CLIENT_FLAG = '$$CLIENT';
const SEND_IMAGE_FLAG = '$$SENDIMG';
const COFFEE_NUM_FLAG = '$$COFFEE';
const CHANGE_FRAME_FLAG = '$$FRAME';
const CHANGE_MODEL_FLAG = '$$CHANGE_MODEL';

let coffeeJson = fs.readFileSync('./coffee.json', 'utf8');
coffeeJson = JSON.parse(coffeeJson);

console.log(`Coffee : ${coffeeJson.num}`)

const clients = new Map();
let camServer = null;

wss.on('connection', (ws, req) => {
    const clientAddress = req.socket.remoteAddress;
    const clientPort = req.socket.remotePort;
    const clientId = `${clientAddress}:${clientPort}`;

    ws.on('message', (msg) => {
        const jsonData = JSON.parse(msg);

        switch(jsonData.flag) {
            case CAMERA_SERVER_FLAG:
                camServer = {ws, clientId};
                console.log(`CamServer : ${clientId}`);
                break;
            case CLIENT_FLAG:
                clients.set(ws, clientId);
                console.log(`Client : ${clientId}`);
                break;
            case GET_IMAGE_FLAG:
                camServer.ws.send(JSON.stringify({
                    'flag' : GET_IMAGE_FLAG,
                    'num' : coffeeJson.num
                }));
                break;
            case CHANGE_FRAME_FLAG:
                camServer.ws.send(JSON.stringify({
                    'flag' : CHANGE_FRAME_FLAG
                }));
                break;
            case CHANGE_MODEL_FLAG:
                camServer.ws.send(JSON.stringify({
                    'flag' : CHANGE_MODEL_FLAG,
                    'data' : jsonData.data
                }));
                break;
            case SEND_IMAGE_FLAG:
                [...clients.keys()].forEach((client) => {
                    client.send(JSON.stringify({
                        'flag' : SEND_IMAGE_FLAG,
                        'data' : jsonData.data
                    }));
                });

                coffeeJson.num = parseInt(jsonData.num);
                const saveJson = JSON.stringify(coffeeJson);

                fs.writeFileSync('./coffee.json', saveJson);
                break;
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
    });
});
