/*
  2022 Kintex Face pose detection demo
*/
// Import modules
import { GLTFLoader } from '../gltf/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from '../gltf/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from '../build/three.module.js'


/*
    ----------------------<<< Global variable >>>----------------------
*/

// Set global variable
let camera_width = 2560; // 렌더링할 캔버스 너비
let camera_height = 1440; // 렌더링할 캔버스 높이
let modelLists = []; // 3d object models
let pos = new THREE.Vector3(); // create once and reuse
let vec = new THREE.Vector3(); // create once and reuse

/* shape = [max_samples, (area, center_x, center_y, x_rot, y_rot, z_rot)] */
let currentPoses = Array.from(Array(4), () => Array(6).fill(0));
let targetPoses = Array.from(Array(4), () => Array(6).fill(0));

// Configurate GLTF loader
const loader = new GLTFLoader();
// Get video element
const originalVideo = document.getElementById('video');
// Set video element listener (Async fuction)
originalVideo.addEventListener('canplaythrough', render_ar_video);

// Set Three.js Perspective camera and Renderer
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(45, camera_width / camera_height, 1, 1000);
let renderer = new THREE.WebGLRenderer({
    canvas: render_ar,
   alpha: true, 
   preserveDrawingBuffer: true,
   premultipliedAlpha: false
});
renderer.setSize(camera_width, camera_height);

// Set Light source
let pointLightRight = new THREE.PointLight(0xffffff);
let pointLightLeft = new THREE.PointLight(0xffffff);
let pointLightBottom = new THREE.PointLight(0xffffff);
let pointLightCenter = new THREE.PointLight(0xffffff);
pointLightRight.position.set(100, 100, 0);
pointLightLeft.position.set(-100, 100, 0);
pointLightBottom.position.set(0, -100, 0);
pointLightCenter.position.set(0, 30, 100);
scene.add(pointLightRight);
scene.add(pointLightLeft);
scene.add(pointLightBottom);
scene.add(pointLightCenter);

// Set default camera position
camera.lookAt(0,0,0);
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 10;

// Load models
loader.load('assets/objects/head_01.glb', function ( gltf ) {
    gltf.scene.scale.set(45, 45, 45);			   
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.visible = true;

    vec.set(
        ((1280 / camera_width) * 2 - 1).toFixed(2),
        (- (720 / camera_height) * 2 + 1).toFixed(2),
        0.5);
    
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    
    // var distance = - camera.position.z / vec.z;
    var distance = - camera.position.z / -1;

    var value = vec.multiplyScalar(distance.toFixed(2));
    
    gltf.scene.position.x = (pos.x + value.x).toFixed(2);
    gltf.scene.position.y = (pos.y + value.y).toFixed(2);



    modelLists.push(gltf.scene);
    scene.add(gltf.scene);
    console.log('model load clear');

}, undefined, function ( error ) {
	console.error( error );
} );

// Load models
loader.load('assets/objects/head_02.glb', function ( gltf ) {
    gltf.scene.scale.set(45, 45, 45);			   
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.visible = true;

    vec.set(
        ((1280 / camera_width) * 2 - 1).toFixed(2),
        (- (720 / camera_height) * 2 + 1).toFixed(2),
        0.5);
    
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    
    // var distance = - camera.position.z / vec.z;
    var distance = - camera.position.z / -1;

    var value = vec.multiplyScalar(distance.toFixed(2));
    
    gltf.scene.position.x = (pos.x + value.x).toFixed(2);
    gltf.scene.position.y = (pos.y + value.y).toFixed(2);

    modelLists.push(gltf.scene);
    scene.add(gltf.scene);
    console.log('model load clear');

}, undefined, function ( error ) {
	console.error( error );
} );

// Load models
loader.load('assets/objects/head_03.glb', function ( gltf ) {
    gltf.scene.scale.set(45, 45, 45);			   
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.visible = true;

    vec.set(
        ((1280 / camera_width) * 2 - 1).toFixed(2),
        (- (720 / camera_height) * 2 + 1).toFixed(2),
        0.5);
    
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    
    // var distance = - camera.position.z / vec.z;
    var distance = - camera.position.z / -1;

    var value = vec.multiplyScalar(distance.toFixed(2));
    
    gltf.scene.position.x = (pos.x + value.x).toFixed(2);
    gltf.scene.position.y = (pos.y + value.y).toFixed(2);

    modelLists.push(gltf.scene);
    scene.add(gltf.scene);
    console.log('model load clear');

}, undefined, function ( error ) {
	console.error( error );
} );

// Load models
loader.load('assets/objects/head_04.glb', function ( gltf ) {
    gltf.scene.scale.set(45, 45, 45);			   
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.visible = true;

    vec.set(
        ((1280 / camera_width) * 2 - 1).toFixed(2),
        (- (720 / camera_height) * 2 + 1).toFixed(2),
        0.5);
    
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    
    // var distance = - camera.position.z / vec.z;
    var distance = - camera.position.z / -1;

    var value = vec.multiplyScalar(distance.toFixed(2));
    
    gltf.scene.position.x = (pos.x + value.x).toFixed(2);
    gltf.scene.position.y = (pos.y + value.y).toFixed(2);

    modelLists.push(gltf.scene);
    scene.add(gltf.scene);
    console.log('model load clear');

}, undefined, function ( error ) {
	console.error( error );
} );

// Load models
loader.load('assets/objects/head_05.glb', function ( gltf ) {
    gltf.scene.scale.set(45, 45, 45);			   
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.visible = true;

    vec.set(
        ((1280 / camera_width) * 2 - 1).toFixed(2),
        (- (720 / camera_height) * 2 + 1).toFixed(2),
        0.5);
    
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    
    // var distance = - camera.position.z / vec.z;
    var distance = - camera.position.z / -1;

    var value = vec.multiplyScalar(distance.toFixed(2));
    
    gltf.scene.position.x = (pos.x + value.x).toFixed(2);
    gltf.scene.position.y = (pos.y + value.y).toFixed(2);

    modelLists.push(gltf.scene);
    scene.add(gltf.scene);
    console.log('model load clear');

}, undefined, function ( error ) {
	console.error( error );
} );

// Load models
loader.load('assets/objects/head_06.glb', function ( gltf ) {
    gltf.scene.scale.set(45, 45, 45);			   
    gltf.scene.position.set(0, 0, 0);
    gltf.scene.visible = true;

    vec.set(
        ((1280 / camera_width) * 2 - 1).toFixed(2),
        (- (720 / camera_height) * 2 + 1).toFixed(2),
        0.5);
    
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    
    // var distance = - camera.position.z / vec.z;
    var distance = - camera.position.z / -1;

    var value = vec.multiplyScalar(distance.toFixed(2));
    
    gltf.scene.position.x = (pos.x + value.x).toFixed(2);
    gltf.scene.position.y = (pos.y + value.y).toFixed(2);

    modelLists.push(gltf.scene);
    scene.add(gltf.scene);
    console.log('model load clear');

}, undefined, function ( error ) {
	console.error( error );
} );


/*
    ----------------------<<< Function >>>----------------------
*/

// Object들의 시각화 여부를 제어하는 함수
function visibleHandler(Idx, bool){
    modelLists[Idx].visible = bool;
}

// Websocket을 통해 얻은 정보를 바탕으로 object들의 위치 및 회전을 update
function updateRotationAndPosition(idx, center_x, center_y, scale, x_rot, y_rot, z_rot) {

    
    center_y = center_y - 30;

    scale = (170 * scale).toFixed(0);

    modelLists[idx].scale.set(scale, scale, scale)

    vec.set(
        ((center_x / camera_width) * 2 - 1).toFixed(2),
        (- (center_y / camera_height) * 2 + 1).toFixed(2),
        0.5);
    
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    
    // var distance = - camera.position.z / vec.z;
    var distance = - camera.position.z / -1;

    var value = vec.multiplyScalar(distance.toFixed(2));
    
    modelLists[idx].position.x = (pos.x + value.x).toFixed(2);
    modelLists[idx].position.y = (pos.y + value.y).toFixed(2);

    modelLists[idx].rotation.x = (-x_rot).toFixed(2);
    modelLists[idx].rotation.y = (-y_rot).toFixed(2);
    modelLists[idx].rotation.z = (-z_rot).toFixed(2);

    console.log(scale);

}

async function render_ar_video() {
    // console.log('render')
    renderer.render(scene, camera);
    // await requestAnimationFrame(render_ar_video);
    setTimeout(render_ar_video, 1)
}

export { visibleHandler, updateRotationAndPosition};