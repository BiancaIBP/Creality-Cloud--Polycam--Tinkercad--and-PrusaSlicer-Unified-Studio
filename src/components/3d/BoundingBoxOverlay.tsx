"use client";

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { ModelDimensions } from '@/types/model';

interface BoundingBoxOverlayProps {
  bounds: THREE.Box3;
  dimensions: ModelDimensions;
  visible?: boolean;
}

export const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({ bounds, dimensions, visible = true }) => {
  const min = bounds.min;
  const max = bounds.max;

  const size = useMemo(() => {
    return new THREE.Vector3().subVectors(max, min);
  }, [min, max]);

  const center = useMemo(() => {
    return new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  }, [min, max]);

  const boxGeometry = useMemo(() => {
    return new THREE.BoxGeometry(size.x, size.y, size.z);
  }, [size.x, size.y, size.z]);

  const edges = useMemo(() => {
    return new THREE.EdgesGeometry(boxGeometry);
  }, [boxGeometry]);

  if (!visible || bounds.isEmpty()) return null;

  return (
    <group position={center}>
      {/* Wireframe box outlining object bounds */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#3b82f6" linewidth={2} />
      </lineSegments>

      {/* Axis Dimensions Labels */}
      {/* X Axis Label */}
      <Html position={[0, -size.y / 2 - 0.5, size.z / 2 + 0.5]} center>
        <div className="bg-slate-900/90 text-blue-400 font-mono text-xs px-2 py-0.5 rounded border border-blue-500/40 shadow-lg select-none whitespace-nowrap">
          X: {dimensions.x.toFixed(1)} mm
        </div>
      </Html>

      {/* Y Axis Label */}
      <Html position={[size.x / 2 + 0.5, -size.y / 2, 0]} center>
        <div className="bg-slate-900/90 text-green-400 font-mono text-xs px-2 py-0.5 rounded border border-green-500/40 shadow-lg select-none whitespace-nowrap">
          Y: {dimensions.y.toFixed(1)} mm
        </div>
      </Html>

      {/* Z Axis Label */}
      <Html position={[-size.x / 2 - 0.5, 0, 0]} center>
        <div className="bg-slate-900/90 text-amber-400 font-mono text-xs px-2 py-0.5 rounded border border-amber-500/40 shadow-lg select-none whitespace-nowrap">
          Z: {dimensions.z.toFixed(1)} mm
        </div>
      </Html>
    </group>
  );
};
