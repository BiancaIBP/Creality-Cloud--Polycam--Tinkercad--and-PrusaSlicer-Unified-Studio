"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PrintBedGrid } from './PrintBedGrid';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';
import { ModelDimensions, ModelTransform } from '@/types/model';

interface ModelViewerProps {
  mesh: THREE.Mesh | null;
  gcodePaths?: THREE.Vector3[][][];
  activeLayer?: number;
  transform: ModelTransform;
  showBoundingBox?: boolean;
  wireframe?: boolean;
  onDimensionsCalculated?: (dims: ModelDimensions, bounds: THREE.Box3) => void;
}

const MeshContainer: React.FC<{
  mesh: THREE.Mesh;
  transform: ModelTransform;
  wireframe: boolean;
  onBoundsChange: (bounds: THREE.Box3, dimensions: ModelDimensions) => void;
}> = ({
  mesh,
  transform,
  wireframe,
  onBoundsChange
}) => {
  const meshRef = useRef<THREE.Group>(null);

  // Apply transforms and recalculate bounding box
  useEffect(() => {
    if (!meshRef.current) return;

    const group = meshRef.current;
    group.scale.set(...transform.scale);
    group.rotation.set(
      THREE.MathUtils.degToRad(transform.rotation[0]),
      THREE.MathUtils.degToRad(transform.rotation[1]),
      THREE.MathUtils.degToRad(transform.rotation[2])
    );
    group.position.set(...transform.position);

    group.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Compute surface area and estimated volume
    let volume = 0;
    let surfaceArea = 0;
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        const geom = m.geometry;
        if (geom) {
          volume = (size.x * size.y * size.z) / 1000.0; // in cm3 (mm3 -> cm3)
          surfaceArea = 2 * (size.x * size.y + size.y * size.z + size.x * size.z) / 100.0; // cm2
        }
      }
    });

    const dims: ModelDimensions = {
      x: size.x,
      y: size.z, // print bed orientation mapping
      z: size.y,
      volume: Math.max(0, volume),
      surfaceArea: Math.max(0, surfaceArea)
    };

    onBoundsChange(box, dims);
  }, [mesh, transform, onBoundsChange]);

  return (
    <group ref={meshRef}>
      <primitive object={mesh}>
        <meshStandardMaterial
          attach="material"
          color="#38bdf8"
          roughness={0.3}
          metalness={0.2}
          wireframe={wireframe}
          side={THREE.DoubleSide}
        />
      </primitive>
    </group>
  );
};

// Render G-code layer paths in 3D canvas using lineSegments
const GCodeVisualizer3D: React.FC<{ layerPaths: THREE.Vector3[][][]; activeLayer: number }> = ({ layerPaths, activeLayer }) => {
  const lineSegmentsObj = useMemo(() => {
    if (!layerPaths || layerPaths.length === 0) return null;

    const maxIdx = Math.min(activeLayer, layerPaths.length - 1);
    const points: number[] = [];

    for (let l = 0; l <= maxIdx; l++) {
      const layer = layerPaths[l];
      for (const path of layer) {
        if (path.length > 1) {
          for (let i = 0; i < path.length - 1; i++) {
            points.push(path[i].x, path[i].y, path[i].z);
            points.push(path[i + 1].x, path[i + 1].y, path[i + 1].z);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geometry;
  }, [layerPaths, activeLayer]);

  if (!lineSegmentsObj) return null;

  return (
    <lineSegments geometry={lineSegmentsObj}>
      <lineBasicMaterial color="#38bdf8" linewidth={1.5} />
    </lineSegments>
  );
};

export const ModelViewer: React.FC<ModelViewerProps> = ({
  mesh,
  gcodePaths,
  activeLayer = 0,
  transform,
  showBoundingBox = true,
  wireframe = false,
  onDimensionsCalculated
}) => {
  const [currentBounds, setCurrentBounds] = useState<THREE.Box3>(new THREE.Box3());
  const [currentDimensions, setCurrentDimensions] = useState<ModelDimensions>({
    x: 0,
    y: 0,
    z: 0,
    volume: 0,
    surfaceArea: 0
  });

  const handleBoundsChange = useCallback(
    (bounds: THREE.Box3, dims: ModelDimensions) => {
      setCurrentBounds(bounds);
      setCurrentDimensions(dims);
      onDimensionsCalculated?.(dims, bounds);
    },
    [onDimensionsCalculated],
  );

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl min-h-[400px]">
      <Canvas
        camera={{ position: [150, 150, 180], fov: 45, near: 0.1, far: 2000 }}
        shadows
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[100, 200, 100]} intensity={1.2} castShadow />
        <directionalLight position={[-100, 100, -100]} intensity={0.4} />

        <PrintBedGrid bedSizeX={220} bedSizeY={220} />

        {mesh && !gcodePaths && (
          <MeshContainer
            mesh={mesh}
            transform={transform}
            wireframe={wireframe}
            onBoundsChange={handleBoundsChange}
          />
        )}

        {gcodePaths && gcodePaths.length > 0 && (
          <GCodeVisualizer3D layerPaths={gcodePaths} activeLayer={activeLayer} />
        )}

        {showBoundingBox && mesh && !gcodePaths && (
          <BoundingBoxOverlay bounds={currentBounds} dimensions={currentDimensions} />
        )}

        <OrbitControls makeDefault minDistance={20} maxDistance={600} target={[0, 20, 0]} />
      </Canvas>
    </div>
  );
};
