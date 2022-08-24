tf.ENV.set("WEBGL_CPU_FORWARD", true)
tf.setBackend('webgl');
// tf.setBackend('wasm');
console.log(tf.getBackend()); // tf backend 확인

import * as camera_util from "./camera.js";
import { render_ar_video, switch_visible, get_world_coords } from "./three_test.js";

tf.ready().then(() => {
});

const model = await tf.loadGraphModel('assets/face_detection/model.json');


// const warmupResult = model.predict(tf.zeros([1,300,300,3]));
// warmupResult.dataSync();
// warmupResult.dispose();


// const canvas = document.createElement("canvas");
const canvas = document.getElementById("render_area");
let context = canvas.getContext('2d');
                
context.strokeStyle = "#00FFFF";
context.lineWidth = 4;
context.font = '48px serif';

context.fillStyle = "#000000";

// const videoElement = document.querySelector('video');
var videoElement = document.getElementById('video');

videoElement.addEventListener('canplaythrough', render_video);
console.log(videoElement.videoWidth, videoElement.videoHeight);


videoElement.width = 720;
videoElement.height = 1280;

var visibleFlag = false;
var unvisibleCount = 0;
        
var calc_boxes = 0;
var detected_labels = 0;
var best_idx =0;
var target_loop = 0;

var x_min = 0;
var y_min = 0;
var x_max = 0;
var y_max = 0;
var width = 0;
var height = 0;

// 페이지를 로드하면 실행 (구성요소들 초기화)
function onLoad() {
    console.log('on load')
    // canvas.width = width;
    // canvas.height = height;
    camera_util.getCamera(videoElement);
}


async function render_video(){
    // context.drawImage(videoElement, 0, 0, 720, 1280);  
    tf.engine().startScope()

    
    // const date1 = new Date();
    
    const inputImageTensor = tf.expandDims(tf.cast(tf.browser.fromPixels(videoElement), 'float32'), 0);
    const resizedImage = tf.image.resizeBilinear(inputImageTensor, [300, 300]);
    // const normalizedImage = tf.div(resizedImage, 255);


    var output = await model.executeAsync(resizedImage);
    // var output = model.predict(transpose_img);

    
    output = tf.squeeze(output, 0); // [1, N, 6] -> [N, 6]
    
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    if (output.shape[0] >= 1){
        console.log('detection');
        if (visibleFlag == false){
            switch_visible(true);
        }

        var boxes = output.slice([0, 0], [-1, 4]); // [N, 4]
        var scores = output.slice([0, 4], [-1, 1]); // [N, 1]
        var labels = output.slice([0, 5], [-1, 1]); // [N, 1]
        
        
        // Get from best confidence score
        best_idx = scores.argMax(0).dataSync(); // -> return in index
        
        
        calc_boxes = boxes.dataSync();
        
        target_loop = calc_boxes.length/2
        detected_labels = labels.dataSync();

        
        var idx = (best_idx + 1) * 4;
        x_min = calc_boxes[idx-4] * context.canvas.width;
        y_min = calc_boxes[idx-3] * context.canvas.height;
        x_max = calc_boxes[idx-2] * context.canvas.width;
        y_max = calc_boxes[idx-1] * context.canvas.height;    
        width = x_max- x_min;
        height = y_max - y_min;
    

        context.strokeRect(x_min, y_min, width, height);
        context.fillText(detected_labels[best_idx], x_min, y_min);

        tf.dispose(boxes);
        tf.dispose(scores);
        tf.dispose(labels);

        var center_x = x_min + width/2;
        var center_y = y_min + height/2;
        

        get_world_coords(center_x, center_y, width, height, detected_labels[best_idx]);
    }
    else{
        unvisibleCount += 1;
        
        if (unvisibleCount == 3){
            unvisibleCount = 0;
            switch_visible(false);
        }
    }
    
    tf.dispose(output);
    // var date2 = new Date();
    // var diff = date2 - date1;
    // // console.log(diff);
    
 
    tf.engine().endScope()
    await requestAnimationFrame(render_video);
}

onLoad();