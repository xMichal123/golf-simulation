import * as THREE from 'three';
import { COURSE, sampleHeight } from './terrain.js';

const BALL_RADIUS = 0.032;
const MAX_SPEED = 58;
const GRAVITY = 13.5;
const AIR_DRAG = 0.08;
const RESTITUTION = 0.4;
const STOP_SPEED = 0.45;
const BACKSWING = 0.48;
const STRIKE = 0.14;
const IMPACT_TIME = 0.58;
const SWING_END = 0.9;

const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _ahead = new THREE.Vector3();

function clampStep(dt) {
  return Math.min(dt, 0.05);
}

function swingAngle(time) {
  if (time < BACKSWING) return -1.05 * (time / BACKSWING);
  if (time < BACKSWING + STRIKE) {
    const t = (time - BACKSWING) / STRIKE;
    return THREE.MathUtils.lerp(-1.05, 0.4, t);
  }
  const t = Math.min(1, (time - BACKSWING - STRIKE) / 0.28);
  return THREE.MathUtils.lerp(0.4, 0, t);
}

function rotateY(x, z, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    x: x * c + z * s,
    z: -x * s + z * c,
  };
}

export function readShotPower(button) {
  const fill = button.querySelector('.shot-fill');
  const transform = getComputedStyle(fill).transform;
  if (!transform || transform === 'none') return 0;
  const values = transform.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!values) return 0;
  return THREE.MathUtils.clamp(Number(values[0]), 0, 1);
}

export function createShotController({ scene, camera, controls, golfer, shotButton }) {
  const ball = golfer.getObjectByName('ball');
  const peg = golfer.getObjectByName('peg');
  const sprite = golfer.getObjectByName('golfer-sprite');
  const ballHome = ball.position.clone();
  const spriteRest = sprite.position.clone();
  const velocity = new THREE.Vector3();
  const horizontal = new THREE.Vector3();

  let mode = 'ready';
  let swingTime = 0;
  let flightTime = 0;
  let launched = false;
  let lockedYaw = 0;
  let walk = null;

  function setActionsEnabled(enabled) {
    controls.enabled = enabled;
    shotButton.disabled = !enabled;
  }

  function aimFromCamera() {
    camera.getWorldDirection(_ahead);
    if (_ahead.lengthSq() < 1e-8) _ahead.set(0, 0, -1);
    else _ahead.normalize();
    const direction = _ahead.clone();
    const ahead = new THREE.Vector3(direction.x, 0, direction.z);
    if (ahead.lengthSq() < 1e-8) ahead.set(0, 0, -1);
    else ahead.normalize();
    return { horizontal: ahead, direction };
  }

  function begin(power) {
    if (mode !== 'ready') return;
    const aim = aimFromCamera();
    horizontal.copy(aim.horizontal);
    velocity.copy(aim.direction).multiplyScalar(Math.max(0, power) * MAX_SPEED);
    lockedYaw = golfer.rotation.y;
    launched = false;
    swingTime = 0;
    flightTime = 0;
    mode = 'swing';
    setActionsEnabled(false);
  }

  function poseSwing(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    sprite.position.set(
      spriteRest.x * c + spriteRest.z * s,
      spriteRest.y,
      -spriteRest.x * s + spriteRest.z * c,
    );
    sprite.rotation.y = angle;
    sprite.rotation.z = 0;
  }

  function launch() {
    launched = true;
    if (peg) peg.visible = false;
    scene.attach(ball);
    const ground = sampleHeight(ball.position.x, ball.position.z) + BALL_RADIUS;
    if (ball.position.y < ground) ball.position.y = ground;
  }

  function onGround(position) {
    return position.y <= sampleHeight(position.x, position.z) + BALL_RADIUS + 0.01;
  }

  function stepPhysics(dt) {
    velocity.y -= GRAVITY * dt;
    velocity.multiplyScalar(Math.max(0, 1 - AIR_DRAG * dt));
    ball.position.addScaledVector(velocity, dt);

    const halfW = COURSE.width / 2 - 1;
    const halfD = COURSE.depth / 2 - 1;
    if (ball.position.x <= -halfW || ball.position.x >= halfW) velocity.x = 0;
    if (ball.position.z <= -halfD || ball.position.z >= halfD) velocity.z = 0;
    ball.position.x = THREE.MathUtils.clamp(ball.position.x, -halfW, halfW);
    ball.position.z = THREE.MathUtils.clamp(ball.position.z, -halfD, halfD);

    const ground = sampleHeight(ball.position.x, ball.position.z) + BALL_RADIUS;
    if (ball.position.y > ground) return false;

    ball.position.y = ground;
    if (velocity.y < 0) velocity.y *= -RESTITUTION;

    const slope = 0.4;
    const dropX = sampleHeight(ball.position.x - slope, ball.position.z)
      - sampleHeight(ball.position.x + slope, ball.position.z);
    const dropZ = sampleHeight(ball.position.x, ball.position.z - slope)
      - sampleHeight(ball.position.x, ball.position.z + slope);
    velocity.x += (dropX / (slope * 2)) * 8 * dt;
    velocity.z += (dropZ / (slope * 2)) * 8 * dt;

    const drag = Math.min(1, 1.4 * dt);
    velocity.x *= 1 - drag;
    velocity.z *= 1 - drag;

    return velocity.length() < STOP_SPEED;
  }

  function followBall(dt) {
    _desired.copy(ball.position).addScaledVector(horizontal, -7);
    _desired.y = Math.max(
      ball.position.y + 2.4,
      sampleHeight(_desired.x, _desired.z) + 1.4,
    );
    const blend = 1 - Math.exp(-8 * dt);
    camera.position.lerp(_desired, blend);
    _look.copy(ball.position);
    _look.y += 0.4;
    camera.lookAt(_look);
  }

  function stanceAt(rest) {
    const toHole = new THREE.Vector3(COURSE.hole.x - rest.x, 0, COURSE.hole.z - rest.z);
    if (toHole.lengthSq() < 0.25) toHole.set(0, 0, -1);
    toHole.normalize();
    const yaw = Math.atan2(-toHole.x, -toHole.z);
    const offset = rotateY(ballHome.x, ballHome.z, yaw);
    const stance = new THREE.Vector3(
      rest.x - offset.x,
      0,
      rest.z - offset.z,
    );
    stance.y = sampleHeight(stance.x, stance.z);
    return { stance, yaw, toHole };
  }

  function finishWalk() {
    golfer.position.copy(walk.stance);
    golfer.rotation.y = walk.yaw;
    golfer.rotation.z = 0;
    poseSwing(0);
    golfer.attach(ball);
    ball.position.copy(ballHome);
    ball.rotation.set(0, 0, 0);
    velocity.set(0, 0, 0);

    controls.target.set(walk.stance.x, walk.stance.y + 1.05, walk.stance.z);
    camera.position.set(
      walk.stance.x - walk.toHole.x * 6.5,
      walk.stance.y + 1.55,
      walk.stance.z - walk.toHole.z * 6.5,
    );
    controls.update();
    walk = null;
    mode = 'ready';
    setActionsEnabled(true);
  }

  function startWalk() {
    const rest = ball.position.clone();
    rest.y = sampleHeight(rest.x, rest.z) + BALL_RADIUS;
    ball.position.copy(rest);
    const { stance, yaw, toHole } = stanceAt(rest);
    walk = {
      time: 0,
      duration: THREE.MathUtils.clamp(golfer.position.distanceTo(stance) / 3.5, 0.45, 1.5),
      from: golfer.position.clone(),
      stance,
      yaw,
      toHole,
      yawFrom: golfer.rotation.y,
      camFrom: camera.position.clone(),
      lookFrom: rest.clone(),
    };
    mode = 'walk';
  }

  function updateWalk(dt) {
    walk.time += dt;
    const t = Math.min(1, walk.time / walk.duration);
    const eased = t * t * (3 - 2 * t);
    golfer.position.lerpVectors(walk.from, walk.stance, eased);
    golfer.position.y = sampleHeight(golfer.position.x, golfer.position.z);
    golfer.rotation.y = walk.yawFrom + Math.atan2(
      Math.sin(walk.yaw - walk.yawFrom),
      Math.cos(walk.yaw - walk.yawFrom),
    ) * eased;

    const camTo = new THREE.Vector3(
      walk.stance.x - walk.toHole.x * 6.5,
      walk.stance.y + 1.55,
      walk.stance.z - walk.toHole.z * 6.5,
    );
    camera.position.lerpVectors(walk.camFrom, camTo, eased);
    _look.copy(walk.lookFrom).lerp(walk.stance, eased);
    _look.y += 1.05;
    camera.lookAt(_look);

    if (t >= 1) finishWalk();
  }

  function update(dt) {
    const step = clampStep(dt);
    if (mode === 'swing') {
      swingTime += step;
      golfer.rotation.y = lockedYaw;
      poseSwing(swingAngle(swingTime));
      if (!launched && swingTime >= IMPACT_TIME) launch();
      if (swingTime >= SWING_END) {
        poseSwing(0);
        mode = 'flight';
      }
      return;
    }

    if (mode === 'flight') {
      flightTime += step;
      let stopped = velocity.lengthSq() < 1e-6 && onGround(ball.position);
      let left = step;
      while (!stopped && left > 0) {
        const h = Math.min(1 / 90, left);
        left -= h;
        if (stepPhysics(h)) stopped = true;
      }
      followBall(step);
      if (stopped || flightTime > 14) startWalk();
      return;
    }

    if (mode === 'walk') updateWalk(step);
  }

  return {
    begin,
    update,
    isReady: () => mode === 'ready',
  };
}
