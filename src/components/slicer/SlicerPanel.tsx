"use client";

import React, { useState } from 'react';
import * as THREE from 'three';
import { SlicerSettings, SliceResult } from '@/types/model';
import { sliceMesh } from '@/utils/slicerEngine';
import { Scissors, Play, Layers, Clock, Weight, Download, Settings, Loader2 } from 'lucide-react';

interface SlicerPanelProps {
  mesh: THREE.Mesh | null;
  sliceResult: SliceResult | null;
  activeLayer: number;
  onSliceComplete: (result: SliceResult) => void;
  onActiveLayerChange: (layer: number) => void;
}

const DEFAULT_SETTINGS: SlicerSettings = {
  layerHeight: 0.2,
  firstLayerHeight: 0.2,
  wallThickness: 1.2,
  infillDensity: 20,
  infillPattern: 'grid',
  printSpeed: 60,
  travelSpeed: 120,
  nozzleTemp: 200,
  bedTemp: 60,
  filamentDiameter: 1.75
};

export const SlicerPanel: React.FC<SlicerPanelProps> = ({
  mesh,
  sliceResult,
  activeLayer,
  onSliceComplete,
  onActiveLayerChange
}) => {
  const [settings, setSettings] = useState<SlicerSettings>(DEFAULT_SETTINGS);
  const [isSlicing, setIsSlicing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const handleSlice = async () => {
    if (!mesh) return;
    setIsSlicing(true);
    setProgress(0);
    try {
      const result = await sliceMesh(mesh, settings, (p) => setProgress(p));
      onSliceComplete(result);
      onActiveLayerChange(result.totalLayers - 1);
    } catch (err) {
      console.error('Slicing error:', err);
    } finally {
      setIsSlicing(false);
    }
  };

  const downloadGCode = () => {
    if (!sliceResult) return;
    const blob = new Blob([sliceResult.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'figurine_print.gcode';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} min`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2 text-amber-400">
            <Scissors className="w-5 h-5" /> In-Browser G-Code Slicer
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Convert 3D mesh into printer G-code directly in WebAssembly / JS.
          </p>
        </div>
      </div>

      {/* Slicing Parameters Grid */}
      <div className="space-y-3">
        <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-amber-400" /> Print Settings
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <label className="text-[10px] text-slate-400 block mb-1">Layer Height (mm)</label>
            <input
              type="number"
              step="0.05"
              min="0.1"
              max="0.4"
              value={settings.layerHeight}
              onChange={(e) => setSettings({ ...settings, layerHeight: parseFloat(e.target.value) || 0.2 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <label className="text-[10px] text-slate-400 block mb-1">Infill Density (%)</label>
            <input
              type="number"
              step="5"
              min="0"
              max="100"
              value={settings.infillDensity}
              onChange={(e) => setSettings({ ...settings, infillDensity: parseInt(e.target.value) || 20 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <label className="text-[10px] text-slate-400 block mb-1">Print Speed (mm/s)</label>
            <input
              type="number"
              value={settings.printSpeed}
              onChange={(e) => setSettings({ ...settings, printSpeed: parseInt(e.target.value) || 60 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div className="bg-slate-950 p-2 rounded border border-slate-800">
            <label className="text-[10px] text-slate-400 block mb-1">Nozzle / Bed Temp (°C)</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={settings.nozzleTemp}
                onChange={(e) => setSettings({ ...settings, nozzleTemp: parseInt(e.target.value) || 200 })}
                className="w-1/2 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
              />
              <input
                type="number"
                value={settings.bedTemp}
                onChange={(e) => setSettings({ ...settings, bedTemp: parseInt(e.target.value) || 60 })}
                className="w-1/2 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Slice Execution Button */}
      <button
        onClick={handleSlice}
        disabled={!mesh || isSlicing}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
          !mesh
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : isSlicing
            ? 'bg-amber-600/40 text-amber-300 cursor-wait'
            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
        }`}
      >
        {isSlicing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Slicing Model ({Math.round(progress)}%)...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-current" /> Slice Model to G-Code
          </>
        )}
      </button>

      {/* Slice Output Results & G-code Layer Slider */}
      {sliceResult && (
        <div className="space-y-4 pt-2 border-t border-slate-800">
          {/* Metrics Overview */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Est. Time</span>
                <span className="font-bold">{formatTime(sliceResult.estimatedTimeSeconds)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Weight className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Filament</span>
                <span className="font-bold">{sliceResult.filamentGrams}g ({sliceResult.filamentMeters}m)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[10px] text-slate-400 block">Layers</span>
                <span className="font-bold">{sliceResult.totalLayers}</span>
              </div>
            </div>
          </div>

          {/* Interactive Layer Visualizer Slider */}
          <div className="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Interactive Layer Toolpath Preview</span>
              <span className="text-amber-400 font-mono font-bold">
                Layer {activeLayer + 1} / {sliceResult.totalLayers}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={sliceResult.totalLayers - 1}
              value={activeLayer}
              onChange={(e) => onActiveLayerChange(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Download G-code Button */}
          <button
            onClick={downloadGCode}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-amber-400" /> Export G-Code File (.gcode)
          </button>
        </div>
      )}
    </div>
  );
};
