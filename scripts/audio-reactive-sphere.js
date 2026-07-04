import * as THREE from "three";

// setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.SphereGeometry(2, 10, 10);
const positions = geometry.attributes.position;
const originalPositions = positions.array.slice();
const material = new THREE.MeshBasicMaterial({ color: 0xa9a9a9 });

// const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);

const wire = new THREE.Mesh(
  geometry,
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
  }),
);

scene.add(wire);

camera.position.z = 5;

// particles
const particleCount = 6000;

const particleGeometry = new THREE.BufferGeometry();

const particlePositions = new Float32Array(particleCount * 3);
const originalParticlePositions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  const radius = THREE.MathUtils.randFloat(10, 30);

  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);

  particlePositions[i * 3] = x;
  particlePositions[i * 3 + 1] = y;
  particlePositions[i * 3 + 2] = z;

  originalParticlePositions[i * 3] = x;
  originalParticlePositions[i * 3 + 1] = y;
  originalParticlePositions[i * 3 + 2] = z;
}

particleGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(particlePositions, 3),
);

const particleMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.08,
});

const particles = new THREE.Points(particleGeometry, particleMaterial);

scene.add(particles);

// audio logic
const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();

const input = document.getElementById("audioInput");
const fileText = document.getElementById("fileText");
const playPauseBtn = document.getElementById("play");
const progressBar = document.getElementById("progressBar");

input.addEventListener("change", () => {
  if (!input.files.length) return;

  if (sound.isPlaying) {
    sound.stop();
    progressBar.value = 0;
  }
  playPauseBtn.textContent = "PLAY";

  const file = input.files[0];
  fileText.textContent = file.name;

  const url = URL.createObjectURL(file);

  audioLoader.load(url, (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(settings.volume);
  });
});

// play/pause
playPauseBtn.addEventListener("click", () => {
  if (!input.files.length && !sound.buffer) {
    // alert("Please select a mp3 file");
    playPauseBtn.textContent = "please select a mp3 file";
    setTimeout(() => {
      playPauseBtn.textContent = "PLAY";
    }, 2000);
    return;
  }

  if (sound.isPlaying) {
    sound.pause();
    playPauseBtn.textContent = "PLAY";
  } else {
    sound.play();
    playPauseBtn.textContent = "PAUSE";
  }
});

// audio analyser
let analyser = new THREE.AudioAnalyser(sound, 256);

// read slider values.
const bassSlider = document.getElementById("bassSlider");
const midSlider = document.getElementById("midSlider");
const trebleSlider = document.getElementById("trebleSlider");
const volumeSlider = document.getElementById("volumeSlider");
const sensitivitySlider = document.getElementById("sensitivitySlider");

const settings = {
  bass: 0.2,
  mid: 0.2,
  treble: 0.3,
  volume: 1,
  sensitivity: 0.4,
};

bassSlider.addEventListener("input", () => {
  settings.bass = Number(bassSlider.value);
  console.log(settings.bass);
});
sensitivitySlider.addEventListener("input", () => {
  settings.sensitivity = Number(sensitivitySlider.value);
  console.log(settings.sensitivity);
});
volumeSlider.addEventListener("input", () => {
  settings.volume = Number(volumeSlider.value);
  sound.setVolume(settings.volume);
  console.log(settings.volume);
});
midSlider.addEventListener("input", () => {
  settings.mid = Number(midSlider.value);
  console.log(settings.mid);
});
trebleSlider.addEventListener("input", () => {
  settings.treble = Number(trebleSlider.value);
  console.log(settings.treble);
});

let bassFloor = 0,
  midFloor = 0,
  trebleFloor = 0;

// render sphere
function animate(time) {
  const audioData = analyser.getFrequencyData();

  const timeSeconds = time * 0.001;

  // raw averages (same as before)
  let rawBass = 0;
  for (let i = 0; i < 10; i++) rawBass += audioData[i];
  rawBass = rawBass / 10 / 255;

  let rawMid = 0;
  for (let i = 10; i < 40; i++) rawMid += audioData[i];
  rawMid = rawMid / 30 / 255;

  let rawTreble = 0;
  for (let i = 40; i < audioData.length; i++) rawTreble += audioData[i];
  rawTreble = rawTreble / (audioData.length - 40) / 255;

  // slow-adapting floors per band
  bassFloor = THREE.MathUtils.lerp(bassFloor, rawBass, 0.02);
  midFloor = THREE.MathUtils.lerp(midFloor, rawMid, 0.02);
  trebleFloor = THREE.MathUtils.lerp(trebleFloor, rawTreble, 0.02);

  // punch = how far above the recent floor, clamped
  const bass = Math.min(1, Math.max(0, rawBass - bassFloor) * 4);
  const mid = Math.min(1, Math.max(0, rawMid - midFloor) * 4);
  const treble = Math.min(1, Math.max(0, rawTreble - trebleFloor) * 4);

  //   particles animation
  const particlePos = particleGeometry.attributes.position.array;

  for (let i = 0; i < particleCount; i++) {
    const x = originalParticlePositions[i * 3];
    const y = originalParticlePositions[i * 3 + 1];
    const z = originalParticlePositions[i * 3 + 2];

    const length = Math.sqrt(x * x + y * y + z * z);
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;

    const freq = audioData[i % audioData.length] / 255;
    const offset =
      //   bass * settings.bass + treble * settings.treble + mid * settings.mid;
      freq * settings.sensitivity * 10 + bass * settings.bass * 10;
    particlePos[i * 3] = THREE.MathUtils.lerp(
      particlePos[i * 3],
      x + nx * offset,
      //   0.25,
      0.5,
    );
    particlePos[i * 3 + 1] = THREE.MathUtils.lerp(
      particlePos[i * 3 + 1],
      y + ny * offset,
      //   0.25,
      0.5,
    );
    particlePos[i * 3 + 2] = THREE.MathUtils.lerp(
      particlePos[i * 3 + 2],
      z + nz * offset,
      //   0.25,
      0.5,
    );
  }

  particleGeometry.attributes.position.needsUpdate = true;

  //   mesh animation
  for (let i = 0; i < positions.count; i++) {
    const x = originalPositions[i * 3];
    const y = originalPositions[i * 3 + 1];
    const z = originalPositions[i * 3 + 2];

    const length = Math.sqrt(x * x + y * y + z * z);

    const nx = x / length;
    const ny = y / length;
    const nz = z / length;

    const freq = audioData[i % audioData.length] / 255;

    // const wave =
    //   Math.sin(timeSeconds * 3 + x * 5 + y * 5 + z * 5) * 0.1 + bass * 0.4;
    const wave =
      Math.sin(timeSeconds * 4 + i * 0.9) * 0.1 +
      freq * settings.sensitivity +
      bass * settings.bass +
      mid * settings.mid +
      treble * settings.treble;

    positions.setXYZ(i, nx * (2 + wave), ny * (2 + wave), nz * (2 + wave));
  }
  positions.needsUpdate = true;

  //   camera rotate
  const radius = 5;
  const speed = 0.15; // lower = slower
  camera.position.x = Math.cos(timeSeconds * speed) * radius;
  camera.position.z = Math.sin(timeSeconds * speed) * radius;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);

  //   progress bar update
  if (sound.isPlaying) {
    const currentTime =
      sound.context.currentTime - sound._startedAt + sound._progress;
    const duration = sound.buffer?.duration;
    const progress = duration ? currentTime / duration : 0;
    progressBar.value = progress;
  } else {
    progressBar.value = 0;
  }
}

renderer.setAnimationLoop(animate);
