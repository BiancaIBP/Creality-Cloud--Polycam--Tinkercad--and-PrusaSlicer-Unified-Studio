"use client";

import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { GCodeMetadata } from '@/types/model';
import { FileCode, Upload, Download, Settings, Play, Loader2, CheckCircle2 } from 'lucide-react';

interface GCodeEditorPanelProps {
  onGCodeLoaded: (paths: THREE.Vector3[][][], metadata: GCodeMetadata) => void;
}

const BACKEND_URL = 'http://127.0.0.1:8000';

export const GCodeEditorPanel: React.FC<GCodeEditorPanelProps> = ({ onGCodeLoaded }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parsedMeta, setParsedMeta] = useState<GCodeMetadata | null>(null);

  // Editable parameters
  const [editedNozzleTemp, setEditedNozzleTemp] = useState<number>(210);
  const [editedBedTemp, setEditedBedTemp] = useState<number>(60);
  const [rawGCode, setRawGCode] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.gcode') && !file.name.endsWith('.g')) return;
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawGCode(text);
    };
    reader.readAsText(file);
  };

  const parseGCodeClientSide = (gcodeText: string, filename: string): { paths: THREE.Vector3[][][]; meta: GCodeMetadata } => {
    const lines = gcodeText.split('\n');
    let nozzleTemp = 200;
    let bedTemp = 60;
    let totalFilamentMM = 0;

    const layers: { x: number; y: number; z: number; extruding: boolean }[][] = [];
    let currentLayerPts: { x: number; y: number; z: number; extruding: boolean }[] = [];

    let currentX = 0;
    let currentY = 0;
    let currentZ = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.includes('M104') || line.includes('M109')) {
        const match = line.match(/S(\d+)/);
        if (match) nozzleTemp = parseInt(match[1]);
      } else if (line.includes('M140') || line.includes('M190')) {
        const match = line.match(/S(\d+)/);
        if (match) bedTemp = parseInt(match[1]);
      }

      if (line.startsWith(';LAYER:') || (line.startsWith('G1 Z') && currentLayerPts.length > 5)) {
        if (currentLayerPts.length > 0) {
          const step = Math.max(1, Math.floor(currentLayerPts.length / 100));
          layers.push(currentLayerPts.filter((_, idx) => idx % step === 0));
          currentLayerPts = [];
        }
      }

      if (line.startsWith('G1') || line.startsWith('G0')) {
        const xMatch = line.match(/X([-\d.]+)/);
        const yMatch = line.match(/Y([-\d.]+)/);
        const zMatch = line.match(/Z([-\d.]+)/);
        const eMatch = line.match(/E([-\d.]+)/);

        if (xMatch) currentX = parseFloat(xMatch[1]);
        if (yMatch) currentY = parseFloat(yMatch[1]);
        if (zMatch) currentZ = parseFloat(zMatch[1]);

        let isExtruding = false;
        if (eMatch) {
          const eVal = parseFloat(eMatch[1]);
          if (eVal > 0) {
            isExtruding = true;
            totalFilamentMM += eVal;
          }
        }

        if (isExtruding) {
          currentLayerPts.push({
            x: currentX,
            y: currentY,
            z: currentZ,
            extruding: true
          });
        }
      }
    }

    if (currentLayerPts.length > 0) {
      const step = Math.max(1, Math.floor(currentLayerPts.length / 100));
      layers.push(currentLayerPts.filter((_, idx) => idx % step === 0));
    }

    const totalLayers = Math.max(1, layers.length);
    const filamentMeters = Math.round((totalFilamentMM / 1000) * 100) / 100;
    const filamentGrams = Math.round((Math.PI * Math.pow(1.75 / 2, 2) * totalFilamentMM / 1000) * 1.24 * 10) / 10;
    const estTime = Math.max(60, totalLayers * 12 + Math.floor(filamentMeters * 35));

    // Convert to Three.js Vector3 coords (center bed offset: X - 110, Y - 110)
    const vectorPaths: THREE.Vector3[][][] = layers.map((layer) => {
      const path = layer.map((pt) => new THREE.Vector3(pt.x - 110, pt.z, pt.y - 110));
      return [path];
    });

    const meta: GCodeMetadata = {
      filename,
      totalLayers,
      nozzleTemp,
      bedTemp,
      estimatedTimeSeconds: estTime,
      filamentGrams,
      filamentMeters,
      layers
    };

    return { paths: vectorPaths, meta };
  };

  const handleParseAndLoad = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    try {
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        let res: Response;
        try {
          res = await fetch(`${BACKEND_URL}/api/parse-gcode`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const metadata: GCodeMetadata = {
              filename: data.filename,
              totalLayers: data.total_layers,
              nozzleTemp: data.nozzle_temp,
              bedTemp: data.bed_temp,
              estimatedTimeSeconds: data.estimated_time_seconds,
              filamentGrams: data.filament_grams,
              filamentMeters: data.filament_meters,
              layers: data.layers
            };

            setParsedMeta(metadata);
            setEditedNozzleTemp(data.nozzle_temp || 210);
            setEditedBedTemp(data.bed_temp || 60);

            const vectorLayers: THREE.Vector3[][][] = metadata.layers.map((layer) => {
              const path: THREE.Vector3[] = layer.map((pt) => new THREE.Vector3(pt.x - 110, pt.z, pt.y - 110));
              return [path];
            });

            onGCodeLoaded(vectorLayers, metadata);
            return;
          }
        }
      } catch {
        // Fall back to client-side parsing when the backend is unavailable.
      }

      const { paths, meta } = parseGCodeClientSide(rawGCode, selectedFile.name);
      setParsedMeta(meta);
      setEditedNozzleTemp(meta.nozzleTemp);
      setEditedBedTemp(meta.bedTemp);
      onGCodeLoaded(paths, meta);
    } catch (err: unknown) {
      console.error('Error parsing G-code:', err);
      alert(`G-Code Parse Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportEditedGCode = () => {
    if (!rawGCode) return;
    let modified = rawGCode;
    modified = modified.replace(/M104 S\d+/g, `M104 S${editedNozzleTemp}`);
    modified = modified.replace(/M109 S\d+/g, `M109 S${editedNozzleTemp}`);
    modified = modified.replace(/M140 S\d+/g, `M140 S${editedBedTemp}`);
    modified = modified.replace(/M190 S\d+/g, `M190 S${editedBedTemp}`);

    const blob = new Blob([modified], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modified_${selectedFile?.name || 'edited.gcode'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2 text-cyan-400">
            <FileCode className="w-5 h-5" /> G-Code Toolpath Re-Editor Studio
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Upload existing .gcode files to preview toolpaths in 3D, modify temperatures, and re-export.
          </p>
        </div>
      </div>

      {/* Upload Drop Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950/60 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[120px]"
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".gcode,.g"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        {selectedFile ? (
          <div className="space-y-1">
            <CheckCircle2 className="w-8 h-8 text-cyan-400 mx-auto" />
            <p className="text-xs font-bold text-slate-200">{selectedFile.name}</p>
            <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB loaded</p>
            <span className="text-[10px] text-cyan-400 underline block">Click to replace file</span>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="w-6 h-6 text-cyan-400 mx-auto" />
            <p className="text-xs font-medium text-slate-300">Click or drag existing .gcode file</p>
            <p className="text-[10px] text-slate-400">Supports Creality, Prusa, Cura, Bambu G-code</p>
          </div>
        )}
      </div>

      <button
        onClick={handleParseAndLoad}
        disabled={!selectedFile || isProcessing}
        className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition ${
          !selectedFile
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : isProcessing
            ? 'bg-cyan-600/40 text-cyan-300 cursor-wait'
            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg'
        }`}
      >
        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        Visualize Toolpath & Parse G-Code
      </button>

      {parsedMeta && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            <div>
              <span className="text-slate-400 block text-[9px]">Layers</span>
              <span className="font-bold text-cyan-300">{parsedMeta.totalLayers}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">Filament</span>
              <span className="font-bold text-slate-200">{parsedMeta.filamentGrams}g</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">Est. Time</span>
              <span className="font-bold text-slate-200">{Math.round(parsedMeta.estimatedTimeSeconds / 60)} min</span>
            </div>
          </div>

          <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
              <Settings className="w-3.5 h-3.5 text-cyan-400" /> Header Temperature Modifiers
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Nozzle Temp (°C)</span>
                <input
                  type="number"
                  value={editedNozzleTemp}
                  onChange={(e) => setEditedNozzleTemp(parseInt(e.target.value) || 200)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Bed Temp (°C)</span>
                <input
                  type="number"
                  value={editedBedTemp}
                  onChange={(e) => setEditedBedTemp(parseInt(e.target.value) || 60)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleExportEditedGCode}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-cyan-400" /> Export Modified G-Code File
          </button>
        </div>
      )}
    </div>
  );
};
