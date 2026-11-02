import * as THREE from 'three';
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(innerWidth, innerHeight); document.body.appendChild(r.domElement);
const s = new THREE.Scene(), c = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 100);
c.position.z = 3; s.add(new THREE.DirectionalLight(0xffffff, 3), new THREE.AmbientLight(0x404040, 3));
const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xff7733, flatShading: true }));
s.add(m); r.setAnimationLoop(() => { m.rotation.y += .01; r.render(s, c); });
