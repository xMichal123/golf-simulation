import * as THREE from 'three';
import { faceGolferToCamera } from './golfer.js';
import { COURSE, sampleHeight } from './terrain.js';

const BALL_RADIUS = 0.032;
const MAX_SPEED = 58;
const GRAVITY = 13.5;
const AIR_DRAG = 0.08;
const RESTITUTION = 0.4;
const STOP_SPEED = 0.45;
const HOLE_RADIUS = 0.55;
const HOLE_SPEED = 1.25;
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

export function createShotController({ scene, camera, controls, golfer, shotButton, winBanner }) {
  const ball = golfer.getObjectByName('ball');
  const peg = golfer.getObjectByName('peg');
  const sprite = golfer.getObjectByName('golfer-sprite');
  const shadow = golfer.getObjectByName('golfer-shadow');
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
  let strokes = 0;
  let won = false;
  let celebrateTime = 0;

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
    strokes += 1;
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

  function restoreSprite() {
    poseSwing(0);
    sprite.scale.set(1, 1, 1);
    if (shadow) {
      shadow.scale.set(1, 1, 1);
      shadow.material.opacity = 0.22;
    }
  }

  function ballInHole() {
    if (velocity.length() > HOLE_SPEED) return false;
    if (!onGround(ball.position)) return false;
    const dx = ball.position.x - COURSE.hole.x;
    const dz = ball.position.z - COURSE.hole.z;
    return dx * dx + dz * dz <= HOLE_RADIUS * HOLE_RADIUS;
  }

  function showWin() {
    won = true;
    winBanner.textContent = strokes === 1 ? 'Hole in one' : `Hole in ${strokes}`;
    winBanner.hidden = false;
    shotButton.classList.remove('is-pressed');
    shotButton.classList.add('is-replay');
    shotButton.disabled = false;
    shotButton.setAttribute('aria-label', 'Play again');
    controls.enabled = false;
  }

  function clearWin() {
    won = false;
    winBanner.hidden = true;
    shotButton.classList.remove('is-replay', 'is-pressed');
    shotButton.setAttribute('aria-label', 'Shot power');
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
    golfer.position.y = sampleHeight(golfer.position.x, golfer.position.z);
    if (won) {
      restoreSprite();
      walk = null;
      mode = 'celebrate';
      celebrateTime = 0;
      faceGolferToCamera(golfer, camera);
      return;
    }

    golfer.rotation.y = walk.yaw;
    golfer.rotation.z = 0;
    restoreSprite();
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

  function beginWalk(stance, yaw, toHole, lookFrom, camDistance = 6.5) {
    walk = {
      time: 0,
      duration: THREE.MathUtils.clamp(golfer.position.distanceTo(stance) / 3.5, 0.45, 1.5),
      from: golfer.position.clone(),
      stance,
      yaw,
      toHole,
      yawFrom: golfer.rotation.y,
      camFrom: camera.position.clone(),
      lookFrom: lookFrom.clone(),
      camDistance,
    };
    mode = 'walk';
  }

  function startWalk() {
    const rest = ball.position.clone();
    rest.y = sampleHeight(rest.x, rest.z) + BALL_RADIUS;
    ball.position.copy(rest);
    const { stance, yaw, toHole } = stanceAt(rest);
    beginWalk(stance, yaw, toHole, rest);
  }

  function holeSideStance() {
    const { hole } = COURSE;
    const away = new THREE.Vector3(golfer.position.x - hole.x, 0, golfer.position.z - hole.z);
    if (away.lengthSq() < 0.25) away.set(1.35, 0, 0.55);
    else away.setLength(1.7);
    const stance = new THREE.Vector3(hole.x + away.x, 0, hole.z + away.z);
    stance.y = sampleHeight(stance.x, stance.z);
    const toHole = away.clone().negate().normalize();
    const yaw = Math.atan2(-toHole.x, -toHole.z);
    return { stance, yaw, toHole };
  }

  function startWin() {
    velocity.set(0, 0, 0);
    ball.position.y = sampleHeight(ball.position.x, ball.position.z) + BALL_RADIUS;
    showWin();
    const { stance, yaw, toHole } = holeSideStance();
    beginWalk(stance, yaw, toHole, ball.position, 4.8);
  }

  function updateCelebrate(dt) {
    celebrateTime += dt;
    const hop = Math.sin(((celebrateTime % 0.62) / 0.62) * Math.PI);
    sprite.position.y = spriteRest.y + hop * 0.7;
    sprite.scale.set(1 - hop * 0.04, 1 + hop * 0.07, 1);
    if (shadow) {
      const shade = 1 - hop * 0.4;
      shadow.scale.setScalar(Math.max(0.45, shade));
      shadow.material.opacity = 0.22 * shade;
    }
    faceGolferToCamera(golfer, camera);
    _look.set(golfer.position.x, golfer.position.y + 1.15 + hop * 0.25, golfer.position.z);
    camera.lookAt(_look);
  }

  function replay() {
    if (!won) return;
    clearWin();
    walk = null;
    launched = false;
    swingTime = 0;
    flightTime = 0;
    celebrateTime = 0;
    strokes = 0;
    velocity.set(0, 0, 0);
    restoreSprite();

    const { tee } = COURSE;
    const y = sampleHeight(tee.x, tee.z);
    golfer.position.set(tee.x, y, tee.z);
    golfer.rotation.set(0, 0, 0);
    if (peg) peg.visible = true;
    golfer.attach(ball);
    ball.position.copy(ballHome);
    ball.rotation.set(0, 0, 0);

    const toHole = new THREE.Vector3(COURSE.hole.x - tee.x, 0, COURSE.hole.z - tee.z).normalize();
    controls.target.set(tee.x, y + 1.05, tee.z);
    camera.position.set(tee.x - toHole.x * 6.5, y + 1.55, tee.z - toHole.z * 6.5);
    controls.update();
    mode = 'ready';
    setActionsEnabled(true);
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
      walk.stance.x - walk.toHole.x * walk.camDistance,
      walk.stance.y + 1.55,
      walk.stance.z - walk.toHole.z * walk.camDistance,
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
      let holed = ballInHole();
      let left = step;
      while (!stopped && !holed && left > 0) {
        const h = Math.min(1 / 90, left);
        left -= h;
        if (stepPhysics(h)) stopped = true;
        if (ballInHole()) holed = true;
      }
      if (holed) {
        startWin();
        return;
      }
      followBall(step);
      if (stopped || flightTime > 14) startWalk();
      return;
    }

    if (mode === 'walk') {
      updateWalk(step);
      return;
    }

    if (mode === 'celebrate') updateCelebrate(step);
  }

  return {
    begin,
    update,
    replay,
    isReady: () => mode === 'ready',
    isWon: () => won,
  };
}
