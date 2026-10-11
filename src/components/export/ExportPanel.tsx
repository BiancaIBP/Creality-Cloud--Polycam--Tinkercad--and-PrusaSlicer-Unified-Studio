"use client";

import React, { useState } from 'react';
import * as THREE from 'three';
import { ExportFormat, exportMesh } from '@/utils/exporters';
import { Download, FileCode, Check, Loader2 } from 'lucide-react';

interface ExportPanelProps {
  mesh: THREE.Mesh | null;
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: 'stl', label: 'STL (.stl)', desc: 'Standard 3D printing format (binary)' },
  { id: 'obj', label: 'Wavefront OBJ (.obj)', desc: 'Universal 3D geometry format' },
  { id: 'glb', label: 'GLTF / GLB (.glb)', desc: 'Web & AR optimized binary format' },
  { id: 'ply', label: 'Polygon File Format (.ply)', desc: 'High density 3D scan mesh' },
  { id: '3mf', label: '3D Manufacturing (.3mf)', desc: 'Modern slicer & multi-material format' }
];

export const ExportPanel: React.FC<ExportPanelProps> = ({ mesh }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('stl');
  const [filename, setFilename] = useState<string>('my_3d_figurine');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!mesh) return;
    setIsExporting(true);
    setExportError(null);
    try {
      await exportMesh(mesh, selectedFormat, filename || 'model');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err: unknown) {
      console.error('Export error:', err);
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3">
        <h3 className="font-semibold text-lg flex items-center gap-2 text-emerald-400">
          <Download className="w-5 h-5" /> Multi-Format Model Exporter
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Export full resolution 3D figurine mesh directly for 3D printing or rendering.
        </p>
      </div>

      {/* Filename Input */}
      <div>
        <label className="text-xs font-medium text-slate-300 block mb-1">
          Export File Name
        </label>
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="my_3d_figurine"
          className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
        />
      </div>

      {/* Format Selection Cards */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300 block">
          Select Output Format
        </label>
        <div className="grid grid-cols-1 gap-2">
          {FORMAT_OPTIONS.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setSelectedFormat(fmt.id)}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition ${
                selectedFormat === fmt.id
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileCode className={`w-4 h-4 ${selectedFormat === fmt.id ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-semibold">{fmt.label}</div>
                  <div className="text-[10px] text-slate-400">{fmt.desc}</div>
                </div>
              </div>
              {selectedFormat === fmt.id && <Check className="w-4 h-4 text-emerald-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Download Button */}
      <button
        onClick={handleExport}
        disabled={!mesh || isExporting}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
          downloadSuccess
            ? 'bg-emerald-600 text-white'
            : !mesh
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
        }`}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Processing & Packaging...
          </>
        ) : downloadSuccess ? (
          <>
            <Check className="w-4 h-4" /> Download Started!
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> Download 3D Model ({selectedFormat.toUpperCase()})
          </>
        )}
      </button>
      {exportError && (
        <p role="alert" className="text-xs text-rose-400">
          Export failed: {exportError}
        </p>
      )}
    </div>
  );
};
