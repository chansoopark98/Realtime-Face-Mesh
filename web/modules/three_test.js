//import * as THREE from 'three';


// import GLTFLoader from '../gltf_loader';
// import GLTFLoader from '../gltf/index.js';
// import GLTFLoader from '../examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from '../gltf/examples/jsm/loaders/GLTFLoader.js';
// import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from '../build/three.module.js'
// import * as GLTF from '../gltf_loader/index.js'

const loader = new GLTFLoader();


var originalVideo = document.getElementById('video');
originalVideo.addEventListener('canplaythrough', render_ar_video);

var camera_width = 720; // 480
var camera_height = 1280; // 640

const videoElement = document.createElement('video');
videoElement.src="assets/TSP_XR.mp4";
videoElement.crossOrigin = 'anonymous';
videoElement.loop = true;
videoElement.muted = true;
videoElement.playsInline = true;
videoElement.play();

// var textureLoader = new THREE.TextureLoader();
// var map =  textureLoader.load("assets/logo.png");
// map.flipY = false;


const texture = new THREE.VideoTexture(videoElement);

texture.generateMipmaps = false;
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.format = THREE.RGBAFormat;



texture.needsUpdate = true;
const material_video = new THREE.MeshBasicMaterial({ map: texture , }); //side: THREE.FrontSide
const mat2 = new THREE.MeshBasicMaterial({color: 0x000000});
const mat3 = new THREE.MeshBasicMaterial({color: 0x000000});
const mat4 = new THREE.MeshBasicMaterial({color: 0x000000});
const mat5 = new THREE.MeshBasicMaterial({color: 0x000000});
const mat6 = new THREE.MeshBasicMaterial({color: 0x000000})
// var materials = [mat2, mat3, mat4, mat5, material_video, mat6]
var materials = material_video;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, camera_width / camera_height, 1, 1000);

//var renderer = new THREE.WebGLRenderer();
var renderer = new THREE.WebGLRenderer( { canvas: render_ar, alpha: true, preserveDrawingBuffer:true  } );
renderer.setSize(camera_width, camera_height);
var factor = 0.5;
renderer.setPixelRatio(window.devicePixelRatio * factor)
renderer.outputEncoding = THREE.sRGBEncoding;
//document.body.appendChild(renderer.domElement);

// const geometry = new THREE.BoxGeometry(10, 10, 3); // width, height, depth
// 
var aspect_ratio = 0;
var scale_factor = 0;


const geometry = new THREE.PlaneGeometry(1, 1 );
const material = new THREE.MeshLambertMaterial({ color: 0x1ec876 });
const mesh = new THREE.Mesh(geometry, materials);



mesh.position.set(0, 0, 0); // Optional, 0,0,0 is the default

const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
var pointLight = new THREE.PointLight(0xffffff);
pointLight.position.set(100, 300, 200);
scene.add(pointLight);

mesh.visible=false;
scene.add(mesh);

camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 120;


loader.load('assets/Anna_OBJ/trump.gltf', function ( gltf ) {
  // const model = gltf.scene;
  // // let mixer = new THREE.AnimationMixer( model );
  // // gltf.animations.forEach(( clip ) => {
  // //   mixer.clipAction(clip).play();
  // // });

  gltf.scene.scale.set( 1, 1, 1 );			   
	// gltf.scene.position.x = 0; //Position (x = right+ left-) 
  // gltf.scene.position.y = 0; //Position (y = up+, down-)
	// gltf.scene.position.z = 0;
  gltf.scene.position.set(0, 0, 0);
  gltf.scene.visible=true;
//   gltf.scene.material = new THREE.MeshPhongMaterial({
//     map: map,
//     color: 0xff00ff,
// });
  
	scene.add(gltf.scene);
  
  console.log ('add gltf')

}, undefined, function ( error ) {

	console.error( error );

} );


var vec = new THREE.Vector3(); // create once and reuse
// var pos = new THREE.Vector3(); // create once and reuse

function get_world_coords(center_x, center_y, width, height, class_id){

  // console.log(width);
  if (class_id == 2){
    if (center_x > 360) {
      
      center_x = 2.71 * center_x / 2;
    
      camera.rotation.y = 0.4;
      center_x -= width;
    }
    else{
      var new_center_x = 2.71 * center_x / 2;
      center_x = center_x - (new_center_x - center_x);
      camera.rotation.y = -0.4;
      center_x += width;
    }
  }

  var pos = new THREE.Vector3(); // create once and reuse
  vec.set(
    ( center_x / camera_width ) * 2 - 1,
    - ( center_y / camera_height ) * 2 + 1,
    0.5 );

  vec.unproject(camera);

  vec.sub(camera.position).normalize();

  var distance = - camera.position.z / vec.z;
  // pos.copy( camera.position ).add( vec.multiplyScalar( distance ) );
  var value = vec.multiplyScalar( distance );
  // console.log(value);
  // console.log(center_x, center_y, pos);
  camera.position.x = -(pos.x + value.x);
  camera.position.y = -(pos.y + value.y);



  aspect_ratio = height/width;
  scale_factor = 0.07 * width;

  mesh.scale.set(scale_factor, scale_factor * aspect_ratio, 1);
  
}

function switch_visible(visible_flag){
  mesh.visible = visible_flag;
}
  

// var render = function(visible_flag) {
//   mesh.visible=visible_flag;
//   // video_img.src = 'https://park-tdl.tspxr.ml:4447/stream?src=0';
  
//   renderer.render(scene, camera);
//   requestAnimationFrame(render);
// };

async function render_ar_video(){
  
  console.log('render!')
  renderer.render(scene, camera);
  // await requestAnimationFrame(render_ar_video);
  setTimeout(render_ar_video, 1)
}

export {render_ar_video, switch_visible, get_world_coords};
// render();
