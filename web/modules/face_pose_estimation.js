tf.ENV.set("WEBGL_CPU_FORWARD", true)
tf.setBackend('webgl');
// tf.setBackend('wasm');
console.log(tf.getBackend()); // tf backend 확인

import * as camera_util from "./camera.js";
import { render_ar_video, switch_visible, get_world_coords, get_world_rotate } from "./face_pose_ar.js";

var webSocket = new WebSocket("wss://park-tdl.tspxr.ml:7777");

async function loadFaceLandmarkDetectionModel() {
    return faceLandmarksDetection
        .load(faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
            { maxFaces: 1 });
}
const model = await loadFaceLandmarkDetectionModel();


const canvas = document.getElementById("render_area");
let context = canvas.getContext('2d');
                
context.strokeStyle = "#00FFFF";
context.lineWidth = 4;
context.font = '48px serif';

context.fillStyle = "#000000";

var center_x = 0;
var center_y = 0;

var videoElement = document.getElementById('video');

videoElement.addEventListener('canplaythrough', render_video);
console.log(videoElement.videoWidth, videoElement.videoHeight);


// videoElement.width = 720;
// videoElement.height = 1280;


// 페이지를 로드하면 실행 (구성요소들 초기화)
function onLoad() {
    console.log('on load')
    // canvas.width = width;
    // canvas.height = height;
    camera_util.getCamera(videoElement);
}

webSocket.onmessage = function(message){
    var recv_data = message.data.split(',');
    var x_rot = parseFloat(recv_data[0]);
    var y_rot = parseFloat(recv_data[1]);
    var z_rot = parseFloat(recv_data[2]);
    
    get_world_rotate(x_rot, y_rot, z_rot)
    
    // get_world_coords
    // console.log(recv_data);
}

async function render_video(){
    // context.drawImage(videoElement, 0, 0, 720, 1280);  
    tf.engine().startScope()

    
    // const inputImageTensor = tf.expandDims(tf.cast(tf.browser.fromPixels(videoElement), 'float32'), 0);
    // const resizedImage = tf.image.resizeBilinear(inputImageTensor, [300, 300]);

       
    const predictions = await model.estimateFaces({
        input: videoElement
    });
    
    // context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    if(predictions.length > 0) {
        
        
        
                    
        console.log(predictions)
        
        // draw mesh !
        predictions.forEach(prediction => {

            const keypoints = prediction.scaledMesh;
            
            var output_data = [
                keypoints[1],
                keypoints[33],
                keypoints[61],
                keypoints[199],
                keypoints[263],
                keypoints[291]
            ]
            var json_data = JSON.stringify(output_data);
            webSocket.send(json_data);



            var topLeft = prediction.boundingBox.topLeft;
            var bottomRight = prediction.boundingBox.bottomRight;


            var xmin = topLeft[0] 
            var ymin = topLeft[1]
            var width = bottomRight[0] - topLeft[0]
            var height = bottomRight[1] - topLeft[1]
            
            var center_x = xmin + (width/2);
            var center_y = ymin + (height/2);
            
            // console.log('center_x center_y', center_x, center_y);
            get_world_coords(center_x, center_y)
            
            
            
            
            
            // for (let i = 0; i < keypoints.length; i++) {
            //     const x = keypoints[i][0];
            //     const y = keypoints[i][1];

            //     context.beginPath();
            //     context.arc(x, y, 2, 0, 2 * Math.PI);
            //     context.fill();
            // }
        });
    
    }

    tf.engine().endScope()
    await requestAnimationFrame(render_video);
}

onLoad();