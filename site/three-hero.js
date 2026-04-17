// site/three-hero.js
import * as THREE from 'https://unpkg.com/three@0.170.0/build/three.module.min.js';

let camera, scene, renderer;
let particles;
let initialPositions = [];
let noiseOffsets = [];     // Pre-computed per-particle noise
let scrollY = 0;

init();
animate();

function init() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.001);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.z = 1000;

  // Particle Sphere
  const geometry = new THREE.BufferGeometry();
  const particleCount = 2000;
  
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  const radius = 400;

  for (let i = 0; i < particleCount; i++) {
    // Generate uniform points on a sphere (Fibonacci sphere)
    const phi = Math.acos(-1 + (2 * i) / particleCount);
    const theta = Math.sqrt(particleCount * Math.PI) * phi;

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Save initial for scattering later
    initialPositions.push({ x, y, z });

    // Pre-compute per-particle noise so scatter is smooth (no jitter)
    noiseOffsets.push({
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      z: (Math.random() - 0.5) * 200,
    });

    // Apple-like color logic: Mostly white #f5f5f7, rare accents #2997ff
    const isAccent = Math.random() > 0.95;
    const color = new THREE.Color(isAccent ? 0x2997ff : 0xf5f5f7);
    color.toArray(colors, i * 3);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 3.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x for performance
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('scroll', onScroll, { passive: true });
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onScroll() {
  scrollY = window.scrollY;
  if (!particles) return;
  
  // Maximum scatter effect at 500px scroll
  const scrollRatio = Math.min(scrollY / 500, 1.0);
  
  const positions = particles.geometry.attributes.position.array;
  
  for (let i = 0; i < initialPositions.length; i++) {
    const init = initialPositions[i];
    const noise = noiseOffsets[i];
    
    // Scale outward + add pre-computed noise scaled by scroll
    const scatterFactor = 1.0 + (scrollRatio * 1.5);

    positions[i * 3]     = init.x * scatterFactor + noise.x * scrollRatio;
    positions[i * 3 + 1] = init.y * scatterFactor + noise.y * scrollRatio;
    positions[i * 3 + 2] = init.z * scatterFactor + noise.z * scrollRatio;
  }
  
  particles.geometry.attributes.position.needsUpdate = true;
  
  // Fade out material as we scroll down
  particles.material.opacity = Math.max(0.8 - (scrollRatio * 0.8), 0.0);
}

function animate() {
  requestAnimationFrame(animate);

  if (!particles || !renderer) return;

  // Skip rendering if hero is off screen (scrolled away)
  if (scrollY > 800) return;

  // Idle rotation
  particles.rotation.x += 0.0005;
  particles.rotation.y += 0.001;
  particles.rotation.z += 0.0002;
  
  renderer.render(scene, camera);
}

