// load css and fonts
import './style.css';
import MonserratRegular from '/fonts/Montserrat-Regular.ttf';
// load data from data.json
import locationsData from './data.json';
// load howler modules to manage sounds
import {Howl, Howler} from 'howler';
// load three.js modules
import * as THREE from 'three';
// load various camera controls
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
// load for 3D files
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
// load shaders for depth and bokeh effects
import { BokehShader, BokehDepthShader } from 'three/addons/shaders/BokehShader2.js';
// load feather icons for icons
import feather, { replace } from 'feather-icons';
// load text module for 3D text
import {Text} from 'troika-three-text';

var elapsedMiliseconds = 0;
var grounds = [];
let controls, materialDepth;

// scene setup
const backgroundColor = new THREE.Color("rgb(30, 27, 75)");
const fogColor        = new THREE.Color("rgb(30, 27, 75)");
const groundColor     = new THREE.Color(0x224488);

// camera setup
const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 10 );
const cameraInitPos   = new THREE.Vector3(2,5,2);
camera.position.set( cameraInitPos.x, cameraInitPos.y, cameraInitPos.z );
const scene = new THREE.Scene();
scene.background = backgroundColor;
scene.fog = new THREE.Fog( fogColor, 3, 6 );

// renderer setup
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1;

// postprocessing setup
const postprocessing  = { enabled: false };
const depthShader     = BokehDepthShader;
const shaderSettings  = {rings: 3,samples: 4};
let windowHalfX       = window.innerWidth / 2;
let windowHalfY       = window.innerHeight / 2;

// gltf loader
const loader          = new GLTFLoader().setPath( '/' );
const dracoLoader     = new DRACOLoader();
dracoLoader.setDecoderPath('/draco3d/');
loader.setDRACOLoader( dracoLoader );

// dom container for scene
const container       = document.getElementById( 'scene' );

// start time
const startTime       = Date.now();

// mouse and raycaster setup for interaction with 3D objects
const mouse           = new THREE.Vector2();
const raycaster       = new THREE.Raycaster();
const target          = new THREE.Vector3( -20, -20, - 20 );
var lanterns          = []; 
var currentHover      = null;

// variables for buildings, roads and rivers
var buildings;
var roads;
var rivers;
// create a second scene for 360 view

var scene360                    = new THREE.Scene();
scene360.background             = new THREE.Color(0xffffff);
const camera360                   = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
camera360.position.set(0,0,3);
var controls360                 = new OrbitControls(camera360, renderer.domElement);
controls360.enableDamping       = true;
controls360.dampingFactor       = 0.5;
controls360.screenSpacePanning  = false;
var is360                       = false;
// setting up ambient sounds

// sons
const ambientPads     = new Howl({
  src: ["/ambience/stream.mp3"],
  html5: true,
  loop:true,
  volume:0.5
});
const ambientNight    = new Howl({
  src: ["/ambience/night.mp3"],
  html5: true,
  loop:true,
  volume:1
});
const hoverSoundEffect= new Howl({
  src: ["/sfx/hover_lantern.wav"],
  volume:1
});

// debug cone
const geometry = new THREE.ConeGeometry( 0.05, 0.1, 6 ); 
const material = new THREE.MeshBasicMaterial( {color: 0x0000ff} );
const cone = new THREE.Mesh(geometry, material ); 
cone.name = "debug_cone";
var debugMode = false;
window.toggleDebug = function () {
  debugMode = !debugMode;
  console.log("Setting debug mode to :",debugMode);
  cone.visible = debugMode;
};

// max bounds for camera (to prevent camera from going too far)
const maxBounds = [
  [2.099156278145285, 4.100214650637432],
  [2.0991562781452853, -2.780473401329221]
];

// function to setup 3D lights
function setupLight() {
  var hemiLight = new THREE.HemisphereLight( 0x224488, 0xffffff, 0.1 );
  hemiLight.color.setHSL( 0.6, 0.75, 0.5 );
  hemiLight.groundColor.setHSL( 0.095, 0.5, 0.5 );
  hemiLight.position.set( 0, 500, 0 );
  scene.add( hemiLight );

  // directional light
  var dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
  dirLight.position.set( -1, 0.75, 1 );
  dirLight.position.multiplyScalar( 50);
  dirLight.name = "dirlight";
  dirLight.shadowCameraVisible = false;

  scene.add( dirLight );

  dirLight.castShadow = false;
  dirLight.shadowMapWidth = dirLight.shadowMapHeight = 1024*2;

  var d = 300;

  dirLight.shadowCameraLeft = -d;
  dirLight.shadowCameraRight = d;
  dirLight.shadowCameraTop = d;
  dirLight.shadowCameraBottom = -d;

  dirLight.shadowCameraFar = 3500;
  dirLight.shadowBias = -0.0001;
  dirLight.shadowDarkness = 0.35;
}

// function to initialize the scene
function init() {

  // debug cone 
  scene.add( cone );
  cone.visible = debugMode;

  // Build map 
  // TODO : build by chunk
  loader.load( 
    "map/all_ground.glb", 
    async function ( gltf ) {
      let ground_chunk;
      ground_chunk = gltf.scene;
      ground_chunk.scale.set(.001*ground_chunk.scale.x, .001*ground_chunk.scale.y, .001 * ground_chunk.scale.z)
      ground_chunk.name = "all_ground";
      scene.add( ground_chunk );
      grounds.push(ground_chunk);
    },

    // called while loading is progressing
    function(xhr) {
      console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
    },
    // called when loading has errors
    function ( error ) {
  
      console.log( 'An error happened' );
  
    }
  );
  // ground chunks
  /*for(let i=0;i<6;i++)
  {
    for(let j=0;j<6;j++)
    {
      try {
        loader.load( "grounds/ground_"+i+"_"+j+".glb", async function ( gltf ) {
          let ground_chunk;
          ground_chunk = gltf.scene;
          ground_chunk.scale.set(.001*ground_chunk.scale.x, .001*ground_chunk.scale.y, .001 * ground_chunk.scale.z)
      
          // wait until the model can be added to the scene without blocking due to shader compilation
          await renderer.compileAsync( ground_chunk, camera, scene );
      
          ground_chunk.name = "ground_"+i+"_"+j;
          scene.add( ground_chunk );
          grounds.push(ground_chunk);
        } );
      } catch (error) {
        if(debugMode){
          console.log("could not load : ","grounds/ground_"+i+"_"+j+".glb");
        }
      }

    }
  }
  }*/

  // load buildings
  loader.load( 'map/all_buildings.glb', async function ( gltf ) {
    buildings = gltf.scene;
    buildings.scale.set(.001*buildings.scale.x, .001*buildings.scale.y, .001 * buildings.scale.z)
    buildings.name = "all_buildings";
    scene.add( buildings );
  } );
  // load roads 
  loader.load( 'map/roads.glb', async function ( gltf ) {
  
    roads = gltf.scene;
    roads.scale.set(.001*roads.scale.x, .001*roads.scale.y, .001 * roads.scale.z)

    // wait until the model can be added to the scene without blocking due to shader compilation
    //await renderer.compileAsync( roads, camera, scene );

    roads.name = "roads";
    // propping up rivers & roads a litle so they don't collide too much with ground
    roads.position.set(roads.position.x,roads.position.y + 0.003, roads.position.z);
    scene.add( roads );
  } );
  // load rivers
  loader.load( 'map/rivers.glb', async function ( gltf ) {
  
    rivers = gltf.scene;
    rivers.scale.set(.001*rivers.scale.x, .001*rivers.scale.y, .001 * rivers.scale.z)

    // wait until the model can be added to the scene without blocking due to shader compilation
    //await renderer.compileAsync( rivers, camera, scene );

    rivers.name = "rivers";
    // propping up rivers & roads a litle so they don't collide too much with ground
    rivers.position.set(rivers.position.x,rivers.position.y + 0.003, rivers.position.z);

    
    scene.add( rivers );
  } );

  // populate lanterns on map with data from locationsData
  locationsData.forEach((locationData,locationIndex)=>{
    let lantern;
    let lanternLight;
    loader.load( 'extra_models/paper_lantern.glb', async function ( gltf ) {
  
      lantern = gltf.scene;
      lantern.scale.set(.05*lantern.scale.x, .05*lantern.scale.y, .05 * lantern.scale.z)
      // wait until the model can be added to the scene without blocking due to shader compilation
      //await renderer.compileAsync( lantern, camera, scene );
  
      //lantern.traverse((item)=>{console.log(item)});
      lantern.name = "lantern_"+locationData.nom_lieu;
      scene.add( lantern );
  
      lanternLight = new THREE.PointLight( 0xffff88, 1, 0.2,0.1);
      lanternLight.name = 'lanternLight';
      //lanternLight.castShadow = true;
      lantern.add(lanternLight);
      lantern.userData.locationIndex = locationIndex;
      if(debugMode){
        console.log(locationData.x,locationData.y,locationData.z);
      }
      if(locationData.x !== "undefined"){
        lantern.position.set(locationData.x,locationData.y,locationData.z);
      }
  
      lanterns.push(lantern);
    } );
  });
  // Load the skybox
  materialDepth = new THREE.ShaderMaterial( {
    uniforms:       depthShader.uniforms,
    vertexShader:   depthShader.vertexShader,
    fragmentShader: depthShader.fragmentShader
  } );

  materialDepth.uniforms[ 'mNear' ].value = 1;
  materialDepth.uniforms[ 'mFar' ].value  = 2.5;

  setupLight();

  controls = new MapControls( camera, renderer.domElement );
  controls.enableDamping    = true;
  //controls.enableZoom       = false;
  controls.maxBounds = maxBounds;
  controls.minZoom          = 2;
  controls.maxZoom          = 5;
  controls.enableZoom       = false;
  controls.minDistance      = 2.5;
  controls.maxDistance      = 2.5;
  controls.maxAzimuthAngle  = THREE.MathUtils.degToRad(45)
  controls.minAzimuthAngle  = THREE.MathUtils.degToRad(45)
  controls.maxPolarAngle    = THREE.MathUtils.degToRad(45)
  controls.minPolarAngle    = THREE.MathUtils.degToRad(45)

  initPostprocessing();

  container.appendChild( renderer.domElement );
  container.style.touchAction = 'none';
  addMouseEvents();

  window.addEventListener( 'resize', onWindowResize );
}

// function to animate the scene
function animate() {
  requestAnimationFrame( animate );

  if(currentHover !== null){
    currentHover.rotation.y = currentHover.rotation.y + 0.01
    let pulsingLight = currentHover.getObjectByName('lanternLight');
    if (pulsingLight !== "undifined" & pulsingLight.isLight){
      //let normalizedTime = Math.max(0, Math.min(1, val-min / max-min))
      pulsingLight.intensity = Math.abs((Math.cos(Math.PI*elapsedMiliseconds/1000+1) / 2));
    }
  }

	// required if controls.enableDamping or controls.autoRotate are set to true
	if(is360){
    controls360.update();
  }else{
    controls.update();
  }
	render();

}

// function to render the scene
function render() {

  elapsedMiliseconds = Math.round((((Date.now() - startTime) * 0.0015) + Number.EPSILON)*1000);

  // default
  let toRenderScene   = scene;
  let toRenderCamera  = camera;
	camera.updateMatrixWorld();

  if (is360) {
    toRenderScene   = scene360;
    toRenderCamera  = camera360;
  }

  if ( postprocessing.enabled ) {

    renderer.clear();

    // render scene into texture

    renderer.setRenderTarget( postprocessing.rtTextureColor );
    renderer.clear();
    renderer.render( toRenderScene, toRenderCamera );

    // render depth into texture

    scene.overrideMaterial = materialDepth;
    renderer.setRenderTarget( postprocessing.rtTextureDepth );
    renderer.clear();
    renderer.render( toRenderScene, toRenderCamera );
    scene.overrideMaterial = null;

    // render bokeh composite

    renderer.setRenderTarget( null );
    renderer.render( postprocessing.scene, postprocessing.camera );


  } else {

    scene.overrideMaterial = null;

    renderer.setRenderTarget( null );
    renderer.clear();
    renderer.render( toRenderScene, toRenderCamera );

  }

}

// function to initialize postprocessing
function initPostprocessing() {

  postprocessing.scene = new THREE.Scene();

  postprocessing.camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, - 10000, 10000 );
  postprocessing.camera.position.z = 100;

  postprocessing.scene.add( postprocessing.camera );

  postprocessing.rtTextureDepth = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType } );
  postprocessing.rtTextureColor = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType } );

  const bokeh_shader = BokehShader;

  postprocessing.bokeh_uniforms = THREE.UniformsUtils.clone( bokeh_shader.uniforms );

  postprocessing.bokeh_uniforms[ 'tColor' ].value = postprocessing.rtTextureColor.texture;
  postprocessing.bokeh_uniforms[ 'tDepth' ].value = postprocessing.rtTextureDepth.texture;
  postprocessing.bokeh_uniforms[ 'textureWidth' ].value = window.innerWidth;
  postprocessing.bokeh_uniforms[ 'textureHeight' ].value = window.innerHeight;

  postprocessing.materialBokeh = new THREE.ShaderMaterial( {

    uniforms: postprocessing.bokeh_uniforms,
    vertexShader: bokeh_shader.vertexShader,
    fragmentShader: bokeh_shader.fragmentShader,
    defines: {
      RINGS: shaderSettings.rings,
      SAMPLES: shaderSettings.samples
    }

  } );

  postprocessing.quad = new THREE.Mesh( new THREE.PlaneGeometry( window.innerWidth, window.innerHeight ), postprocessing.materialBokeh );
  postprocessing.quad.position.z = - 500;
  postprocessing.scene.add( postprocessing.quad );

}

// function to handle window resize
function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  postprocessing.rtTextureDepth.setSize( window.innerWidth, window.innerHeight );
  postprocessing.rtTextureColor.setSize( window.innerWidth, window.innerHeight );

  postprocessing.bokeh_uniforms[ 'textureWidth' ].value = window.innerWidth;
  postprocessing.bokeh_uniforms[ 'textureHeight' ].value = window.innerHeight;


  renderer.setSize( window.innerWidth, window.innerHeight );

}

// function to handle mouse events
function addMouseEvents() {
  container.addEventListener("mouseup", onMouseUp);
  container.addEventListener("mousemove", onMouseMove);
}

// function to stop mouse events
function stopMouseEvents() {
  container.removeEventListener("mouseup", onMouseUp);
  container.removeEventListener("mousemove", onMouseMove);
}

// event listeners functions
function onMouseMove(event) { // here handle hover events
  let intersectedObject = checkIntersects(event, "mousemove");
  if(intersectedObject !== null)
  {
    if(currentHover != intersectedObject){
      currentHover = intersectedObject;
      // play hover sound effect
      hoverSoundEffect.play();
    }
  }else{
    currentHover = null;
  }
}
function onMouseUp(event) { // here handle click events
  if(debugMode){
    //console.log("Renderer infos :",renderer.info);
    //console.log("Camera coords = ", camera.position);
    raycaster.setFromCamera(mouse ,camera);
    let intersectedGrounds = raycaster.intersectObjects(grounds,true);
    if(intersectedGrounds !== undefined & intersectedGrounds !== null & intersectedGrounds[0] !== "undefined"){
      intersectedGrounds[0].point;
      if(intersectedGrounds[0].point !== "undefined"){

        cone.position.set(intersectedGrounds[0].point.x,intersectedGrounds[0].point.y + (cone.geometry.parameters.height / 2) ,intersectedGrounds[0].point.z);
        console.log("Coords on ground = ",intersectedGrounds[0].point);
      }
    }
  }
  let intersectedObject = checkIntersects(event, "mousedown");
  if(intersectedObject !== 'undifined' & intersectedObject !== null)
  {
    // navigate to 360 view detail page
    enter360(locationsData[intersectedObject.userData.locationIndex])
  }
}

// function to get mouse coordinates
function GetMouseCoords(event) {
  let div = container; // replace 'yourDivId' with your div's ID
  let rect = div.getBoundingClientRect();

  return {
      x: event.clientX - rect.x,
      y: event.clientY - rect.y,
  };
}

// function to check if the mouse intersects with 3D objects
function checkIntersects(event, eventType) {
  event.preventDefault();

  const rect = container.getBoundingClientRect();
  let mouse = new THREE.Vector2();

  mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  let objects = lanterns;
  const intersects = raycaster.intersectObjects(objects, true);
    

  let intersected = intersects.length > 0 ? intersects[0].object : null;
  if(intersects.length > 0){
    //console.log(intersected.parent);
    return intersected.parent.parent;
  }

  //console.log(" intersects.length = ", intersects.length);
  return null;
}

// function to enter detail page
function enterDetail(locationData)
{
  console.log("Entering Detail :",locationData);

  // remove ui elements 
  let nav_detail = document.getElementById('nav_detail');
  if(nav_detail !== "undefined")
  {
    nav_detail.remove();
  }
  // stop map ambiance
  // start location ambiance
  
  // fill in the page with json data
  document.getElementById("detail_main_title").innerHTML = locationData.nom_lieu;
  document.getElementById("detail_main_text").innerHTML = locationData.description_lieu;
  // show detail page
  document.getElementById('detail').style.display = "block";
}

// function to exit detail page
function exitDetail()
{
  // stop everything happening on detail page
  
  // hide detail page
  document.getElementById('detail').style.display = "none";
}

// function to enter about page
function enterAbout()
{
  exit360();
  exitDetail();
  console.log("Entering About");
  document.getElementById('about').style.display = "block";
}

// function to exit about page
function exitAbout()
{
  document.getElementById('about').style.display = "none";
}

// function to enter 360 view
function enter360(locationData) {
  exit360();
  stopMouseEvents();
  console.log("Entering 360 :",locationData);
  // Création de la géométrie de la sphère
  const geometry = new THREE.SphereGeometry(10, 30, 30);

  // Chargement de la texture
  const texture = new THREE.TextureLoader().load("/360/"+locationData.photo_360);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = -1;

  // Création du matériau
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
  });

  // Création de la sphère
  const sphere = new THREE.Mesh(geometry, material);

  // Ajout de la sphère à la scène 360
  scene360.add(sphere);

  // Création de texte
  const locationFloatingName = new Text();
  scene360.add(locationFloatingName);

  // Configuration des propriétés du texte
  locationFloatingName.text       = locationData.nom_lieu;
  locationFloatingName.fontSize   = 1;
  locationFloatingName.anchorX    = "center";
  locationFloatingName.font       = MonserratRegular;
  locationFloatingName.position.z = -4;
  locationFloatingName.color      = 0x800020;

  // Mise à jour du rendu du texte
  locationFloatingName.sync();
  camera360.position.set(0,0,3);
  camera360.lookAt(locationFloatingName.position);

  let nav_detail                    = document.createElement('a');
  nav_detail.href                   = "contenu/lieu.html";
  nav_detail.id                     = "nav_detail";
  nav_detail.style.position         = "absolute";
  nav_detail.style.top              = "75vh";
  nav_detail.style.left             = "50vw";
  nav_detail.style.zIndex           = 9;
  nav_detail.style.outlineStyle     = "double";
  nav_detail.style.backgroundColor  = "rgba(0,0,0,0.8)";
  nav_detail.style.border           = "1px solid transparent";
  nav_detail.style.borderRadius     = "8px";
  nav_detail.style.fontSize         = "1em";
  nav_detail.style.fontWeight       = "500";
  nav_detail.style.paddingTop       = "0.6em";
  nav_detail.style.paddingBottom    = "0.6em";
  nav_detail.style.paddingLeft      = "1.2em";
  nav_detail.style.paddingRight     = "1.2em";
  nav_detail.style.transition       = "border-color 0.25s"
  nav_detail.textContent            = "Découvrir";
  container.appendChild(nav_detail);
  
  // Ajout d'un écouteur d'événements pour le clic sur le bouton de navigation
  document.getElementById('nav_detail').addEventListener('click',(event) => {
    let index = event.currentTarget.dataset.location_index;
    enterDetail(locationData);
  });
  scene.visible     = false;
  scene360.visible  = true;
  postprocessing.enabled = false;
  is360 = true;
}

// Fonction pour quitter la scène 360 et revenir à la scène principale
function exit360() {
  addMouseEvents();
  //postprocessing.enabled = true;
  is360 = false;
  // Nettoyer la scène 360
  let nav_detail = document.getElementById('nav_detail');
  if(nav_detail !== "undefined" & nav_detail !== null){
    nav_detail.remove();
  }
  scene.visible     = true;
  scene360.visible  = false;
  scene360.children = [];
  
  // Réinitialiser la caméra principale
  camera.position.set(cameraInitPos.x, cameraInitPos.y, cameraInitPos.z);
}

// may use later
function makeInstances ( geometry, material ) {

  const instanceCount = material.userData.instanceCount;

  const instanceID = new THREE.InstancedBufferAttribute(
    new Float32Array( new Array( instanceCount ).fill( 0 ).map( ( _, index ) => index ) ),
    1
  );

  geometry = new THREE.InstancedBufferGeometry().copy( geometry );
  geometry.addAttribute( 'instanceID', instanceID );
  geometry.maxInstancedCount = instanceCount;

  return geometry;

}

// function to mute all sounds
function muteAll(boolean){
  if(boolean){
    document.querySelector('#toggle_sound').innerHTML = feather.icons['volume-x'].toSvg();
  }else{
    document.querySelector('#toggle_sound').innerHTML = feather.icons['volume-2'].toSvg();
  }
  document.querySelector('#toggle_sound').dataset.muted = boolean;
  Howler.mute(boolean);
}

// helper to create any html element from valid html string
function toElement(s='',c,t=document.createElement('template'),l='length'){
  t.innerHTML=s.trim();
  c=[...t.content.childNodes];
  return c[l]>1?c:c[0]||'';
}

// scene 3D

init();
console.log("Done initializing, Scene : ",scene);
animate();

document.querySelector('#toggle_sound').addEventListener('click',(event) => {
  let target = event.currentTarget;

  console.log(target,target.dataset.muted,(target.dataset.muted === "false"));
  muteAll((target.dataset.muted === "false"));
});

document.querySelector('#nav_map').addEventListener('click',() => {
  // hide all non map div
  exitDetail();
  exitAbout();
  exit360();
});

document.querySelector('#nav_about').addEventListener('click',() => {
  enterAbout();
});
// Intro screen



let introMonitorIcon = toElement(feather.icons.monitor.toSvg());
introMonitorIcon.style.display = "inline";
let introHeadphonesIcon = toElement(feather.icons.headphones.toSvg());
introHeadphonesIcon.style.display = "inline";

document.getElementById("icon_computer").insertAdjacentElement('beforeend',introMonitorIcon)
document.getElementById("icon_headphones").insertAdjacentElement('beforeend',introHeadphonesIcon);
document.querySelector('#start').addEventListener('click',() => {
  document.querySelector('#nav_map').innerHTML = feather.icons.map.toSvg();
  muteAll(false);
  document.querySelector('#intro').style.display = 'none';
  ambientPads.play();
  ambientNight.play();
});


