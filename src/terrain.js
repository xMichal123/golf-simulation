import * as THREE from 'three';

/** One straight-ish hole: tee at +Z, green at -Z, gentle dogleg. */
export const COURSE = {
  width: 180,
  depth: 260,
  tee: { x: 16, z: 100 },
  hole: { x: -20, z: -98 },
};

const FAIRWAY_FLAT = 8;
const FAIRWAY_BLEND = 22;
const GREEN_RADIUS = 11;
const GREEN_BLEND = 18;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function fairwayCenterX(z) {
  const { tee, hole } = COURSE;
  const t = (tee.z - z) / (tee.z - hole.z);
  const curve = Math.sin(t * Math.PI) * -14;
  return tee.x + (hole.x - tee.x) * t + curve;
}

function rolling(x, z) {
  return (
    Math.sin(x * 0.045 + 0.6) * Math.cos(z * 0.031) * 2.8 +
    Math.sin(x * 0.016 - z * 0.021) * 1.9 +
    Math.cos(z * 0.055 + x * 0.012) * 0.7
  );
}

/** Designed slope: higher at the tee, a soft rise onto the green. */
function fairwayGrade(z) {
  const { tee, hole } = COURSE;
  const t = (tee.z - z) / (tee.z - hole.z);
  return 5.2 * (1 - t) + 1.8 * t + Math.sin(t * Math.PI) * 0.9;
}

function bunkerDimple(x, z, cx, cz, radius, depth) {
  const d = Math.hypot(x - cx, z - cz);
  const mask = 1 - smoothstep(radius * 0.35, radius, d);
  return mask * mask * depth;
}

export function sampleHeight(x, z) {
  const cx = fairwayCenterX(z);
  const dist = Math.abs(x - cx);
  const rough = smoothstep(FAIRWAY_FLAT, FAIRWAY_BLEND, dist);

  const grade = fairwayGrade(z);
  let height = grade + rolling(x, z) * (0.08 + rough * 0.92);

  const { hole } = COURSE;
  const greenDist = Math.hypot(x - hole.x, z - hole.z);
  const green = 1 - smoothstep(GREEN_RADIUS, GREEN_BLEND, greenDist);
  const greenHeight = fairwayGrade(hole.z) + 0.35;
  height = height * (1 - green) + greenHeight * green;

  const tee = COURSE.tee;
  const onTee =
    Math.abs(x - tee.x) < 5 && z < tee.z + 6 && z > tee.z - 4
      ? 1
      : 0;
  if (onTee) height = fairwayGrade(tee.z);

  height -= bunkerDimple(x, z, hole.x + 14, hole.z + 8, 7.5, 1.35);
  height -= bunkerDimple(x, z, hole.x - 4, hole.z + 16, 5.5, 1.05);
  height -= bunkerDimple(x, z, fairwayCenterX(10) + 16, 10, 6, 1.1);

  return height;
}

const ROUGH = new THREE.Color(0x2d5528);
const FAIRWAY = new THREE.Color(0x3d8c38);
const FRINGE = new THREE.Color(0x4e9a3e);
const GREEN = new THREE.Color(0x7ed36a);
const BUNKER = new THREE.Color(0xd2c093);
const TEE = new THREE.Color(0x4a9844);

function bunkerMask(x, z, cx, cz, radius) {
  const d = Math.hypot(x - cx, z - cz);
  return 1 - smoothstep(radius * 0.45, radius, d);
}

function sampleColor(x, z) {
  const cx = fairwayCenterX(z);
  const dist = Math.abs(x - cx);
  const rough = smoothstep(FAIRWAY_FLAT, FAIRWAY_BLEND, dist);
  const color = FAIRWAY.clone().lerp(ROUGH, rough);

  const { hole, tee } = COURSE;
  const greenDist = Math.hypot(x - hole.x, z - hole.z);
  const apron = 1 - smoothstep(GREEN_RADIUS, GREEN_BLEND + 4, greenDist);
  const putting = 1 - smoothstep(GREEN_RADIUS * 0.92, GREEN_RADIUS + 1.5, greenDist);
  color.lerp(FRINGE, apron * (1 - putting));
  color.lerp(GREEN, putting);

  const teeBox =
    1 -
    smoothstep(
      0,
      1,
      Math.max(Math.abs(x - tee.x) / 5.5, Math.abs(z - tee.z) / 4.5) - 0.65,
    );
  color.lerp(TEE, Math.max(0, teeBox) * (1 - rough));

  const sand = Math.max(
    bunkerMask(x, z, hole.x + 14, hole.z + 8, 7.5),
    bunkerMask(x, z, hole.x - 4, hole.z + 16, 5.5),
    bunkerMask(x, z, fairwayCenterX(10) + 16, 10, 6),
  );
  color.lerp(BUNKER, sand);

  return color;
}

export function createTerrain() {
  const { width, depth } = COURSE;
  const segmentsX = 180;
  const segmentsZ = 240;
  const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, sampleHeight(x, z));
    color.copy(sampleColor(x, z));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function createTrees() {
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.1, 5);
  const crownGeo = new THREE.ConeGeometry(1.15, 2.8, 6);
  trunkGeo.translate(0, 0.55, 0);
  crownGeo.translate(0, 2.3, 0);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5c3d28,
    roughness: 1,
  });
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0x1e4a2c,
    roughness: 0.9,
  });

  const spots = [];
  const { width, depth, hole } = COURSE;
  for (let i = 0; i < 420 && spots.length < 70; i++) {
    const x = (hash(i * 3.1) - 0.5) * (width - 16);
    const z = (hash(i * 7.7 + 2) - 0.5) * (depth - 16);
    const dist = Math.abs(x - fairwayCenterX(z));
    const greenDist = Math.hypot(x - hole.x, z - hole.z);
    if (dist < 26 || greenDist < 24) continue;
    spots.push({ x, z, scale: 0.75 + hash(i * 1.3) * 0.9 });
  }

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;

  const dummy = new THREE.Object3D();
  spots.forEach((spot, index) => {
    dummy.position.set(spot.x, sampleHeight(spot.x, spot.z), spot.z);
    dummy.scale.setScalar(spot.scale);
    dummy.rotation.y = hash(index * 4.2) * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    crowns.setMatrixAt(index, dummy.matrix);
  });

  const group = new THREE.Group();
  group.name = 'trees';
  group.add(trunks, crowns);
  return group;
}

export function createFlag() {
  const { hole } = COURSE;
  const ground = sampleHeight(hole.x, hole.z);
  const group = new THREE.Group();
  group.name = 'flag';
  group.position.set(hole.x, ground, hole.z);

  const cup = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }),
  );
  cup.rotation.x = -Math.PI / 2;
  cup.position.y = 0.02;
  cup.receiveShadow = true;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 }),
  );
  pole.position.y = 1.2;
  pole.castShadow = true;

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.42),
    new THREE.MeshStandardMaterial({
      color: 0xe23b3b,
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
  );
  flag.position.set(0.35, 2.15, 0);
  flag.castShadow = true;

  group.add(cup, pole, flag);
  return group;
}
