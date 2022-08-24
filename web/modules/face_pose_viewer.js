import * as camera_util from "./camera.js";
import { render_ar_video, switch_visible, visibleHandler, changeRotationAndPosition} from "./face_pose_ar.js";

const webSocket = new WebSocket("wss://park-tdl.tspxr.ml:7777");

// 이미지를 저장하기 위한 canvas 생성
const canvas = document.getElementById("render_area");
canvas.width=2560;
canvas.height=1440;

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


}

async function render_video(){
    
    
    // context.drawImage(videoElement, 0, 0, 1920, 1080);
    context.drawImage(videoElement, 0, 0, 2560, 1440);
    // context.drawImage(videoElement, 300, 300, 400, 400, 0, 0, 400, 400);

    await requestAnimationFrame(render_video);
}

onLoad();
