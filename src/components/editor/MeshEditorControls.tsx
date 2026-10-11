"use client";

import React from 'react';
import { ModelTransform, ModelMeshStats } from '@/types/model';
import { RotateCw, Maximize2, ShieldCheck, Sparkles, MoveDown, Lock, Unlock } from 'lucide-react';

interface MeshEditorControlsProps {
  transform: ModelTransform;
  stats: ModelMeshStats;
  uniformScale: boolean;
  setUniformScale: (val: boolean) => void;
  onTransformChange: (transform: ModelTransform) => void;
  onAutoCenter: () => void;
  onSmoothMesh: () => void;
  onRepairMesh: () => void;
}

export const MeshEditorControls: React.FC<MeshEditorControlsProps> = ({
  transform,
  stats,
  uniformScale,
  setUniformScale,
  onTransformChange,
  onAutoCenter,
  onSmoothMesh,
  onRepairMesh
}) => {
  const handleScaleChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const val = Math.max(0.05, value);
    if (uniformScale) {
      onTransformChange({
        ...transform,
        scale: [val, val, val]
      });
    } else {
      const newScale: [number, number, number] = [...transform.scale];
      if (axis === 'x') newScale[0] = val;
      if (axis === 'y') newScale[1] = val;
      if (axis === 'z') newScale[2] = val;
      onTransformChange({ ...transform, scale: newScale });
    }
  };

  const handleRotationChange = (axis: 'x' | 'y' | 'z', degrees: number) => {
    const newRot: [number, number, number] = [...transform.rotation];
    if (axis === 'x') newRot[0] = degrees;
    if (axis === 'y') newRot[1] = degrees;
    if (axis === 'z') newRot[2] = degrees;
    onTransformChange({ ...transform, rotation: newRot });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-semibold text-lg flex items-center gap-2 text-blue-400">
          <Maximize2 className="w-5 h-5" /> Mesh Editor & Transformations
        </h3>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          stats.isWatertight ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }`}>
          {stats.isWatertight ? 'Watertight Manifold' : 'Non-Manifold / Needs Repair'}
        </span>
      </div>

      {/* Mesh Statistics Bar */}
      <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg text-xs font-mono border border-slate-800">
        <div>
          <span className="text-slate-400 block">Vertices</span>
          <span className="text-slate-200 font-bold">{stats.vertices.toLocaleString("en-US")}</span>
        </div>
        <div>
          <span className="text-slate-400 block">Triangles / Faces</span>
          <span className="text-slate-200 font-bold">{stats.triangles.toLocaleString("en-US")}</span>
        </div>
      </div>

      {/* Scaling Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
            Scale Multiplier
          </label>
          <button
            onClick={() => setUniformScale(!uniformScale)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition ${
              uniformScale ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {uniformScale ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {uniformScale ? 'Uniform Scale' : 'Non-Uniform Scale'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['x', 'y', 'z'].map((axis, i) => (
            <div key={axis} className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">{axis} Scale</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={transform.scale[i]}
                onChange={(e) => handleScaleChange(axis as 'x' | 'y' | 'z', parseFloat(e.target.value) || 1)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rotation Controls */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
          <RotateCw className="w-4 h-4 text-blue-400" /> Rotation (Degrees)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {['x', 'y', 'z'].map((axis, i) => (
            <div key={axis} className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">{axis} Rotation</span>
              <input
                type="number"
                step="15"
                value={transform.rotation[i]}
                onChange={(e) => handleRotationChange(axis as 'x' | 'y' | 'z', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action Utility Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
        <button
          onClick={onAutoCenter}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg transition border border-slate-700 font-medium"
        >
          <MoveDown className="w-3.5 h-3.5 text-blue-400" /> Center & Snap to Bed
        </button>

        <button
          onClick={onSmoothMesh}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg transition border border-slate-700 font-medium"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Smooth Geometry
        </button>

        <button
          onClick={onRepairMesh}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-3 rounded-lg transition border border-slate-700 font-medium"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Auto-Repair Manifold
        </button>
      </div>
    </div>
  );
};
