import * as THREE from 'three';
import { COURSE, sampleHeight } from './terrain.js';

const CANVAS = 512;
const SPRITE_SIZE = 2.25;
/** Stance pivot and club head, in sprite pixels. The golfer faces texture-right. */
const FEET_X = 196;
const FEET_Y = 470;
const CLUB_X = 392;
const CLUB_Y = 458;

const INK = '#1a2330';

function shape(ctx, fill, points, width = 7) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.fill();
  ctx.stroke();
}

function drawGolfer(ctx) {
  ctx.clearRect(0, 0, CANVAS, CANVAS);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.strokeStyle = '#c5cad1';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(300, 312);
  ctx.lineTo(CLUB_X - 18, CLUB_Y - 8);
  ctx.stroke();

  shape(ctx, '#e4e7ec', [
    [CLUB_X - 22, CLUB_Y - 16],
    [CLUB_X + 18, CLUB_Y - 10],
    [CLUB_X + 14, CLUB_Y + 8],
    [CLUB_X - 26, CLUB_Y + 2],
  ]);

  shape(ctx, '#3c5168', [
    [146, 468],
    [188, 468],
    [184, 446],
    [176, 390],
    [198, 328],
    [228, 336],
    [214, 400],
    [206, 450],
    [198, 470],
  ]);
  shape(ctx, '#f4f1ea', [
    [148, 458],
    [196, 456],
    [194, 470],
    [142, 472],
  ], 5);

  shape(ctx, '#314559', [
    [214, 468],
    [268, 466],
    [286, 448],
    [292, 392],
    [270, 330],
    [236, 324],
    [228, 360],
    [236, 430],
    [228, 468],
  ]);
  shape(ctx, '#f4f1ea', [
    [220, 456],
    [276, 452],
    [272, 470],
    [214, 472],
  ], 5);

  shape(ctx, '#f7f5f0', [
    [188, 332],
    [176, 250],
    [196, 196],
    [250, 188],
    [286, 230],
    [268, 300],
    [236, 338],
  ]);
  shape(ctx, '#1f4f8a', [
    [196, 214],
    [248, 206],
    [262, 228],
    [210, 240],
  ], 5);

  shape(ctx, '#e7b48f', [
    [232, 214],
    [268, 250],
    [312, 318],
    [292, 342],
    [248, 270],
    [214, 230],
  ]);
  shape(ctx, '#2a2a2a', [
    [286, 300],
    [318, 312],
    [314, 336],
    [278, 328],
  ], 5);

  shape(ctx, '#e7b48f', [
    [214, 168],
    [206, 132],
    [236, 108],
    [286, 124],
    [300, 156],
    [286, 196],
    [246, 204],
  ]);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(268, 154, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  shape(ctx, '#1f4f8a', [
    [198, 148],
    [214, 104],
    [268, 92],
    [300, 112],
    [286, 132],
    [236, 128],
    [214, 150],
  ], 6);
  shape(ctx, '#1f4f8a', [
    [268, 112],
    [348, 132],
    [340, 152],
    [262, 140],
  ], 6);

  shape(ctx, '#e7b48f', [
    [292, 328],
    [324, 322],
    [330, 344],
    [300, 350],
  ], 5);
}

function pixelOffsetX(px) {
  return ((px - CANVAS / 2) / CANVAS) * SPRITE_SIZE;
}

function pixelOffsetY(py) {
  return ((CANVAS / 2 - py) / CANVAS) * SPRITE_SIZE;
}

function createSpriteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS;
  canvas.height = CANVAS;
  drawGolfer(canvas.getContext('2d'));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function createGolfer() {
  const { tee } = COURSE;
  const group = new THREE.Group();
  group.name = 'golfer';
  group.position.set(tee.x, sampleHeight(tee.x, tee.z), tee.z);

  const material = new THREE.MeshBasicMaterial({
    map: createSpriteTexture(),
    transparent: true,
    alphaTest: 0.4,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  const sprite = new THREE.Mesh(new THREE.PlaneGeometry(SPRITE_SIZE, SPRITE_SIZE), material);
  sprite.name = 'golfer-sprite';
  sprite.position.set(-pixelOffsetX(FEET_X), -pixelOffsetY(FEET_Y), 0.2);
  sprite.castShadow = true;
  group.add(sprite);

  const ballX = ((CLUB_X + 8 - FEET_X) / CANVAS) * SPRITE_SIZE;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }),
  );
  ball.name = 'ball';
  ball.position.set(ballX, 0.048, -0.2);
  ball.castShadow = true;
  group.add(ball);

  const peg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.007, 0.045, 6),
    new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.6 }),
  );
  peg.position.set(ballX, 0.02, -0.2);
  group.add(peg);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 24),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.renderOrder = 1;
  group.add(shadow);

  return group;
}

/** Yaw the side-view sprite so it faces the camera. Local +X stays the shot direction. */
export function faceGolferToCamera(golfer, camera) {
  golfer.rotation.y = Math.atan2(
    camera.position.x - golfer.position.x,
    camera.position.z - golfer.position.z,
  );
}
