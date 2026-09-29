import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
camera.position.set(COURSE.tee.x + 8, 16, COURSE.tee.z + 28);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(COURSE.tee.x - 6, 2, COURSE.tee.z - 40);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 8;
controls.maxDistance = 180;
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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function frame() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

frame();
