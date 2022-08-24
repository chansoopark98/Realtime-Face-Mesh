import * as camera_util from "./camera.js";
import { render_ar_video, switch_visible, visibleHandler, changeRotationAndPosition} from "./face_pose_ar.js";

let sx = 880;
let sy = 420;
let dx = 800;
let dy = 600;

let center_x = 0;
let center_y = 0;
let x_rot = 0;
let y_rot = 0;
let z_rot = 0;
let targetLoop = 0;
let maxObjNums = 2;

const webSocket = new WebSocket('wss://park-tdl.tspxr.ml:7777');

// 이미지를 저장하기 위한 canvas 생성
const canvas = document.getElementById('render_area');
const sendCanvas = document.getElementById('send_canvas');
sendCanvas.width = 800;
sendCanvas.height = 600;
canvas.width = 2560;
canvas.height = 1440;

let context = canvas.getContext('2d');
let sendContext = sendCanvas.getContext('2d');
                
const videoElement = document.getElementById('video');

videoElement.addEventListener('canplaythrough', render_video);
console.log(videoElement.videoWidth, videoElement.videoHeight);


// 페이지를 로드하면 실행 (구성요소들 초기화)
function onLoad() {
    console.log('on load')
    // canvas.width = width;
    // canvas.height = height;
    camera_util.getCamera(videoElement);
}

webSocket.interval = setInterval(() => { // ?초마다 클라이언트로 메시지 전송
    if (webSocket.readyState === webSocket.OPEN) {
        
        let sendData = sendCanvas.toDataURL('image/jpeg', 0.7)
        webSocket.send(sendData.split(",")[1]);
        
    }
}, 50);

webSocket.onmessage = function(message){  

    let recvData = message.data.split(',');
    
    if (recvData.length >=5){
        targetLoop = recvData.length/5
    }
    else{
        targetLoop = 0;
    }
    
    console.log(targetLoop);  
    for (let detectIdx=1; detectIdx<=targetLoop; detectIdx++){
  
        let idx = detectIdx * 5;
        
        center_x = parseFloat(recvData[idx-5]);
        center_y = parseFloat(recvData[idx-4]);
        x_rot = parseFloat(recvData[idx-3]);
        y_rot = parseFloat(recvData[idx-2]);
        z_rot = parseFloat(recvData[idx-1]);
        
        changeRotationAndPosition(detectIdx - 1,
                                  center_x,
                                  center_y,
                                  x_rot,
                                  y_rot,
                                  z_rot);
        
        visibleHandler(detectIdx-1, true);
        
    }

    

    for (let deleteIdx=maxObjNums; deleteIdx>targetLoop; deleteIdx--){
        
        visibleHandler(deleteIdx-1, false);
        
    }
    
}

async function render_video(){
    
    
    // context.drawImage(videoElement, 0, 0, 1920, 1080);
    
    // sendContext.drawImage(videoElement, 640, 180, 1920, 1080, 0, 0, 1920, 1080);
    sendContext.drawImage(videoElement, sx, sy, dx, dy, 0, 0, dx, dy);

    await requestAnimationFrame(render_video);
}

onLoad();
