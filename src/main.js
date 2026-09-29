import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGolfer, faceGolferToCamera } from './golfer.js';
import { createShotController, readShotPower } from './shot.js';
import { COURSE, createFlag, createTerrain, createTrees } from './terrain.js';
import './style.css';

const app = document.querySelector('#app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec5ef);
scene.fog = new THREE.Fog(0x9ec8ee, 90, 320);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  600,
);
const golfer = createGolfer();
const toHole = new THREE.Vector3(
  COURSE.hole.x - golfer.position.x,
  0,
  COURSE.hole.z - golfer.position.z,
).normalize();
const viewDistance = 6.5;
camera.position.set(
  golfer.position.x - toHole.x * viewDistance,
  golfer.position.y + 1.55,
  golfer.position.z - toHole.z * viewDistance,
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(golfer.position.x, golfer.position.y + 1.05, golfer.position.z);
controls.enableDamping = true;
controls.enablePan = false;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI / 2 + 0.85;
controls.minDistance = 3.2;
controls.maxDistance = 48;
controls.update();

const hemi = new THREE.HemisphereLight(0xc5e4ff, 0x3e6a34, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3dd, 2.4);
sun.position.set(70, 90, 50);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 280;
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 140;
sun.shadow.camera.bottom = -140;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);
scene.add(sun.target);

scene.add(createTerrain());
scene.add(createTrees());
scene.add(createFlag());
scene.add(golfer);

const shotButton = document.querySelector('#shot-button');
const shot = createShotController({
  scene,
  camera,
  controls,
  golfer,
  shotButton,
});
shotButton.addEventListener('pointerdown', (event) => {
  if (!shot.isReady()) return;
  shotButton.setPointerCapture(event.pointerId);
  shotButton.classList.add('is-pressed');
});

function releaseShotButton() {
  if (!shotButton.classList.contains('is-pressed')) return;
  const power = readShotPower(shotButton);
  shotButton.classList.remove('is-pressed');
  shot.begin(power);
}

shotButton.addEventListener('pointerup', releaseShotButton);
shotButton.addEventListener('pointercancel', releaseShotButton);
shotButton.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (shot.isReady()) {
    controls.update();
    faceGolferToCamera(golfer, camera);
  } else {
    shot.update(dt);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
