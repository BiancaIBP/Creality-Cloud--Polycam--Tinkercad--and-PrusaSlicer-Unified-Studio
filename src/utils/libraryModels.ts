import * as THREE from 'three';
import { centerAndSnapToBed } from './meshProcessing';

/**
 * Generates a detailed Cyberpunk Figurine with hexagonal stand, armor torso, limbs, and visor helmet.
 */
export function createCyberpunkFigurine(): THREE.Mesh {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.35,
    metalness: 0.4
  });

  // 1. Hexagonal Base Pedestal
  const baseGeom = new THREE.CylinderGeometry(24, 26, 6, 6);
  const baseMesh = new THREE.Mesh(baseGeom, material);
  baseMesh.position.y = 3;
  group.add(baseMesh);

  // 2. Beveled Trim on Base
  const ringGeom = new THREE.TorusGeometry(20, 1.2, 8, 24);
  ringGeom.rotateX(Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeom, material);
  ringMesh.position.y = 6;
  group.add(ringMesh);

  // 3. Legs
  const leftLegGeom = new THREE.CylinderGeometry(3.5, 4.5, 26, 12);
  const leftLeg = new THREE.Mesh(leftLegGeom, material);
  leftLeg.position.set(-6, 19, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(leftLegGeom, material);
  rightLeg.position.set(6, 19, 0);
  group.add(rightLeg);

  // 4. Waist & Belt
  const waistGeom = new THREE.CylinderGeometry(8, 7, 6, 16);
  const waist = new THREE.Mesh(waistGeom, material);
  waist.position.y = 33;
  group.add(waist);

  // 5. Chest & Torso Armor
  const torsoGeom = new THREE.BoxGeometry(16, 18, 12);
  const torso = new THREE.Mesh(torsoGeom, material);
  torso.position.y = 43;
  group.add(torso);

  // 6. Shoulders Pauldrons
  const shoulderGeom = new THREE.SphereGeometry(5.5, 12, 12);
  const leftShoulder = new THREE.Mesh(shoulderGeom, material);
  leftShoulder.position.set(-11, 48, 0);
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(shoulderGeom, material);
  rightShoulder.position.set(11, 48, 0);
  group.add(rightShoulder);

  // 7. Arms
  const armGeom = new THREE.CylinderGeometry(3, 2.5, 18, 12);
  const leftArm = new THREE.Mesh(armGeom, material);
  leftArm.position.set(-12, 38, 2);
  leftArm.rotation.z = 0.15;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeom, material);
  rightArm.position.set(12, 38, 2);
  rightArm.rotation.z = -0.15;
  group.add(rightArm);

  // 8. Cyber Helmet / Head
  const headGeom = new THREE.SphereGeometry(6.5, 16, 16);
  const head = new THREE.Mesh(headGeom, material);
  head.position.y = 57;
  head.scale.set(1, 1.2, 1.1);
  group.add(head);

  // 9. Visor Plate
  const visorGeom = new THREE.BoxGeometry(9, 3.5, 4);
  const visor = new THREE.Mesh(visorGeom, material);
  visor.position.set(0, 57, 4.5);
  group.add(visor);

  // Merge group geometries into a single unified mesh
  const unified = mergeGroupToMesh(group, material);
  return centerAndSnapToBed(unified);
}

/**
 * Generates an Articulated Dragon / Flexi-Lizard with segmented vertebrae.
 */
export function createArticulatedDragon(): THREE.Mesh {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: '#10b981',
    roughness: 0.4,
    metalness: 0.3
  });

  // Head with horns
  const headGeom = new THREE.ConeGeometry(8, 22, 12);
  headGeom.rotateX(Math.PI / 2);
  const head = new THREE.Mesh(headGeom, material);
  head.position.set(0, 8, 30);
  group.add(head);

  // Horns
  const hornGeom = new THREE.ConeGeometry(2, 12, 8);
  hornGeom.rotateX(-Math.PI / 4);
  const leftHorn = new THREE.Mesh(hornGeom, material);
  leftHorn.position.set(-5, 14, 22);
  group.add(leftHorn);

  const rightHorn = new THREE.Mesh(hornGeom, material);
  rightHorn.position.set(5, 14, 22);
  group.add(rightHorn);

  // Segmented Body Links (print-in-place segments)
  const numSegments = 9;
  for (let i = 0; i < numSegments; i++) {
    const t = i / numSegments;
    const radius = 9 * (1 - t * 0.6);
    const zPos = 18 - i * 11;
    const xCurve = Math.sin(i * 0.7) * 8;

    // Segment capsule body
    const segGeom = new THREE.CylinderGeometry(radius * 0.85, radius, 8, 12);
    segGeom.rotateX(Math.PI / 2);
    const segMesh = new THREE.Mesh(segGeom, material);
    segMesh.position.set(xCurve, 8, zPos);
    group.add(segMesh);

    // Spine crest on top
    const crestGeom = new THREE.ConeGeometry(radius * 0.35, 6, 4);
    const crestMesh = new THREE.Mesh(crestGeom, material);
    crestMesh.position.set(xCurve, 8 + radius * 0.8, zPos);
    group.add(crestMesh);

    // Interlocking link rings
    const linkGeom = new THREE.TorusGeometry(3.5, 1.2, 8, 16);
    const linkMesh = new THREE.Mesh(linkGeom, material);
    linkMesh.position.set(xCurve, 8, zPos + 5);
    group.add(linkMesh);
  }

  const unified = mergeGroupToMesh(group, material);
  return centerAndSnapToBed(unified);
}

/**
 * Generates a Modern Geometric Low-Poly Planter / Spiral Faceted Vase.
 */
export function createGeometricPlanter(): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    roughness: 0.3,
    metalness: 0.2
  });

  const height = 65;
  const layers = 28;
  const sides = 8;
  const vertices: number[] = [];
  const indices: number[] = [];

  // Outer spiral faceted wall
  for (let l = 0; l <= layers; l++) {
    const t = l / layers;
    const y = t * height;
    // Waisted vase curve
    const rOuter = 16 + Math.sin(t * Math.PI) * 8 + (t > 0.8 ? (t - 0.8) * 15 : 0);
    const twist = t * (Math.PI * 0.75);

    for (let s = 0; s < sides; s++) {
      const angle = (s / sides) * Math.PI * 2 + twist;
      vertices.push(Math.cos(angle) * rOuter, y, Math.sin(angle) * rOuter);
    }
  }

  // Triangulate outer wall
  for (let l = 0; l < layers; l++) {
    for (let s = 0; s < sides; s++) {
      const current = l * sides + s;
      const next = l * sides + ((s + 1) % sides);
      const above = (l + 1) * sides + s;
      const aboveNext = (l + 1) * sides + ((s + 1) % sides);

      indices.push(current, next, above);
      indices.push(next, aboveNext, above);
    }
  }

  // Bottom Base cap
  const baseCenterIdx = vertices.length / 3;
  vertices.push(0, 0, 0);
  for (let s = 0; s < sides; s++) {
    const nextS = (s + 1) % sides;
    indices.push(baseCenterIdx, s, nextS);
  }

  // Inner cavity (hollow pot inside)
  const innerOffset = vertices.length / 3;
  for (let l = 0; l <= layers; l++) {
    const t = l / layers;
    const y = Math.max(3, t * height);
    const rInner = Math.max(8, (16 + Math.sin(t * Math.PI) * 8 + (t > 0.8 ? (t - 0.8) * 15 : 0)) - 3.5);
    const twist = t * (Math.PI * 0.75);

    for (let s = 0; s < sides; s++) {
      const angle = (s / sides) * Math.PI * 2 + twist;
      vertices.push(Math.cos(angle) * rInner, y, Math.sin(angle) * rInner);
    }
  }

  // Triangulate inner wall (reversed normals)
  for (let l = 0; l < layers; l++) {
    for (let s = 0; s < sides; s++) {
      const current = innerOffset + l * sides + s;
      const next = innerOffset + l * sides + ((s + 1) % sides);
      const above = innerOffset + (l + 1) * sides + s;
      const aboveNext = innerOffset + (l + 1) * sides + ((s + 1) % sides);

      indices.push(current, above, next);
      indices.push(next, above, aboveNext);
    }
  }

  // Rim top bridge (connecting outer rim to inner rim)
  const topOuterOffset = layers * sides;
  const topInnerOffset = innerOffset + layers * sides;
  for (let s = 0; s < sides; s++) {
    const nextS = (s + 1) % sides;
    indices.push(topOuterOffset + s, topInnerOffset + s, topOuterOffset + nextS);
    indices.push(topOuterOffset + nextS, topInnerOffset + s, topInnerOffset + nextS);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  return centerAndSnapToBed(mesh);
}

/**
 * Generates an Engine Piston Mechanical Desk Toy assembly.
 */
export function createMechanicalPiston(): THREE.Mesh {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.3,
    metalness: 0.6
  });

  // 1. Piston Crown (Cylinder)
  const crownGeom = new THREE.CylinderGeometry(20, 20, 28, 32);
  const crown = new THREE.Mesh(crownGeom, material);
  crown.position.y = 50;
  group.add(crown);

  // 2. Piston Ring Grooves
  for (let g = 0; g < 3; g++) {
    const ringGroove = new THREE.TorusGeometry(20.2, 0.7, 8, 32);
    ringGroove.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGroove, material);
    ringMesh.position.y = 56 - g * 4;
    group.add(ringMesh);
  }

  // 3. Wrist Pin (Gudgeon Pin)
  const pinGeom = new THREE.CylinderGeometry(5, 5, 36, 20);
  pinGeom.rotateZ(Math.PI / 2);
  const pin = new THREE.Mesh(pinGeom, material);
  pin.position.y = 44;
  group.add(pin);

  // 4. Connecting Rod (H-Beam Shank)
  const rodGeom = new THREE.BoxGeometry(6, 32, 10);
  const rod = new THREE.Mesh(rodGeom, material);
  rod.position.y = 26;
  group.add(rod);

  // 5. Crank Journal (Big End)
  const crankGeom = new THREE.CylinderGeometry(9, 9, 14, 24);
  crankGeom.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeom, material);
  crank.position.y = 10;
  group.add(crank);

  // 6. Base Mounting Bracket
  const baseGeom = new THREE.BoxGeometry(45, 6, 28);
  const baseMesh = new THREE.Mesh(baseGeom, material);
  baseMesh.position.y = 3;
  group.add(baseMesh);

  const unified = mergeGroupToMesh(group, material);
  return centerAndSnapToBed(unified);
}

/**
 * Utility to merge a hierarchy of meshes into a single unified Three.js BufferGeometry mesh.
 */
function mergeGroupToMesh(group: THREE.Group, defaultMaterial: THREE.Material): THREE.Mesh {
  group.updateMatrixWorld(true);

  const allVertices: number[] = [];
  const allIndices: number[] = [];
  let indexOffset = 0;

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      const geom = m.geometry.clone();
      geom.applyMatrix4(m.matrixWorld);

      const pos = geom.attributes.position;
      if (!pos) return;

      for (let i = 0; i < pos.count; i++) {
        allVertices.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }

      if (geom.index) {
        for (let i = 0; i < geom.index.count; i++) {
          allIndices.push(geom.index.getX(i) + indexOffset);
        }
      } else {
        for (let i = 0; i < pos.count; i++) {
          allIndices.push(i + indexOffset);
        }
      }

      indexOffset += pos.count;
    }
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
  merged.setIndex(allIndices);
  merged.computeVertexNormals();

  return new THREE.Mesh(merged, defaultMaterial);
}
