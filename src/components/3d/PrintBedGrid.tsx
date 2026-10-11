"use client";

import React, { useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

interface PrintBedGridProps {
  bedSizeX?: number; // default 220 mm
  bedSizeY?: number; // default 220 mm
}

export const PrintBedGrid: React.FC<PrintBedGridProps> = ({
  bedSizeX = 220,
  bedSizeY = 220,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Schedule state update after the initial render cycle completes
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(
      bedSizeX,
      bedSizeX / 10,
      "#3b82f6",
      "#1e293b",
    );
    grid.position.y = 0;
    return grid;
  }, [bedSizeX]);

  const borderGeometry = useMemo(() => {
    return new THREE.BoxGeometry(bedSizeX, 0.2, bedSizeY);
  }, [bedSizeX, bedSizeY]);

  return (
    <group position={[0, -0.01, 0]}>
      {/* Build Plate Plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        position={[0, -0.05, 0]}
      >
        <planeGeometry args={[bedSizeX, bedSizeY]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Grid Lines */}
      <primitive object={gridHelper} />

      {/* Outer Border Frame */}
      <lineSegments>
        <edgesGeometry args={[borderGeometry]} />
        <lineBasicMaterial color="#38bdf8" />
      </lineSegments>

      {/* Build Plate Dimension Label */}
      {isMounted && (
        <Html position={[-bedSizeX / 2 + 15, 0.5, bedSizeY / 2 - 10]}>
          <div className="text-[10px] text-slate-400 font-mono select-none bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700">
            Build Plate: {bedSizeX} × {bedSizeY} mm
          </div>
        </Html>
      )}
    </group>
  );
};
