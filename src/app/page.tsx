"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { PhotoUpload } from "@/components/upload/PhotoUpload";
import { CADModelingPanel } from "@/components/editor/CADModelingPanel";
import { MeshEditorControls } from "@/components/editor/MeshEditorControls";
import { GCodeEditorPanel } from "@/components/editor/GCodeEditorPanel";
import { ModelLibraryPanel } from "@/components/cloud/ModelLibraryPanel";
import { PrinterControllerPanel } from "@/components/cloud/PrinterControllerPanel";
import { ExportPanel } from "@/components/export/ExportPanel";
import { SlicerPanel } from "@/components/slicer/SlicerPanel";
import {
  ModelTransform,
  ModelDimensions,
  ModelMeshStats,
  SliceResult,
  UserTier,
  GCodeMetadata,
} from "@/types/model";
import {
  getMeshStats,
  centerAndSnapToBed,
  repairMeshGeometry,
  smoothMeshGeometry,
} from "@/utils/meshProcessing";
import {
  createCyberpunkFigurine,
  createArticulatedDragon,
  createGeometricPlanter,
  createMechanicalPiston,
} from "@/utils/libraryModels";
import { load3DModelFromFile, load3DModelFromUrl } from "@/utils/modelLoaders";
import {
  Box,
  Layers,
  Download,
  Sparkles,
  Sliders,
  Globe,
  Radio,
  FileCode,
  Shield,
  Zap,
  Upload,
  CheckCircle,
  Loader2,
} from "lucide-react";

// Dynamically import Three.js ModelViewer on client side only to avoid SSR hydration race conditions
const ModelViewer = dynamic(
  () => import("@/components/3d/ModelViewer").then((mod) => mod.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[500px] bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <span className="text-xs font-mono">Initializing 3D WebGL Studio Engine...</span>
      </div>
    ),
  }
);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function Home() {
  const [userTier, setUserTier] = useState<UserTier>("free");
  const [activeMesh, setActiveMesh] = useState<THREE.Mesh>(() => createCyberpunkFigurine());
  const [activeModelName, setActiveModelName] = useState<string>("Cyberpunk Figurine & Base");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [meshStats, setMeshStats] = useState<ModelMeshStats>(() => getMeshStats(activeMesh));

  const [dimensions, setDimensions] = useState<ModelDimensions>({
    x: 0,
    y: 0,
    z: 0,
    volume: 0,
    surfaceArea: 0,
  });

  const handleDimensionsCalculated = useCallback(
    (dims: ModelDimensions) => setDimensions(dims),
    [],
  );

  const [transform, setTransform] = useState<ModelTransform>({
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    position: [0, 0, 0],
  });

  const [uniformScale, setUniformScale] = useState<boolean>(true);
  const [sliceResult, setSliceResult] = useState<SliceResult | null>(null);
  const [gcodePaths, setGcodePaths] = useState<THREE.Vector3[][][] | undefined>(undefined);
  const [activeLayer, setActiveLayer] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    "library" | "scanner" | "cad" | "mesh" | "gcode" | "slice" | "export" | "printer"
  >("library");
  const [wireframe, setWireframe] = useState<boolean>(false);

  const headerFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load model from Creality Cloud Store
  const handleLoadLibraryModel = async (modelId: string, title: string) => {
    try {
      let mesh: THREE.Mesh;
      if (modelId === "1") {
        mesh = createCyberpunkFigurine();
      } else if (modelId === "2") {
        mesh = createArticulatedDragon();
      } else if (modelId === "3") {
        mesh = createGeometricPlanter();
      } else if (modelId === "4") {
        mesh = createMechanicalPiston();
      } else if (modelId.startsWith("http") || modelId.startsWith("/")) {
        mesh = await load3DModelFromUrl(modelId);
      } else {
        mesh = createCyberpunkFigurine();
      }

      setActiveMesh(mesh);
      setMeshStats(getMeshStats(mesh));
      setSliceResult(null);
      setGcodePaths(undefined);
      setActiveModelName(title);
      setActiveTab("mesh");
      showToast(`Loaded "${title}" into 3D Studio!`);
    } catch (err: unknown) {
      console.error("Error loading library model:", err);
      alert(`Model Load Error: ${getErrorMessage(err)}`);
    }
  };

  // Handler for direct 3D mesh upload or photo-to-3D generation
  const handleMeshLoaded = (mesh: THREE.Mesh, title: string) => {
    setActiveMesh(mesh);
    setMeshStats(getMeshStats(mesh));
    setSliceResult(null);
    setGcodePaths(undefined);
    setActiveModelName(title);
    setActiveTab("mesh");
    showToast(`Loaded "${title}" onto Build Bed!`);
  };

  // Header direct file upload handler
  const handleHeaderFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const mesh = await load3DModelFromFile(file);
      handleMeshLoaded(mesh, file.name);
    } catch (err: unknown) {
      console.error("Header upload failed:", err);
      alert(`Upload Error: ${getErrorMessage(err)}`);
    } finally {
      if (headerFileInputRef.current) headerFileInputRef.current.value = "";
    }
  };

  const handleAddPrimitive = (primitiveMesh: THREE.Mesh) => {
    setActiveMesh(primitiveMesh);
    setMeshStats(getMeshStats(primitiveMesh));
    setSliceResult(null);
    setGcodePaths(undefined);
    setActiveModelName("CAD Parametric Model");
    setActiveTab("mesh");
    showToast("Added shape to 3D Build Bed!");
  };

  const handleGCodeLoaded = (
    paths: THREE.Vector3[][][],
    metadata: GCodeMetadata,
  ) => {
    void metadata;
    setGcodePaths(paths);
    setActiveLayer(0);
    showToast(`Loaded ${paths.length} toolpath layers from ${metadata.filename}!`);
  };

  const handleAutoCenter = () => {
    if (!activeMesh) return;
    const centered = centerAndSnapToBed(activeMesh);
    setActiveMesh(centered);
    setMeshStats(getMeshStats(centered));
    showToast("Centered and snapped model to build plate (Y=0)");
  };

  const handleSmoothMesh = () => {
    if (!activeMesh) return;
    const smoothed = smoothMeshGeometry(activeMesh, 0.3, 1);
    setActiveMesh(smoothed);
    setMeshStats(getMeshStats(smoothed));
    showToast("Applied Laplacian smoothing to mesh geometry");
  };

  const handleRepairMesh = () => {
    if (!activeMesh) return;
    const repaired = repairMeshGeometry(activeMesh);
    setActiveMesh(repaired);
    setMeshStats(getMeshStats(repaired));
    showToast("Recomputed normals and repaired manifold topology");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-sky-600 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle className="w-4 h-4 text-sky-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-sky-500 via-indigo-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base bg-gradient-to-r from-sky-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
                Creality Studio • Polycam • Tinkercad • PrusaSlicer
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                Unified All-in-One Studio
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Scan • Design • CAD Sculpt • Slice • Multi-Export • Wireless Cloud Print
            </p>
          </div>
        </div>

        {/* Header Actions: Quick Upload + Tier Switch + Live Dimensions */}
        <div className="flex items-center gap-3">
          {/* Quick 3D File Upload Button in Navbar */}
          <input
            type="file"
            ref={headerFileInputRef}
            accept=".stl,.obj,.glb,.gltf,.ply"
            className="hidden"
            onChange={handleHeaderFileUpload}
          />
          <button
            onClick={() => headerFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition shadow-md shadow-sky-600/20"
            title="Upload any .STL, .OBJ, .GLB, .GLTF, or .PLY file"
          >
            <Upload className="w-3.5 h-3.5" /> Upload 3D File
          </button>

          {/* Free vs Premium Testing Switch */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setUserTier("free")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                userTier === "free"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Testing Mode (100% Free)
            </button>

            <button
              onClick={() => setUserTier("premium")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                userTier === "premium"
                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" /> Premium Plan Active
            </button>
          </div>

          {/* Real-Time Dimensions Header Metric */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Dimensions:</span>
            <span className="text-sky-400 font-bold">{dimensions.x.toFixed(1)}</span>
            <span className="text-slate-500"> × </span>
            <span className="text-emerald-400 font-bold">{dimensions.y.toFixed(1)}</span>
            <span className="text-slate-500"> × </span>
            <span className="text-amber-400 font-bold">{dimensions.z.toFixed(1)} mm</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 lg:p-6 max-w-[1920px] w-full mx-auto">
        {/* Left Navigation & Control Panel */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Main Workspace Action Tabs */}
          <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-4 gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("library")}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition ${
                activeTab === "library"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-4 h-4" /> Cloud Store
            </button>

            <button
              onClick={() => setActiveTab("scanner")}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition ${
                activeTab === "scanner"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-4 h-4" /> Upload / AI
            </button>

            <button
              onClick={() => setActiveTab("cad")}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition ${
                activeTab === "cad"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Box className="w-4 h-4" /> Tinkercad
            </button>

            <button
              onClick={() => setActiveTab("mesh")}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition ${
                activeTab === "mesh"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-4 h-4" /> Sculpt/Edit
            </button>

            <button
              onClick={() => setActiveTab("gcode")}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition ${
                activeTab === "gcode"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileCode className="w-4 h-4" /> G-Code Edit
            </button>

            <button
              onClick={() => setActiveTab("slice")}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition ${
                activeTab === "slice"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" /> PrusaSlicer
            </button>

            <button
              onClick={() => setActiveTab("export")}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition ${
                activeTab === "export"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Download className="w-4 h-4" /> Exporter
            </button>

            <button
              onClick={() => setActiveTab("printer")}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition ${
                activeTab === "printer"
                  ? "bg-sky-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-4 h-4" /> Cloud Print
            </button>
          </div>

          {/* Active Tool Viewport Panel */}
          <div className="flex-1">
            {activeTab === "library" && (
              <ModelLibraryPanel
                onLoadModel={handleLoadLibraryModel}
                userTier={userTier}
              />
            )}

            {activeTab === "scanner" && (
              <PhotoUpload onMeshLoaded={handleMeshLoaded} />
            )}

            {activeTab === "cad" && (
              <CADModelingPanel
                onAddPrimitive={handleAddPrimitive}
                userTier={userTier}
              />
            )}

            {activeTab === "mesh" && (
              <MeshEditorControls
                transform={transform}
                stats={meshStats}
                uniformScale={uniformScale}
                setUniformScale={setUniformScale}
                onTransformChange={setTransform}
                onAutoCenter={handleAutoCenter}
                onSmoothMesh={handleSmoothMesh}
                onRepairMesh={handleRepairMesh}
              />
            )}

            {activeTab === "gcode" && (
              <GCodeEditorPanel onGCodeLoaded={handleGCodeLoaded} />
            )}

            {activeTab === "slice" && (
              <SlicerPanel
                mesh={activeMesh}
                sliceResult={sliceResult}
                activeLayer={activeLayer}
                onSliceComplete={(res) => {
                  setSliceResult(res);
                  setGcodePaths(res.layerPaths);
                }}
                onActiveLayerChange={setActiveLayer}
              />
            )}

            {activeTab === "export" && <ExportPanel mesh={activeMesh} />}

            {activeTab === "printer" && <PrinterControllerPanel />}
          </div>
        </div>

        {/* Right Interactive 3D Canvas Viewport */}
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-[550px]">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">Current Model:</span>
              <span className="font-semibold text-sky-400">{activeModelName}</span>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => setWireframe(!wireframe)}
                className={`px-3 py-1 rounded-lg border font-medium transition ${
                  wireframe
                    ? "bg-sky-600/30 text-sky-300 border-sky-500"
                    : "bg-slate-950 text-slate-400 border-slate-800"
                }`}
              >
                {wireframe ? "Wireframe Mesh" : "Solid Shaded"}
              </button>
            </div>

            <div className="text-slate-400 font-mono flex items-center gap-3">
              <span>
                Volume:{" "}
                <strong className="text-slate-200">
                  {dimensions.volume.toFixed(1)} cm³
                </strong>
              </span>
              <span>
                Triangles:{" "}
                <strong className="text-slate-200">
                  {meshStats.triangles.toLocaleString("en-US")}
                </strong>
              </span>
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) {
                try {
                  const mesh = await load3DModelFromFile(file);
                  handleMeshLoaded(mesh, file.name);
                } catch (err: unknown) {
                  console.error("Drop load error:", err);
                  alert(`Drop Error: ${getErrorMessage(err)}`);
                }
              }
            }}
            className="flex-1 relative min-h-[500px]"
          >
            <ModelViewer
              mesh={activeMesh}
              gcodePaths={gcodePaths || sliceResult?.layerPaths}
              activeLayer={activeLayer}
              transform={transform}
              showBoundingBox={true}
              wireframe={wireframe}
              onDimensionsCalculated={handleDimensionsCalculated}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
