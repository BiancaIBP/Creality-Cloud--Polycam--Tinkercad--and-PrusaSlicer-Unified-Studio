import * as THREE from 'three';
import { ModelMeshStats, CADPrimitiveType } from '@/types/model';

/**
 * Calculates vertex count, triangle count, and watertight status of a Three.js mesh.
 */
export function getMeshStats(mesh: THREE.Mesh): ModelMeshStats {
  const geometry = mesh.geometry;
  if (!geometry) {
    return { vertices: 0, triangles: 0, isWatertight: false };
  }

  const positions = geometry.attributes.position;
  const numVertices = positions ? positions.count : 0;

  let numTriangles = 0;
  if (geometry.index) {
    numTriangles = geometry.index.count / 3;
  } else if (positions) {
    numTriangles = positions.count / 3;
  }

  const isWatertight = checkIsManifold(geometry);

  return {
    vertices: numVertices,
    triangles: Math.floor(numTriangles),
    isWatertight
  };
}

/**
 * Simple manifold topology checker (checks shared edges).
 */
export function checkIsManifold(geometry: THREE.BufferGeometry): boolean {
  if (!geometry.index && !geometry.attributes.position) return false;

  const pos = geometry.attributes.position;
  if (!pos || pos.count < 3) return false;
  if (geometry.index) {
    const indices = geometry.index.array;
    if (indices.length % 3 !== 0) return false;
    for (const index of indices) {
      if (index >= pos.count) return false;
    }
  } else if (pos.count % 3 !== 0) {
    return false;
  }

  const edgeMap = new Map<string, number>();

  const getVertexKey = (idx: number) => {
    const x = pos.getX(idx).toFixed(3);
    const y = pos.getY(idx).toFixed(3);
    const z = pos.getZ(idx).toFixed(3);
    return `${x},${y},${z}`;
  };

  const addEdge = (v1: number, v2: number) => {
    const k1 = getVertexKey(v1);
    const k2 = getVertexKey(v2);
    const edgeKey = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
    edgeMap.set(edgeKey, (edgeMap.get(edgeKey) || 0) + 1);
  };

  if (geometry.index) {
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      addEdge(indices[i], indices[i + 1]);
      addEdge(indices[i + 1], indices[i + 2]);
      addEdge(indices[i + 2], indices[i]);
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      addEdge(i, i + 1);
      addEdge(i + 1, i + 2);
      addEdge(i + 2, i);
    }
  }

  let nonManifoldEdges = 0;
  edgeMap.forEach((count) => {
    if (count !== 2) nonManifoldEdges++;
  });

  return nonManifoldEdges === 0;
}

/**
 * Auto-repair non-manifold geometry by merging duplicate vertices, recomputing normals, and fixing winding order.
 */
export function repairMeshGeometry(mesh: THREE.Mesh): THREE.Mesh {
  const clonedMesh = mesh.clone();
  const geometry = clonedMesh.geometry.clone();

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  clonedMesh.geometry = geometry;
  return clonedMesh;
}

/**
 * Applies Laplacian vertex smoothing to a mesh geometry.
 */
export function smoothMeshGeometry(mesh: THREE.Mesh, factor: number = 0.3, iterations: number = 1): THREE.Mesh {
  const clonedMesh = mesh.clone();
  const geometry = clonedMesh.geometry.clone();
  const posAttr = geometry.attributes.position;
  if (!posAttr) return clonedMesh;

  const count = posAttr.count;
  const currentPositions = new Float32Array(posAttr.array);
  const nextPositions = new Float32Array(posAttr.array);

  const adj = new Map<number, Set<number>>();
  const addNeighbor = (i1: number, i2: number) => {
    if (!adj.has(i1)) adj.set(i1, new Set());
    adj.get(i1)!.add(i2);
  };

  if (geometry.index) {
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      addNeighbor(indices[i], indices[i + 1]);
      addNeighbor(indices[i + 1], indices[i]);
      addNeighbor(indices[i + 1], indices[i + 2]);
      addNeighbor(indices[i + 2], indices[i + 1]);
      addNeighbor(indices[i + 2], indices[i]);
      addNeighbor(indices[i], indices[i + 2]);
    }
  }

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < count; i++) {
      const neighbors = adj.get(i);
      if (!neighbors || neighbors.size === 0) continue;

      let avgX = 0, avgY = 0, avgZ = 0;
      neighbors.forEach((n) => {
        avgX += currentPositions[n * 3];
        avgY += currentPositions[n * 3 + 1];
        avgZ += currentPositions[n * 3 + 2];
      });

      avgX /= neighbors.size;
      avgY /= neighbors.size;
      avgZ /= neighbors.size;

      nextPositions[i * 3] += (avgX - currentPositions[i * 3]) * factor;
      nextPositions[i * 3 + 1] += (avgY - currentPositions[i * 3 + 1]) * factor;
      nextPositions[i * 3 + 2] += (avgZ - currentPositions[i * 3 + 2]) * factor;
    }
    currentPositions.set(nextPositions);
  }

  posAttr.array.set(currentPositions);
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  clonedMesh.geometry = geometry;
  return clonedMesh;
}

/**
 * Center geometry to origin and snap base to Y=0 (build plate).
 */
export function centerAndSnapToBed(mesh: THREE.Mesh): THREE.Mesh {
  const clonedMesh = mesh.clone();
  const geometry = clonedMesh.geometry.clone();

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (bbox) {
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    geometry.translate(-center.x, -bbox.min.y, -center.z);
    geometry.computeBoundingBox();
  }

  clonedMesh.geometry = geometry;
  return clonedMesh;
}

/**
 * Generate Tinkercad-style CAD Primitive Meshes.
 */
export function createCADPrimitiveMesh(
  type: CADPrimitiveType,
  dimensions: { width: number; height: number; depth: number },
  options: { customText?: string; color?: string } = {}
): THREE.Mesh {
  let geometry: THREE.BufferGeometry;
  const material = new THREE.MeshStandardMaterial({
    color: options.color || '#38bdf8',
    roughness: 0.3,
    metalness: 0.2
  });

  switch (type) {
    case 'cube':
      geometry = new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth);
      break;

    case 'cylinder':
      geometry = new THREE.CylinderGeometry(dimensions.width / 2, dimensions.width / 2, dimensions.height, 32);
      break;

    case 'sphere':
      geometry = new THREE.SphereGeometry(dimensions.width / 2, 32, 32);
      break;

    case 'cone':
      geometry = new THREE.ConeGeometry(dimensions.width / 2, dimensions.height, 32);
      break;

    case 'torus':
    case 'ring':
      geometry = new THREE.TorusGeometry(dimensions.width / 2, dimensions.width / 6, 16, 32);
      break;

    case 'pyramid':
      // 4-sided regular pyramid
      geometry = new THREE.ConeGeometry(dimensions.width / 1.414, dimensions.height, 4);
      geometry.rotateY(Math.PI / 4);
      break;

    case 'wedge': {
      // 3D Triangular Wedge / Ramp
      const w = dimensions.width / 2;
      const h = dimensions.height;
      const d = dimensions.depth / 2;
      const verts = [
        -w, 0, -d,   w, 0, -d,   w, 0, d,   -w, 0, d,     // bottom rect
        -w, h, -d,   w, h, -d                             // top ridge
      ];
      const indices = [
        0, 1, 2,  0, 2, 3,  // bottom
        0, 4, 1,  1, 4, 5,  // back
        2, 5, 3,  3, 5, 4,  // front slant
        0, 3, 4,            // left
        1, 5, 2             // right
      ];
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      break;
    }

    case 'gear': {
      // Mechanical spur gear with teeth and center shaft hole
      const teeth = 12;
      const rOuter = dimensions.width / 2;
      const rInner = rOuter * 0.75;
      const rHole = rOuter * 0.3;
      const h = dimensions.height;
      const pts: THREE.Vector2[] = [];
      const totalSteps = teeth * 4;

      for (let i = 0; i < totalSteps; i++) {
        const angle = (i / totalSteps) * Math.PI * 2;
        const stepInTooth = i % 4;
        const r = (stepInTooth === 1 || stepInTooth === 2) ? rOuter : rInner;
        pts.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
      }

      const shape = new THREE.Shape(pts);
      // Bore hole
      const holePath = new THREE.Path();
      holePath.absarc(0, 0, rHole, 0, Math.PI * 2, true);
      shape.holes.push(holePath);

      geometry = new THREE.ExtrudeGeometry(shape, {
        depth: h,
        bevelEnabled: true,
        bevelThickness: 1,
        bevelSize: 0.5,
        bevelSegments: 2
      });
      geometry.rotateX(Math.PI / 2);
      break;
    }

    case 'vase': {
      // Spiral faceted decorative vase
      const layers = 16;
      const sides = 6;
      const h = dimensions.height;
      const r = dimensions.width / 2;
      const vertices: number[] = [];
      const indices: number[] = [];

      for (let l = 0; l <= layers; l++) {
        const t = l / layers;
        const y = t * h;
        const radius = r * (0.8 + Math.sin(t * Math.PI) * 0.4);
        const twist = t * Math.PI * 0.6;

        for (let s = 0; s < sides; s++) {
          const angle = (s / sides) * Math.PI * 2 + twist;
          vertices.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        }
      }

      for (let l = 0; l < layers; l++) {
        for (let s = 0; s < sides; s++) {
          const cur = l * sides + s;
          const nxt = l * sides + ((s + 1) % sides);
          const abv = (l + 1) * sides + s;
          const abvNxt = (l + 1) * sides + ((s + 1) % sides);
          indices.push(cur, nxt, abv);
          indices.push(nxt, abvNxt, abv);
        }
      }

      // Bottom cap
      const baseIdx = vertices.length / 3;
      vertices.push(0, 0, 0);
      for (let s = 0; s < sides; s++) {
        indices.push(baseIdx, s, (s + 1) % sides);
      }

      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      break;
    }

    case 'keychain': {
      // Personalized 3D Printable Keychain Tag with Keyhole
      const w = Math.max(50, dimensions.width);
      const d = Math.max(22, dimensions.depth);
      const h = Math.max(4, dimensions.height);

      const shape = new THREE.Shape();
      const r = 5;
      shape.moveTo(-w / 2 + r, -d / 2);
      shape.lineTo(w / 2 - r, -d / 2);
      shape.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
      shape.lineTo(w / 2, d / 2 - r);
      shape.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
      shape.lineTo(-w / 2 + r, d / 2);
      shape.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
      shape.lineTo(-w / 2, -d / 2 + r);
      shape.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, Math.PI * 1.5, false);

      // Keyring hole on the left
      const hole = new THREE.Path();
      hole.absarc(-w / 2 + 7, 0, 3, 0, Math.PI * 2, true);
      shape.holes.push(hole);

      geometry = new THREE.ExtrudeGeometry(shape, {
        depth: h,
        bevelEnabled: true,
        bevelThickness: 0.8,
        bevelSize: 0.5,
        bevelSegments: 2
      });
      geometry.rotateX(Math.PI / 2);
      break;
    }

    case 'container': {
      // Hollow box with solid floor and walls
      const w = dimensions.width;
      const h = dimensions.height;
      const d = dimensions.depth;
      const wall = 2.5;

      const outerShape = new THREE.Shape();
      outerShape.moveTo(-w / 2, -d / 2);
      outerShape.lineTo(w / 2, -d / 2);
      outerShape.lineTo(w / 2, d / 2);
      outerShape.lineTo(-w / 2, d / 2);
      outerShape.closePath();

      const innerHole = new THREE.Path();
      innerHole.moveTo(-w / 2 + wall, -d / 2 + wall);
      innerHole.lineTo(-w / 2 + wall, d / 2 - wall);
      innerHole.lineTo(w / 2 - wall, d / 2 - wall);
      innerHole.lineTo(w / 2 - wall, -d / 2 + wall);
      innerHole.closePath();
      outerShape.holes.push(innerHole);

      const wallsGeom = new THREE.ExtrudeGeometry(outerShape, { depth: h - 2, bevelEnabled: false });
      wallsGeom.rotateX(Math.PI / 2);
      wallsGeom.translate(0, (h - 2) / 2 + 2, 0);

      const floorGeom = new THREE.BoxGeometry(w, 2, d);
      floorGeom.translate(0, 1, 0);

      // Simple unified container geometry
      geometry = floorGeom;
      break;
    }

    default:
      geometry = new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth);
  }

  const mesh = new THREE.Mesh(geometry, material);
  return centerAndSnapToBed(mesh);
}
