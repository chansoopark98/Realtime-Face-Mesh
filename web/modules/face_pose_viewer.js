// tf.ENV.set("WEBGL_CPU_FORWARD", true)
// tf.setBackend('webgl');
// // tf.setBackend('wasm');
// console.log(tf.getBackend()); // tf backend 확인
import * as camera_util from "./camera.js";
import { render_ar_video, switch_visible, visibleHandler, changeRotationAndPosition} from "./face_pose_ar.js";

const webSocket = new WebSocket("wss://park-tdl.tspxr.ml:7777");

// 이미지를 저장하기 위한 canvas 생성
const canvas = document.getElementById("render_area");
canvas.width=2560;
canvas.height=1440;

let maxObjNums = 2;
let targetLoop = 0;
let face_idx;
let scale;
let center_x;
let center_y;
let x_rot;
let y_rot;
let z_rot;
let depth;

let context = canvas.getContext('2d');
                
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
        
        let sendData = canvas.toDataURL('image/jpeg', 0.3)
        webSocket.send(sendData.split(",")[1]);
        
    }
}, 50);

webSocket.onmessage = function(message){  
    

    let recvData = message.data.split(',');

    if (recvData.length >=8){
        targetLoop = recvData.length/8
    }
    else{
        targetLoop = 0;
    }

    
    
    
    for (let detectIdx=1; detectIdx<=targetLoop; detectIdx++){
        let idx = detectIdx * 8;
        face_idx = parseInt(recvData[idx-8]);
        scale = parseFloat(recvData[idx-7])
        center_x = parseFloat(recvData[idx-6]);
        center_y = parseFloat(recvData[idx-5]);
        x_rot = parseFloat(recvData[idx-4]);
        y_rot = parseFloat(recvData[idx-3]);
        z_rot = parseFloat(recvData[idx-2]);
        depth = parseFloat(recvData[idx-1]);
        
        changeRotationAndPosition(detectIdx - 1,
                                  scale,
                                  center_x,
                                  center_y,
                                  depth,
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
    context.drawImage(videoElement, 0, 0, 2560, 1440);
    // context.drawImage(videoElement, 300, 300, 400, 400, 0, 0, 400, 400);

    await requestAnimationFrame(render_video);
}

onLoad();
