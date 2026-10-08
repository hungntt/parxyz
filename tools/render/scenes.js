// Procedural concept renders for the Parxyz website.
// Open index.html?scene=guardian|guardianDetail|steady|home&w=1400&h=1800 through a local web server;
// capture.mjs saves the canvas as a transparent PNG.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const q = new URLSearchParams(location.search);
const W = +q.get("w") || 1400;
const H = +q.get("h") || 1800;
const NAME = q.get("scene") || "guardian";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

const TEAL = "#8ff0e0";
const CORAL = "#ffb09c";

// ---------- Procedural textures ----------

function heightToNormal(h, size, strength) {
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let nx = (at(x - 1, y) - at(x + 1, y)) * strength;
      let ny = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  return tex;
}

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// Stockinette knit: rows of interlocking "V" stitches plus a little fibre fuzz.
function knitNormalMap(size = 512, cells = 16, strength = 3.2) {
  const rand = rng(11);
  const h = new Float32Array(size * size);
  const lobe = (dx, dy, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const rx = dx * c - dy * s, ry = dx * s + dy * c;
    const d = (rx / 0.2) ** 2 + (ry / 0.46) ** 2;
    return d < 1 ? Math.sqrt(1 - d) : 0;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * cells, v = (y / size) * cells;
      const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5;
      let m = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          m = Math.max(m, lobe(fu - ox + 0.19, fv - oy, 0.5), lobe(fu - ox - 0.19, fv - oy, -0.5));
        }
      }
      h[y * size + x] = Math.pow(m, 0.8) + rand() * 0.05;
    }
  }
  return heightToNormal(h, size, strength);
}

// Fine horizontal ribbing.
function ribNormalMap(size = 256, ribs = 16, strength = 2.4) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = Math.abs(Math.sin((y / size) * Math.PI * ribs));
    for (let x = 0; x < size; x++) h[y * size + x] = Math.pow(v, 0.6);
  }
  return heightToNormal(h, size, strength);
}

const KNIT = knitNormalMap();
const RIB = ribNormalMap();

function fabric(color, rx, ry, { map = KNIT, ns = 0.65, sheen = "#ffffff", rough = 0.95 } = {}) {
  const n = map.clone();
  n.repeat.set(rx, ry);
  n.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0,
    sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(sheen),
    normalMap: n, normalScale: new THREE.Vector2(ns, ns),
  });
}

function glossyBlack() {
  return new THREE.MeshPhysicalMaterial({ color: "#0c0e10", roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14 });
}

function radialTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glow(color, size, opacity = 0.5) {
  const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const tex = radialTexture([[0, `rgba(${rgb},1)`], [0.25, `rgba(${rgb},0.45)`], [1, `rgba(${rgb},0)`]]);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.set(size, size, 1);
  return s;
}

// ---------- Staging ----------

function ground(opacity = 0.2) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity }));
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  scene.add(g);
}

function contactShadow(rx, rz, opacity = 0.5, x = 0, z = 0) {
  const tex = radialTexture([[0, `rgba(0,0,0,${opacity})`], [0.45, `rgba(0,0,0,${opacity * 0.4})`], [1, "rgba(0,0,0,0)"]]);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.002, z);
  scene.add(m);
}

function lights({ key = [-3, 6, 4], keyI = 2.2, rim = [3.5, 3, -4], rimI = 1.4, warm = "#fff6ec" } = {}) {
  const d = new THREE.DirectionalLight(warm, keyI);
  d.position.set(...key);
  d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048);
  Object.assign(d.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 30 });
  d.shadow.radius = 16;
  d.shadow.blurSamples = 25;
  d.shadow.bias = -0.0004;
  scene.add(d);
  const r = new THREE.DirectionalLight("#ffffff", rimI);
  r.position.set(...rim);
  scene.add(r);
  scene.add(new THREE.HemisphereLight("#ffffff", "#d9d2c6", 0.3));
}

// Electrocardiogram-like pulse, t in [0, 1] -> vertical offset.
function pulse(t) {
  const g = (c, w, a) => a * Math.exp(-(((t - c) / w) ** 2));
  let y = g(0.27, 0.035, 0.14) + g(0.7, 0.05, 0.24);
  const k = [[0.44, 0], [0.465, -0.16], [0.5, 1], [0.535, -0.38], [0.565, 0]];
  for (let i = 0; i < k.length - 1; i++) {
    const [t0, y0] = k[i], [t1, y1] = k[i + 1];
    if (t >= t0 && t <= t1) y += y0 + ((t - t0) / (t1 - t0)) * (y1 - y0);
  }
  return y;
}

function pulseLine(pointAt, { radius = 0.0055, color = TEAL, glowR = 0.018, dot = true, wave = pulse } = {}) {
  const pts = [];
  for (let i = 0; i <= 400; i++) pts.push(pointAt(i / 400, wave(i / 400)));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 800, radius, 10), new THREE.MeshBasicMaterial({ color, toneMapped: false })));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 400, glowR, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  if (dot) {
    const end = pts[pts.length - 1];
    const d = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.6, 24, 16), new THREE.MeshBasicMaterial({ color: CORAL, toneMapped: false }));
    d.position.copy(end);
    g.add(d);
    const gl = glow(CORAL, radius * 18, 0.55);
    gl.position.copy(end);
    g.add(gl);
  }
  return g;
}

function superellipseAlpha(n = 4, fill = 0.94) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#fff";
  g.beginPath();
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n);
    const y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n);
    const px = 256 + x * 256 * fill, py = 256 + y * 256 * fill;
    i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
  }
  g.fill();
  return new THREE.CanvasTexture(c);
}

// ---------- Objects ----------

function makeGuardian({ color = "#c9bdab", wave = pulse, lineColor = TEAL, arms = false } = {}) {
  const root = new THREE.Group();

  const profile = new THREE.SplineCurve([
    new THREE.Vector2(0.001, 0.04), new THREE.Vector2(0.55, 0.04), new THREE.Vector2(0.65, 0.09),
    new THREE.Vector2(0.69, 0.24), new THREE.Vector2(0.68, 0.48), new THREE.Vector2(0.61, 0.74),
    new THREE.Vector2(0.47, 0.96), new THREE.Vector2(0.3, 1.1), new THREE.Vector2(0.17, 1.16), new THREE.Vector2(0.001, 1.18),
  ]).getPoints(160);
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 200), fabric(color, 18, 4.2));
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // soft-touch base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.58, 0.05, 96), new THREE.MeshPhysicalMaterial({ color: "#3a3936", roughness: 0.55 }));
  base.position.y = 0.025;
  base.castShadow = true;
  root.add(base);

  // ribbed neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.2, 96, 1, true), fabric("#c4bcae", 4, 1, { map: RIB }));
  neck.position.y = 1.2;
  neck.castShadow = true;
  root.add(neck);

  const headR = 0.46;
  const head = new THREE.Group();
  head.position.set(0, 1.64, 0);
  head.rotation.set(0.1, -0.42, 0.12);
  const shell = new THREE.Group();
  shell.scale.set(1, 0.95, 0.97);
  head.add(shell);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(headR, 160, 120), fabric(color, 14, 5));
  skull.castShadow = true;
  shell.add(skull);

  const phiLen = 1.85, thetaLen = 0.95, thetaC = Math.PI / 2 - 0.04;
  const visorMat = glossyBlack();
  visorMat.alphaMap = superellipseAlpha(3.2);
  visorMat.alphaTest = 0.5;
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.006, 160, 96, Math.PI / 2 - phiLen / 2, phiLen, thetaC - thetaLen / 2, thetaLen),
    visorMat,
  );
  shell.add(visor);

  const onHead = (r) => (t, y) => {
    const phi = Math.PI / 2 + (t - 0.5) * 1.25;
    const theta = thetaC + 0.06 - y * 0.2;
    return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
  };
  shell.add(pulseLine(onHead(headR * 1.012), { wave, color: lineColor }));
  root.add(head);

  if (arms) {
    // short, chubby arms: one resting on the belly, one raised to present a sensor
    const knit = fabric(color, 5, 3);
    const limb = (side, rot) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.5, 0.86, 0.02);
      shoulder.rotation.set(rot[0], rot[1], rot[2], "YXZ");
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.15, 48, 32), knit);
      joint.castShadow = true;
      shoulder.add(joint);
      shoulder.add(capsule(0.13, 0.26, knit));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.145, 48, 32), knit);
      hand.position.y = -0.34;
      hand.scale.set(1, 0.92, 0.9);
      hand.castShadow = true;
      shoulder.add(hand);
      root.add(shoulder);
      return hand;
    };
    limb(-1, [-0.3, 0, -0.5]);
    const palm = limb(1, [-1.15, 0.45, 0.25]);
    root.updateMatrixWorld(true);
    root.userData.palm = palm.getWorldPosition(new THREE.Vector3());
  }
  return root;
}

// Slow, even wave for Steady's face: a calm breathing rhythm rather than a heartbeat.
function breath(t) {
  const env = Math.sin(Math.PI * t) ** 1.5;
  return 0.42 * env * Math.sin(2 * Math.PI * 2.25 * t);
}

function capsule(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, len, 12, 48);
  g.translate(0, -len / 2, 0); // pivot at the top cap centre
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

// Capsule spanning two points, for limbs posed by joint positions.
function limbBetween(a, b, r, mat) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(len, 0.001), 12, 48), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Two-bone IK: elbow/knee position for a limb from s to t, bending towards pole.
function solveElbow(s, t, l1, l2, pole) {
  const d = Math.min(s.distanceTo(t), l1 + l2 - 1e-3);
  const dir = t.clone().sub(s).normalize();
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return s.clone().add(dir.multiplyScalar(a)).add(p.multiplyScalar(h));
}

function makeArmchair(color = "#c8a083") {
  const chair = new THREE.Group();
  const cloth = fabric(color, 3, 3, { ns: 0.5 });
  const box = (w, h, d, r, x, y, z) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 8, r), cloth);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    chair.add(m);
  };
  box(1.3, 0.62, 1.2, 0.12, 0, 0.39, 0);        // base
  box(1.08, 0.3, 1.05, 0.13, 0, 0.82, 0.04);   // seat cushion
  box(1.3, 1.3, 0.32, 0.15, 0, 1.2, -0.5);     // backrest
  box(0.26, 0.52, 1.2, 0.12, -0.6, 0.94, 0);   // armrests
  box(0.26, 0.52, 1.2, 0.12, 0.6, 0.94, 0);
  const wood = new THREE.MeshPhysicalMaterial({ color: "#5b4636", roughness: 0.5 });
  [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 16), wood);
    leg.position.set(x, 0.05, z);
    chair.add(leg);
  });
  return chair;
}

// A stylised older adult, seated in the chair's local frame (facing +z).
// handTarget (chair-local) is where the reaching (left) hand should rest.
function makeSeatedPerson(seat, handTarget) {
  const sweater = fabric("#9aa58f", 6, 6);
  const trousers = fabric("#7d7468", 4, 4, { ns: 0.4 });
  const skin = new THREE.MeshPhysicalMaterial({ color: "#dfbca2", roughness: 0.62, sheen: 0.4, sheenColor: new THREE.Color("#fff1e6") });
  const hairMat = fabric("#d4d3cf", 10, 6, { map: RIB, ns: 0.5 });
  const shoeMat = new THREE.MeshPhysicalMaterial({ color: "#5f5a54", roughness: 0.7 });
  const add = (m) => { m.castShadow = m.receiveShadow = true; seat.add(m); return m; };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  // legs
  [-1, 1].forEach((side) => {
    const hip = v(side * 0.17, 1.12, -0.22), knee = v(side * 0.2, 1.13, 0.6), ankle = v(side * 0.21, 0.24, 0.7);
    add(limbBetween(hip, knee, 0.155, trousers));
    add(limbBetween(knee, ankle, 0.13, trousers));
    const shoe = add(new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.14, 0.36, 6, 0.06), shoeMat));
    shoe.position.set(side * 0.21, 0.08, 0.8);
  });
  const pelvis = add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), trousers));
  pelvis.scale.set(0.37, 0.22, 0.32);
  pelvis.position.set(0, 1.16, -0.2);

  // torso, leaning a little forward and turned toward the robot
  const torso = new THREE.Group();
  torso.position.set(0, 1.12, -0.22);
  torso.rotation.set(0.16, 0.42, 0, "YXZ");
  seat.add(torso);
  const prof = new THREE.SplineCurve([
    new THREE.Vector2(0.33, 0), new THREE.Vector2(0.35, 0.25), new THREE.Vector2(0.39, 0.55),
    new THREE.Vector2(0.39, 0.78), new THREE.Vector2(0.3, 0.95), new THREE.Vector2(0.14, 1.02), new THREE.Vector2(0.001, 1.04),
  ]).getPoints(120);
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 160), sweater);
  body.scale.set(1, 1, 0.74);
  body.castShadow = body.receiveShadow = true;
  torso.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.22, 32), skin);
  neck.position.y = 1.1;
  torso.add(neck);

  // head with grey hair, a bun and round glasses
  const head = new THREE.Group();
  head.position.set(0, 1.46, 0.02);
  head.rotation.set(0.22, 0.38, 0.05, "YXZ");
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.31, 96, 64), skin);
  skull.scale.set(0.94, 1.05, 1);
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 96, 64, 0, Math.PI * 2, 0, 1.45), hairMat);
  hair.scale.set(0.95, 1.06, 1.02);
  hair.rotation.x = -0.42;
  hair.castShadow = true;
  head.add(hair);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 48, 32), hairMat);
  bun.position.set(0, 0.2, -0.27);
  head.add(bun);
  const frame = new THREE.MeshPhysicalMaterial({ color: "#3b3936", roughness: 0.35 });
  [-1, 1].forEach((side) => {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.011, 16, 48), frame);
    lens.position.set(side * 0.1, 0.0, 0.3);
    lens.rotation.y = side * 0.18;
    head.add(lens);
  });
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8), frame);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 0.015, 0.315);
  head.add(bridge);

  // arms: left reaches the robot, right rests on the lap
  seat.updateMatrixWorld(true);
  const toSeat = (obj, p) => seat.worldToLocal(obj.localToWorld(p.clone()));
  const shoulderL = toSeat(torso, v(0.36, 0.86, 0)), shoulderR = toSeat(torso, v(-0.36, 0.86, 0));
  const arm = (shoulder, hand, pole) => {
    const elbow = solveElbow(shoulder, hand, 0.6, 0.56, pole);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.125, 32, 24), sweater)).position.copy(shoulder);
    add(limbBetween(shoulder, elbow, 0.115, sweater));
    add(limbBetween(elbow, hand, 0.1, sweater));
    const h = add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skin));
    h.scale.set(0.1, 0.075, 0.12);
    h.position.copy(hand);
  };
  arm(shoulderL, handTarget, v(0.6, -1, -0.2));
  arm(shoulderR, v(-0.1, 1.34, 0.32), v(-1, -0.6, 0));
}

function sensorPod(kind) {
  const g = new THREE.Group();
  const ceramic = new THREE.MeshPhysicalMaterial({ color: "#f4f2ee", roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  let led = new THREE.Vector3(0, 0, 0);
  if (kind === "pebble") {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), ceramic);
    m.scale.set(0.085, 0.04, 0.085);
    g.add(m);
    led.set(0, 0.04, 0);
  } else if (kind === "ring") {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 32, 96), ceramic));
    led.set(0, 0.062, 0.012);
  } else if (kind === "patch") {
    g.add(new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.11, 0.024, 6, 0.012), ceramic));
    const win = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.05, 0.006, 4, 0.003), glossyBlack());
    win.position.z = 0.013;
    g.add(win);
    led.set(0.065, 0.025, 0.014);
  } else if (kind === "band") {
    const prof = [];
    const R = 0.075, th = 0.016, wd = 0.05, rr = 0.007;
    [[R + th / 2 - rr, wd / 2 - rr, 0], [R - th / 2 + rr, wd / 2 - rr, Math.PI / 2], [R - th / 2 + rr, -wd / 2 + rr, Math.PI], [R + th / 2 - rr, -wd / 2 + rr, (3 * Math.PI) / 2]].forEach(([cx, cy, a0]) => {
      for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)); }
    });
    prof.push(prof[0].clone());
    g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.reverse(), 96), fabric("#d6ccbc", 6, 1)));
    const pod = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.06, 4, 0.012), ceramic);
    pod.position.set(R + 0.018, 0, 0);
    g.add(pod);
    led.set(R + 0.034, 0, 0);
  }
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), new THREE.MeshBasicMaterial({ color: TEAL, toneMapped: false }));
  l.position.copy(led);
  g.add(l);
  const gl = glow(TEAL, 0.09, 0.6);
  gl.position.copy(led);
  g.add(gl);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function orbit(radius, y, tiltX, tiltZ, opacity) {
  const ring = new THREE.Group();
  ring.position.y = y;
  ring.rotation.set(tiltX, 0, tiltZ);
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0035, 8, 256), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity, depthWrite: false, toneMapped: false })));
  ring.userData.radius = radius;
  return ring;
}

function roundedPolygonShape(verts, r) {
  const s = new THREE.Shape();
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const p = verts[(i - 1 + n) % n], v = verts[i], nx = verts[(i + 1) % n];
    const a = v.clone().add(p.clone().sub(v).normalize().multiplyScalar(r));
    const b = v.clone().add(nx.clone().sub(v).normalize().multiplyScalar(r));
    i === 0 ? s.moveTo(a.x, a.y) : s.lineTo(a.x, a.y);
    s.quadraticCurveTo(v.x, v.y, b.x, b.y);
  }
  s.closePath();
  return s;
}

function windowPane(w, h) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 150, 10, 128, 128, 190);
  grd.addColorStop(0, "#fff3d6");
  grd.addColorStop(0.6, "#ffd28c");
  grd.addColorStop(1, "#f0a95c");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const shape = roundedPolygonShape([new THREE.Vector2(-w / 2, -h / 2), new THREE.Vector2(w / 2, -h / 2), new THREE.Vector2(w / 2, h / 2), new THREE.Vector2(-w / 2, h / 2)], 0.025);
  const geo = new THREE.ShapeGeometry(shape, 12);
  // map UVs to 0..1 over the pane
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  const pane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  const grp = new THREE.Group();
  grp.add(pane);
  const barMat = new THREE.MeshPhysicalMaterial({ color: "#cfc6b7", roughness: 0.9 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.018, h, 0.012), barMat);
  const hz = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, 0.012), barMat);
  v.position.z = hz.position.z = 0.006;
  grp.add(v, hz);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 3.2, h * 3.2), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, "rgba(255,196,120,0.55)"], [0.35, "rgba(255,190,110,0.18)"], [1, "rgba(255,190,110,0)"]]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  halo.position.z = -0.001;
  grp.add(halo);
  return grp;
}

// ---------- Scenes ----------

const SCENES = {
  guardian() {
    const g = makeGuardian();
    g.rotation.y = 0.18;
    scene.add(g);
    ground(0.16);
    contactShadow(0.95, 0.75, 0.42);
    lights({ key: [-1.8, 7, 3.4], keyI: 2.0, rim: [3.5, 3.2, -3.5], rimI: 1.3 });
    const cam = new THREE.PerspectiveCamera(22, W / H, 0.1, 100);
    cam.position.set(1.0, 1.35, 7.4);
    cam.lookAt(0, 1.02, 0);
    return cam;
  },

  hero() {
    // armchair with a seated older adult, Guardian beside them
    const seat = new THREE.Group();
    seat.position.set(-0.55, 0, -0.35);
    seat.rotation.y = 0.58;
    scene.add(seat);
    seat.add(makeArmchair());
    seat.updateMatrixWorld(true);

    const bot = makeGuardian();
    bot.position.copy(seat.localToWorld(new THREE.Vector3(1.08, 0, 1.18)));
    bot.rotation.y = -0.18;
    scene.add(bot);
    bot.updateMatrixWorld(true);

    // rest the hand on the upper back of Guardian's head, on the side facing the person
    const headCentre = bot.localToWorld(new THREE.Vector3(0, 1.64, 0));
    const towards = seat.localToWorld(new THREE.Vector3(0.36, 2.0, -0.1)).sub(headCentre).setY(0).normalize();
    const touch = headCentre.clone().add(towards.multiplyScalar(0.34)).add(new THREE.Vector3(0, 0.36, 0));
    makeSeatedPerson(seat, seat.worldToLocal(touch));

    ground(0.17);
    contactShadow(1.0, 0.8, 0.4, bot.position.x, bot.position.z);
    const chairPos = seat.position;
    contactShadow(1.2, 1.0, 0.38, chairPos.x, chairPos.z);
    lights({ key: [-1.5, 7.5, 4.5], keyI: 2.1, rim: [4, 3.5, -3.5], rimI: 1.4 });
    const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
    cam.position.set(-0.2, 2.5, 8.3);
    cam.lookAt(-0.72, 1.55, 0);
    return cam;
  },

  guardianDetail() {
    const g = makeGuardian();
    g.rotation.y = 0.5;
    scene.add(g);
    ground(0.14);
    lights({ key: [-2.2, 6.5, 4], keyI: 2.0, rim: [3.5, 3.2, -3.5], rimI: 1.5 });
    const cam = new THREE.PerspectiveCamera(24, W / H, 0.1, 100);
    cam.position.set(-0.4, 1.75, 3.9);
    cam.lookAt(0.12, 1.36, 0);
    return cam;
  },

  steady() {
    const bot = makeGuardian({ wave: breath, lineColor: "#bfb6ff", arms: true });
    bot.rotation.y = 0.15;
    scene.add(bot);

    // orbits carry wearable and ambient sensors around the companion
    const o1 = orbit(1.1, 0.55, Math.PI / 2 + 0.2, 0.1, 0.55);
    const o2 = orbit(1.12, 1.5, Math.PI / 2 - 0.16, -0.12, 0.4);
    scene.add(o1, o2);
    const place = (ring, angle, kind, rot = [0, 0, 0]) => {
      const pod = sensorPod(kind);
      pod.position.set(Math.cos(angle) * ring.userData.radius, Math.sin(angle) * ring.userData.radius, 0);
      pod.rotation.set(...rot);
      pod.scale.setScalar(1.25);
      ring.add(pod);
    };
    place(o1, 3.55, "patch", [-1.2, 0, 0.3]);
    place(o1, 2.55, "ring", [0.6, 0.4, 0]);
    place(o1, 4.35, "pebble", [-1.3, 0, 0]);
    place(o2, 1.0, "band", [0.9, 0.2, 0.5]);
    place(o2, 2.75, "pebble", [-1.1, 0.3, 0]);
    place(o2, 5.95, "ring", [0.3, 0.9, 0.2]);

    // a sensor hovering over the raised hand
    const held = sensorPod("pebble");
    held.position.copy(bot.userData.palm).add(new THREE.Vector3(0.02, 0.24, 0.04));
    held.rotation.set(0.25, 0, 0.1);
    held.scale.setScalar(1.5);
    scene.add(held);

    ground(0.16);
    contactShadow(1.0, 0.8, 0.42);
    lights({ key: [-1.8, 7, 3.4], keyI: 2.0, rim: [3.5, 3.2, -3.5], rimI: 1.4 });
    const cam = new THREE.PerspectiveCamera(24, W / H, 0.1, 100);
    cam.position.set(0.9, 1.45, 6.6);
    cam.lookAt(0, 1.05, 0);
    return cam;
  },

  home() {
    const house = new THREE.Group();
    const w = 0.62, wall = 0.8, peak = 1.34, depth = 0.9, bev = 0.06;
    const shape = roundedPolygonShape([
      new THREE.Vector2(-w, 0), new THREE.Vector2(w, 0), new THREE.Vector2(w, wall),
      new THREE.Vector2(0, peak), new THREE.Vector2(-w, wall),
    ], 0.07);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 10, curveSegments: 24 });
    geo.translate(0, bev, -depth / 2);
    const body = new THREE.Mesh(geo, fabric("#d2c6b3", 2.6, 2.6));
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    const front = depth / 2 + bev + 0.003;
    const w1 = windowPane(0.3, 0.3);
    w1.position.set(-0.27, 0.58, front);
    house.add(w1);

    const door = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.46, 0.04, 6, 0.018), fabric("#a89a86", 1.4, 2.2));
    door.position.set(0.25, 0.23 + bev, front - 0.005);
    door.castShadow = true;
    house.add(door);

    const side = windowPane(0.26, 0.26);
    side.rotation.y = Math.PI / 2;
    side.position.set(w + bev + 0.003, 0.5, 0.05);
    house.add(side);

    house.rotation.y = -0.5;
    scene.add(house);

    const buddy = makeGuardian();
    buddy.scale.setScalar(0.3);
    buddy.position.set(0.95, 0, 0.75);
    buddy.rotation.y = -0.9;
    buddy.children.forEach((c) => (c.castShadow = true));
    scene.add(buddy);

    ground(0.17);
    contactShadow(1.1, 0.9, 0.38);
    contactShadow(0.3, 0.25, 0.4, 0.95, 0.75);
    lights({ key: [-3.5, 6, 4.5], keyI: 2.1, rim: [4, 3, -3], rimI: 1.3 });
    const cam = new THREE.PerspectiveCamera(22, W / H, 0.1, 100);
    cam.position.set(1.2, 1.75, 6.6);
    cam.lookAt(0.12, 0.6, 0);
    return cam;
  },
};

const camera = SCENES[NAME]();
renderer.compile(scene, camera);
renderer.render(scene, camera);
window.__ready = true;
