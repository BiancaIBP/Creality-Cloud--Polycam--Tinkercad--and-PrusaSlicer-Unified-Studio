import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { centerAndSnapToBed } from './meshProcessing';

/**
 * Loads and unifies any 3D model file (STL, OBJ, GLB, GLTF, PLY) into a Three.js Mesh.
 */
export async function load3DModelFromFile(file: File): Promise<THREE.Mesh> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const buffer = await file.arrayBuffer();

  const defaultMaterial = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    roughness: 0.35,
    metalness: 0.25,
    side: THREE.DoubleSide
  });

  let mesh: THREE.Mesh;

  switch (ext) {
    case 'stl': {
      const loader = new STLLoader();
      const geometry = loader.parse(buffer);
      geometry.computeVertexNormals();
      mesh = new THREE.Mesh(geometry, defaultMaterial);
      break;
    }

    case 'ply': {
      const loader = new PLYLoader();
      const geometry = loader.parse(buffer);
      geometry.computeVertexNormals();
      mesh = new THREE.Mesh(geometry, defaultMaterial);
      break;
    }

    case 'obj': {
      const text = new TextDecoder('utf-8').decode(buffer);
      const loader = new OBJLoader();
      const objGroup = loader.parse(text);
      mesh = mergeObjGroup(objGroup, defaultMaterial);
      break;
    }

    case 'glb':
    case 'gltf': {
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(buffer, '');
      mesh = mergeObjGroup(gltf.scene || gltf.scenes[0], defaultMaterial);
      break;
    }

    default:
      throw new Error(`Unsupported 3D file format: .${ext}. Please upload .stl, .obj, .glb, .gltf, or .ply`);
  }

  return centerAndSnapToBed(mesh);
}

/**
 * Loads a 3D model from a remote URL or API endpoint.
 */
export async function load3DModelFromUrl(url: string): Promise<THREE.Mesh> {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || 'stl';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download model from ${url} (HTTP ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  const file = new File([buffer], `downloaded_model.${ext}`);
  return load3DModelFromFile(file);
}

/**
 * Merges loaded Group/Scene hierarchies into a single unified Mesh.
 */
function mergeObjGroup(root: THREE.Object3D, fallbackMaterial: THREE.Material): THREE.Mesh {
  root.updateMatrixWorld(true);

  const vertices: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      const geom = m.geometry.clone();
      geom.applyMatrix4(m.matrixWorld);

      const pos = geom.attributes.position;
      if (!pos) return;

      for (let i = 0; i < pos.count; i++) {
        vertices.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }

      if (geom.index) {
        for (let i = 0; i < geom.index.count; i++) {
          indices.push(geom.index.getX(i) + indexOffset);
        }
      } else {
        for (let i = 0; i < pos.count; i++) {
          indices.push(i + indexOffset);
        }
      }

      indexOffset += pos.count;
    }
  });

  if (vertices.length === 0) {
    // Fallback if empty scene
    const box = new THREE.BoxGeometry(20, 20, 20);
    return new THREE.Mesh(box, fallbackMaterial);
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  if (indices.length > 0) {
    merged.setIndex(indices);
  }
  merged.computeVertexNormals();

  return new THREE.Mesh(merged, fallbackMaterial);
}
