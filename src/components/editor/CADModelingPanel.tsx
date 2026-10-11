"use client";

import React, { useState } from 'react';
import * as THREE from 'three';
import { CADPrimitiveType, UserTier } from '@/types/model';
import { createCADPrimitiveMesh } from '@/utils/meshProcessing';
import {
  Box,
  Cylinder,
  Disc,
  Crown,
  Sparkles,
  Plus,
  Lock,
  Circle,
  Triangle,
  Cog,
  Key,
  FolderArchive,
  Palette,
  type LucideIcon
} from 'lucide-react';

interface CADModelingPanelProps {
  onAddPrimitive: (mesh: THREE.Mesh) => void;
  userTier: UserTier;
}

const PRIMITIVES: {
  id: CADPrimitiveType;
  name: string;
  icon: LucideIcon;
  desc: string;
  category: 'basic' | 'functional';
  isPremium?: boolean;
}[] = [
  { id: 'cube', name: 'Box / Cube', icon: Box, desc: 'Solid square prism', category: 'basic' },
  { id: 'cylinder', name: 'Cylinder', icon: Cylinder, desc: 'Round standing cylinder', category: 'basic' },
  { id: 'sphere', name: 'Sphere', icon: Circle, desc: '3D smooth ball', category: 'basic' },
  { id: 'cone', name: 'Cone', icon: Disc, desc: 'Tapered conical shape', category: 'basic' },
  { id: 'pyramid', name: 'Pyramid', icon: Triangle, desc: '4-sided regular pyramid', category: 'basic' },
  { id: 'torus', name: 'Torus / Ring', icon: Crown, desc: 'Circular ring primitive', category: 'basic' },
  { id: 'gear', name: 'Mechanical Gear', icon: Cog, desc: 'Spur gear with shaft bore', category: 'functional' },
  { id: 'vase', name: 'Spiral Vase', icon: Disc, desc: 'Twisted geometric vase', category: 'functional' },
  { id: 'keychain', name: 'Text Keychain', icon: Key, desc: 'Personalized tag with ring hole', category: 'functional' },
  { id: 'container', name: 'Hollow Cup', icon: FolderArchive, desc: 'Open container with solid floor', category: 'functional' }
];

const COLORS = [
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Prusa Orange', hex: '#f97316' },
  { name: 'Creality Red', hex: '#ef4444' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Silk Gold', hex: '#eab308' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Slate Gray', hex: '#64748b' }
];

export const CADModelingPanel: React.FC<CADModelingPanelProps> = ({ onAddPrimitive, userTier }) => {
  const [selectedType, setSelectedType] = useState<CADPrimitiveType>('cube');
  const [width, setWidth] = useState<number>(30);
  const [height, setHeight] = useState<number>(30);
  const [depth, setDepth] = useState<number>(30);
  const [customText, setCustomText] = useState<string>('MAKER');
  const [selectedColor, setSelectedColor] = useState<string>('#38bdf8');

  const handleCreate = () => {
    const mesh = createCADPrimitiveMesh(
      selectedType,
      { width, height, depth },
      { customText, color: selectedColor }
    );
    onAddPrimitive(mesh);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2 text-indigo-400">
            <Box className="w-5 h-5" /> Tinkercad CAD Modeling & Maker
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Construct parametric shapes, mechanical parts, and custom keychains ready to print.
          </p>
        </div>
      </div>

      {/* Primitive Type Selection Grid */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300 block">Select Primitive or Object</label>
        <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
          {PRIMITIVES.map((p) => {
            const Icon = p.icon;
            const isLocked = p.isPremium && userTier === 'free';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedType(p.id);
                  if (p.id === 'gear') {
                    setWidth(40);
                    setHeight(10);
                    setDepth(40);
                  } else if (p.id === 'vase') {
                    setWidth(36);
                    setHeight(65);
                    setDepth(36);
                  } else if (p.id === 'keychain') {
                    setWidth(55);
                    setHeight(5);
                    setDepth(24);
                  }
                }}
                className={`p-2 rounded-lg border text-left flex items-start justify-between transition ${
                  selectedType === p.id
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${selectedType === p.id ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-semibold">{p.name}</div>
                    <div className="text-[9px] text-slate-500">{p.desc}</div>
                  </div>
                </div>
                {p.isPremium && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                    {isLocked ? <Lock className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />} PRO
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dimensional Inputs */}
      <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
        <label className="text-xs font-medium text-slate-300 block">Dimensions (mm)</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Width (X)</span>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(parseFloat(e.target.value) || 10)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Height (Z/Y)</span>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(parseFloat(e.target.value) || 10)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-1">Depth (Z)</span>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(parseFloat(e.target.value) || 10)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100"
            />
          </div>
        </div>

        {selectedType === 'keychain' && (
          <div className="pt-2 border-t border-slate-900">
            <span className="text-[10px] text-slate-400 block mb-1">Tag Emboss Text</span>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value.toUpperCase())}
              placeholder="YOUR NAME"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-indigo-300"
            />
          </div>
        )}
      </div>

      {/* Color / Filament Material */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-indigo-400" /> Filament Color Preview
        </label>
        <div className="flex gap-1.5 items-center">
          {COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setSelectedColor(c.hex)}
              title={c.name}
              style={{ backgroundColor: c.hex }}
              className={`w-6 h-6 rounded-full border-2 transition ${
                selectedColor === c.hex ? 'border-white scale-110 shadow-lg' : 'border-slate-800 opacity-80'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleCreate}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg"
      >
        <Plus className="w-4 h-4" /> Add & Make Object on Build Bed
      </button>
    </div>
  );
};
