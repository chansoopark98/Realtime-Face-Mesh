/*
  2022 Kintex Face pose detection demo
*/

// Import modules
import { GLTFLoader } from '../gltf/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from '../build/three.module.js'

// Set global variable
var model; // GLTF 모델
var secondModel;
var factor = 1.0; // 비디오 퀄리티 팩터 (0 ~ 1)
var camera_width = 2560; // 렌더링할 캔버스 너비
var camera_height = 1440; // 렌더링할 캔버스 높이

// Configurate GLTF loader
const loader = new GLTFLoader();
// Get video element
const originalVideo = document.getElementById('video');
// Set video element listener (Async fuction)
originalVideo.addEventListener('canplaythrough', render_ar_video);

// Three.js 기본 설정
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, camera_width / camera_height, 1, 1000);
var renderer = new THREE.WebGLRenderer({
    canvas: render_ar,
    alpha: true, preserveDrawingBuffer: true
});
renderer.setSize(camera_width, camera_height);

// renderer.setPixelRatio(window.devicePixelRatio * factor)
// renderer.outputEncoding = THREE.sRGBEncoding;

var pointLight = new THREE.PointLight(0xffffff);
pointLight.position.set(0, 300, 200);
scene.add(pointLight);

camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 10;

var modelLists = [];

loader.load('assets/objects/head.gltf', function ( gltf ) {
    gltf.scene.scale.set(3.2, 3.2, 3.2);			   
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.visible=true;

    
    model = gltf.scene;
    console.log(model)
    modelLists.push(model);
    scene.add(gltf.scene);
    console.log('model load clear');

}, undefined, function ( error ) {
	console.error( error );
} );


loader.load('assets/objects/trump.gltf', function ( gltf ) {
    gltf.scene.scale.set(1, 1, 1 );			   
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.visible = false;

    secondModel = gltf.scene;
    modelLists.push(secondModel);
    scene.add(secondModel);

}, undefined, function ( error ) {
	console.error( error );
} );






function visibleHandler(Idx, bool){
    modelLists[Idx].visible = bool;
}


function changeRotationAndPosition(idx, center_x, center_y, x_rot, y_rot, z_rot){
    // center_x = center_x - (center_x * (y_rot * 10));

    // center_y = center_y + 150;
    
    var pos = new THREE.Vector3(); // create once and reuse
    var vec = new THREE.Vector3(); // create once and reuse
    vec.set(
        (( center_x / camera_width ) * 2 - 1).toFixed(4),
        (- ( center_y / camera_height ) * 2 + 1).toFixed(4),
        0.5); 

    vec.unproject(camera);
    
    vec.sub(camera.position).normalize();
    
    var distance = - camera.position.z / vec.z;
    
    var value = vec.multiplyScalar( distance.toFixed(4) );
  
    if (idx == 0) {
        
        model.position.x = (pos.x + value.x).toFixed(3);
        model.position.y = (pos.y + value.y).toFixed(3);

        model.rotation.x = (-x_rot).toFixed(2);
        model.rotation.y = (-y_rot).toFixed(2);
        
        
    }
    else{
        secondModel.position.x = (pos.x + value.x);
        secondModel.position.y = (pos.y + value.y);
        // secondModel.rotation.x = -x_rot * 15;
        // secondModel.rotation.y = y_rot * 30;
    }
    
    
}

function switch_visible(visible_flag){
  mesh.visible = visible_flag;
}

async function render_ar_video(){
  renderer.render(scene, camera);
//   await requestAnimationFrame(render_ar_video);
  setTimeout(render_ar_video, 1)
}

export {render_ar_video, switch_visible, visibleHandler, changeRotationAndPosition};
