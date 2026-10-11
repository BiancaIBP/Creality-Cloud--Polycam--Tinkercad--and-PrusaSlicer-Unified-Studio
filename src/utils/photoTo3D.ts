import * as THREE from 'three';
import { centerAndSnapToBed } from './meshProcessing';

export interface PhotoTo3DOptions {
  width?: number; // mm
  height?: number; // mm
  maxDepth?: number; // mm relief height
  baseThickness?: number; // mm base plate
  invert?: boolean; // invert relief
  resolution?: number; // grid segments
}

/**
 * Converts a 2D image (Data URL or Object URL) into a 3D printable relief / lithophane mesh.
 */
export async function createLithophaneFromImage(
  imageSource: string,
  options: PhotoTo3DOptions = {}
): Promise<THREE.Mesh> {
  const {
    width = 60,
    height = 60,
    maxDepth = 5.0,
    baseThickness = 1.5,
    invert = false,
    resolution = 80
  } = options;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageSource;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image for 3D conversion.'));
  });

  // Render to canvas to read pixel luminance
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas context.');

  canvas.width = resolution;
  canvas.height = resolution;
  ctx.drawImage(img, 0, 0, resolution, resolution);

  const imgData = ctx.getImageData(0, 0, resolution, resolution).data;

  const w = resolution;
  const h = resolution;
  const vertices: number[] = [];
  const indices: number[] = [];

  // 1. Top Relief Surface (Y is UP)
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      const idx = (i * w + j) * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      // Perceptual luminance
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
      const reliefVal = invert ? lum : (1.0 - lum);
      const y = baseThickness + reliefVal * maxDepth;

      const x = ((j / (w - 1)) - 0.5) * width;
      const z = ((i / (h - 1)) - 0.5) * height;

      vertices.push(x, y, z);
    }
  }

  // 2. Bottom Base Surface (at Y = 0)
  const offset = w * h;
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      const x = ((j / (w - 1)) - 0.5) * width;
      const z = ((i / (h - 1)) - 0.5) * height;
      vertices.push(x, 0, z);
    }
  }

  // Top Surface Triangles
  for (let i = 0; i < h - 1; i++) {
    for (let j = 0; j < w - 1; j++) {
      const v0 = i * w + j;
      const v1 = v0 + 1;
      const v2 = (i + 1) * w + j;
      const v3 = v2 + 1;

      indices.push(v0, v2, v1);
      indices.push(v1, v2, v3);
    }
  }

  // Bottom Surface Triangles (Reversed winding)
  for (let i = 0; i < h - 1; i++) {
    for (let j = 0; j < w - 1; j++) {
      const v0 = offset + i * w + j;
      const v1 = v0 + 1;
      const v2 = offset + (i + 1) * w + j;
      const v3 = v2 + 1;

      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);
    }
  }

  // Border Side Walls to create closed watertight manifold
  // Front Wall (i = 0)
  for (let j = 0; j < w - 1; j++) {
    const t0 = j;
    const t1 = j + 1;
    const b0 = offset + j;
    const b1 = offset + j + 1;
    indices.push(t0, t1, b0);
    indices.push(t1, b1, b0);
  }

  // Back Wall (i = h - 1)
  for (let j = 0; j < w - 1; j++) {
    const t0 = (h - 1) * w + j;
    const t1 = t0 + 1;
    const b0 = offset + t0;
    const b1 = offset + t1;
    indices.push(t0, b0, t1);
    indices.push(t1, b0, b1);
  }

  // Left Wall (j = 0)
  for (let i = 0; i < h - 1; i++) {
    const t0 = i * w;
    const t1 = (i + 1) * w;
    const b0 = offset + t0;
    const b1 = offset + t1;
    indices.push(t0, b0, t1);
    indices.push(t1, b0, b1);
  }

  // Right Wall (j = w - 1)
  for (let i = 0; i < h - 1; i++) {
    const t0 = i * w + (w - 1);
    const t1 = (i + 1) * w + (w - 1);
    const b0 = offset + t0;
    const b1 = offset + t1;
    indices.push(t0, t1, b0);
    indices.push(t1, b1, b0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.35,
    metalness: 0.2
  });

  const mesh = new THREE.Mesh(geometry, material);
  return centerAndSnapToBed(mesh);
}

/**
 * Creates a stylized 3D figurine portrait bust with display base from an image.
 */
export async function createFigurineBustFromImage(
  imageSource: string,
  options: PhotoTo3DOptions = {}
): Promise<THREE.Mesh> {
  const relief = await createLithophaneFromImage(imageSource, {
    ...options,
    width: 45,
    height: 45,
    maxDepth: 6,
    baseThickness: 2
  });

  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: '#a78bfa',
    roughness: 0.3,
    metalness: 0.3
  });

  // Base Pedestal
  const baseGeom = new THREE.CylinderGeometry(24, 28, 8, 32);
  const base = new THREE.Mesh(baseGeom, material);
  base.position.y = 4;
  group.add(base);

  // Bust Pedestal Post
  const postGeom = new THREE.CylinderGeometry(8, 12, 16, 24);
  const post = new THREE.Mesh(postGeom, material);
  post.position.y = 16;
  group.add(post);

  // Figurine frame mounting
  const frameGeom = new THREE.BoxGeometry(48, 48, 6);
  const frame = new THREE.Mesh(frameGeom, material);
  frame.position.set(0, 44, -1);
  group.add(frame);

  // Mount relief into frame
  relief.position.set(0, 44, 2);
  relief.rotation.x = Math.PI / 2;
  group.add(relief);

  // Consolidate into single mesh
  group.updateMatrixWorld(true);
  const allVerts: number[] = [];
  const allInds: number[] = [];
  let offset = 0;

  group.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = c as THREE.Mesh;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      const pos = g.attributes.position;
      if (!pos) return;

      for (let i = 0; i < pos.count; i++) {
        allVerts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }

      if (g.index) {
        for (let i = 0; i < g.index.count; i++) {
          allInds.push(g.index.getX(i) + offset);
        }
      } else {
        for (let i = 0; i < pos.count; i++) {
          allInds.push(i + offset);
        }
      }
      offset += pos.count;
    }
  });

  const combined = new THREE.BufferGeometry();
  combined.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
  combined.setIndex(allInds);
  combined.computeVertexNormals();

  const unified = new THREE.Mesh(combined, material);
  return centerAndSnapToBed(unified);
}
