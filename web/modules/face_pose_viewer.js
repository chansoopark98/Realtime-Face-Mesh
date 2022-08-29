import * as camera_util from './camera.js';
import { visibleHandler, updateRotationAndPosition} from './face_pose_ar.js';
import * as captureFunc from './capture.js'

/*
    ----------------------<<< Global variable >>>----------------------
*/
// Crop할 VideoElement의 시작 x축 위치 (xmin)
let sx = 480;
// Crop할 VideoElement의 시작 y축 위치 (ymin)
let sy = 120;
// Crop할 영역의 너비 (width)
let dx = 1600;
// Crop할 영역의 높이 (height)
let dy = 1200;

/* Object 위치 update에 사용 할 전역 변수 리스트 */
// Object의 Box 중심 x,y
let center_x = 0;
let center_y = 0;
// Object의 너비 비율 (0 ~ 1)
let scale = 0;
// Object의 각 축별 회전 값 (Radians)
let x_rot = 0;
let y_rot = 0;
let z_rot = 0;
// 검출된 Object 개수
let targetLoop = 0;
// 제한할 최대 Object 개수
let maxObjNums = 6;

// 딥러닝 연산 처리를 위한 Websocket
const webSocket = new WebSocket('wss://park-tdl.tspxr.ml:7777');
// const webSocket = new WebSocket('ws://127.0.0.1:7777');
// const webSocket = new WebSocket('wss://127.0.0.1:5502');

// 효과 및 다양한 이펙트를 표현하기 위한 canvas
const canvas = document.getElementById('render_area');
canvas.width = 2560; // VideoElement width
canvas.height = 1440; // VideoElement height
let context = canvas.getContext('2d');
context.strokeStyle = "#B40404";
context.lineWidth = 6;
context.strokeRect(sx, sy, dx, dy);

// Video frame을 Websocket으로 전송하기 위한 이미지 전송용 canvas
const sendCanvas = document.getElementById('send_canvas');
sendCanvas.width = 1280;
sendCanvas.height = 960;

let sendContext = sendCanvas.getContext('2d');
                
const videoElement = document.getElementById('video');

videoElement.addEventListener('canplaythrough', render_video);
console.log(videoElement.videoWidth, videoElement.videoHeight);


webSocket.interval = setInterval(() => { // ?초마다 클라이언트로 메시지 전송
    if (webSocket.readyState === webSocket.OPEN) {
        
        let sendData = sendCanvas.toDataURL('image/jpeg', 0.5)
        webSocket.send(sendData.split(",")[1]);
        
    }
}, 30);

webSocket.onmessage = function(message){  
    let recvData = message.data.split(',');
    
    if (recvData.length >=6){
        targetLoop = recvData.length/6
    }
    else{
        targetLoop = 0;
    }
    
    for (let detectIdx=1; detectIdx<=targetLoop; detectIdx++){
  
        let idx = detectIdx * 6;
        
        center_x = parseInt(recvData[idx-6]);
        center_y = parseInt(recvData[idx-5]);
        scale = parseFloat(recvData[idx-4]);
        x_rot = parseFloat(recvData[idx-3]);
        y_rot = parseFloat(recvData[idx-2]);
        z_rot = parseFloat(recvData[idx-1]);
        
        updateRotationAndPosition(detectIdx - 1,
                                  center_x,
                                  center_y,
                                  scale,
                                  x_rot,
                                  y_rot,
                                  z_rot);
        
        visibleHandler(detectIdx-1, true);
        
    }

    

    for (let deleteIdx=6; deleteIdx>targetLoop; deleteIdx--){
        visibleHandler(deleteIdx-1, false);
        
    }
    
}

async function render_video(){
    
    
    // context.drawImage(videoElement, 0, 0, 1920, 1080);
    
    // sendContext.drawImage(videoElement, 640, 180, 1920, 1080, 0, 0, 1920, 1080);
    // sendContext.drawImage(videoElement, sx, sy, dx, dy, 0, 0, dx, dy);
    sendContext.drawImage(videoElement, sx, sy, dx, dy, 0, 0, 1280, 960);

    await requestAnimationFrame(render_video);
}

// 페이지를 로드하면 실행 (구성요소들 초기화)
window.onload = () => {
    console.log('on load')
    // canvas.width = width;
    // canvas.height = height;
    camera_util.getCamera(videoElement);

    const renderAR = document.querySelector('#render_ar');
    // const layer = [ canvas, renderAR ];
    const layer = [ renderAR ];
    captureFunc.createCaptureButton(videoElement, layer, sx, sy, dx, dy);
}