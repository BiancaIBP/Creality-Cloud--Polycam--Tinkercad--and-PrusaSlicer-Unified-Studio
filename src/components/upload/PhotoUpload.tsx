"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import * as THREE from "three";
import {
  Upload,
  Sparkles,
  Loader2,
  Server,
  FileCode,
  Image as ImageIcon,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { load3DModelFromFile } from "@/utils/modelLoaders";
import {
  createLithophaneFromImage,
  createFigurineBustFromImage,
} from "@/utils/photoTo3D";

interface PhotoUploadProps {
  onMeshLoaded: (mesh: THREE.Mesh, title: string) => void;
  onModelGenerated?: (
    modelUrl: string,
    bboxDims: { x: number; y: number; z: number },
  ) => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onMeshLoaded,
}) => {
  const [activeUploadMode, setActiveUploadMode] = useState<"3d" | "photo">("3d");

  // 3D File Upload State
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [isParsing3D, setIsParsing3D] = useState<boolean>(false);
  const file3dInputRef = useRef<HTMLInputElement>(null);

  // Photo to 3D State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [reconstructionFiles, setReconstructionFiles] = useState<File[]>([]);
  const [photoStyle, setPhotoStyle] = useState<"relief" | "bust" | "backend" | "multiview">("relief");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [backendUrl, setBackendUrl] = useState<string>("http://127.0.0.1:8000");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const reconstructionInputRef = useRef<HTMLInputElement>(null);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  // Handle direct 3D model selection (STL, OBJ, GLB, GLTF, PLY)
  const handle3DFileSelect = async (file: File) => {
    setModelFile(file);
    setIsParsing3D(true);
    try {
      const mesh = await load3DModelFromFile(file);
      onMeshLoaded(mesh, file.name);
    } catch (err: unknown) {
      console.error("Failed to load 3D file:", err);
      alert(`3D File Load Error: ${getErrorMessage(err)}`);
    } finally {
      setIsParsing3D(false);
    }
  };

  // Handle 2D image selection (PNG, JPG, WEBP)
  const handlePhotoSelect = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleReconstructionPhotosSelect = (files: FileList | File[]) => {
    const selectedFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    setReconstructionFiles(selectedFiles.slice(0, 48));
  };

  // Convert photo to 3D
  const handleGenerateFromPhoto = async () => {
    const imageSource = selectedImage ?? "";
    if (photoStyle === "multiview" ? reconstructionFiles.length < 8 : !imageSource) return;
    setIsGenerating(true);

    try {
      if (photoStyle === "relief") {
        const mesh = await createLithophaneFromImage(imageSource, {
          width: 55,
          height: 55,
          maxDepth: 5.5,
          baseThickness: 2.0,
          resolution: 80,
        });
        onMeshLoaded(mesh, imageFile?.name ? `3D Relief - ${imageFile.name}` : "Photo 3D Relief");
      } else if (photoStyle === "bust") {
        const mesh = await createFigurineBustFromImage(imageSource, {
          width: 45,
          height: 45,
          maxDepth: 6.0,
          resolution: 75,
        });
        onMeshLoaded(mesh, imageFile?.name ? `Figurine Bust - ${imageFile.name}` : "Figurine Bust");
      } else if (photoStyle === "multiview") {
        const formData = new FormData();
        reconstructionFiles.forEach((file) => formData.append("images", file));
        formData.append("target_format", "stl");

        const res = await fetch(`${backendUrl}/api/reconstruct-multiview`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.download_url) {
          throw new Error(data.detail || `Server returned status ${res.status}`);
        }

        const fullUrl = data.download_url.startsWith("http")
          ? data.download_url
          : `${backendUrl}${data.download_url}`;
        const response = await fetch(fullUrl);
        if (!response.ok) {
          throw new Error(`Failed to download the reconstructed model (${response.status}).`);
        }
        const blob = await response.blob();
        const file = new File([blob], data.filename || "reconstructed_model.stl");
        const mesh = await load3DModelFromFile(file);
        onMeshLoaded(mesh, data.filename || "Multi-Photo 3D Model");
      } else {
        // Backend AI generation route
        const formData = new FormData();
        if (imageFile) formData.append("file", imageFile);
        formData.append("target_format", "stl");

        const res = await fetch(`${backendUrl}/api/generate-3d`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success || !data.download_url) {
          throw new Error(data.detail || `Server returned status ${res.status}`);
        }
        const fullUrl = data.download_url.startsWith("http")
          ? data.download_url
          : `${backendUrl}${data.download_url}`;
        const response = await fetch(fullUrl);
        if (!response.ok) {
          throw new Error(`Failed to download the generated model (${response.status}).`);
        }
        const blob = await response.blob();
        const file = new File([blob], data.filename || "generated_model.stl");
        const mesh = await load3DModelFromFile(file);
        onMeshLoaded(mesh, data.filename || "Generated 3D Model");
      }
    } catch (err: unknown) {
      console.error("Error generating 3D asset:", err);
      alert(`3D Generation Notice: ${getErrorMessage(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-4">
      {/* Header with Mode Switcher */}
      <div className="border-b border-slate-800 pb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-sky-400">
            <Upload className="w-5 h-5" /> Import & 3D Scanner
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
            STL • OBJ • GLB • Photo AI
          </span>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveUploadMode("3d")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition ${
              activeUploadMode === "3d"
                ? "bg-sky-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> Upload 3D File (STL/OBJ/GLB)
          </button>

          <button
            onClick={() => setActiveUploadMode("photo")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition ${
              activeUploadMode === "photo"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Photo to 3D Figurine
          </button>
        </div>
      </div>

      {/* MODE 1: Direct 3D Model Upload */}
      {activeUploadMode === "3d" && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handle3DFileSelect(e.dataTransfer.files[0]);
            }}
            onClick={() => file3dInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-sky-500 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[170px]"
          >
            <input
              type="file"
              ref={file3dInputRef}
              accept=".stl,.obj,.glb,.gltf,.ply"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handle3DFileSelect(e.target.files[0])}
            />

            {isParsing3D ? (
              <div className="space-y-2">
                <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-200">
                  Parsing 3D Geometry & Snapping to Bed...
                </p>
              </div>
            ) : modelFile ? (
              <div className="space-y-1.5">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-slate-200">{modelFile.name}</p>
                <p className="text-[10px] text-slate-400">
                  {(modelFile.size / (1024 * 1024)).toFixed(2)} MB • Ready in Studio
                </p>
                <span className="text-[11px] text-sky-400 underline block pt-1">
                  Click or drag another file to replace
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center mx-auto border border-sky-500/20">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  Drag & drop 3D model or click to browse
                </p>
                <p className="text-[10px] text-slate-400">
                  Supports <strong>.STL</strong>, <strong>.OBJ</strong>, <strong>.GLB</strong>, <strong>.GLTF</strong>, <strong>.PLY</strong>
                </p>
              </div>
            )}
          </div>

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Files are parsed client-side in WebGL, centered, and snapped to the print bed automatically.</span>
          </div>
        </div>
      )}

      {/* MODE 2: Photo & Image to 3D Figurine */}
      {activeUploadMode === "photo" && (
        <div className="space-y-3">
          {photoStyle === "multiview" ? (
            <div className="space-y-2">
              <input
                ref={reconstructionInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleReconstructionPhotosSelect(e.target.files)}
              />
              <button
                type="button"
                onClick={() => reconstructionInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleReconstructionPhotosSelect(e.dataTransfer.files);
                }}
                className="w-full border-2 border-dashed border-indigo-700 hover:border-indigo-500 bg-slate-950/60 rounded-xl p-5 text-center transition"
              >
                <ImageIcon className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <span className="block text-xs font-semibold text-slate-200">
                  {reconstructionFiles.length
                    ? `${reconstructionFiles.length} photos selected — click to replace`
                    : "Select or drop 8–48 photos"}
                </span>
                <span className="block text-[10px] text-slate-400 mt-1">
                  Choose in order around the object, evenly spaced through one full turn.
                </span>
              </button>
              {reconstructionFiles.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                  <span className="truncate">
                    {reconstructionFiles.slice(0, 3).map((file) => file.name).join(", ")}
                    {reconstructionFiles.length > 3 && `, +${reconstructionFiles.length - 3} more`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReconstructionFiles([])}
                    className="text-indigo-300 hover:text-indigo-200 shrink-0"
                  >
                    Clear
                  </button>
                </div>
              )}
              <p className="text-[10px] text-amber-300/90">
                Use a stationary camera and turntable, plain contrasting background, fixed lighting,
                and the same framing for every photo. This local visual-hull method reconstructs
                outer shape only; it does not infer texture or hidden surface detail.
              </p>
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handlePhotoSelect(e.dataTransfer.files[0]);
              }}
              onClick={() => photoInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[160px]"
            >
              <input
                type="file"
                ref={photoInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePhotoSelect(e.target.files[0])}
              />
              {selectedImage ? (
                <div className="space-y-2">
                  <Image
                    src={selectedImage}
                    alt="Uploaded source"
                    width={280}
                    height={130}
                    unoptimized
                    className="max-h-32 mx-auto rounded-lg object-contain shadow-md"
                    style={{ width: "auto" }}
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Click or drag another image to replace
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200">
                    Upload photo (portrait, pet, character, or object)
                  </p>
                  <p className="text-[10px] text-slate-400">Supports PNG, JPG, WEBP</p>
                </div>
              )}
            </div>
          )}

          {/* 3D Conversion Style Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 block">Conversion Style</label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setPhotoStyle("relief")}
                className={`p-2 rounded-lg border text-left transition ${
                  photoStyle === "relief"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="font-semibold text-[11px]">3D Relief</div>
                <div className="text-[9px] text-slate-500">Lithophane tile</div>
              </button>

              <button
                type="button"
                onClick={() => setPhotoStyle("bust")}
                className={`p-2 rounded-lg border text-left transition ${
                  photoStyle === "bust"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="font-semibold text-[11px]">Figurine Bust</div>
                <div className="text-[9px] text-slate-500">With pedestal base</div>
              </button>

              <button
                type="button"
                onClick={() => setPhotoStyle("backend")}
                className={`p-2 rounded-lg border text-left transition ${
                  photoStyle === "backend"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="font-semibold text-[11px]">Single-Photo Relief</div>
                <div className="text-[9px] text-slate-500">Server-generated lithophane</div>
              </button>

              <button
                type="button"
                onClick={() => setPhotoStyle("multiview")}
                className={`p-2 rounded-lg border text-left transition ${
                  photoStyle === "multiview"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                <div className="font-semibold text-[11px]">Multi-Photo 3D</div>
                <div className="text-[9px] text-slate-500">Local visual hull</div>
              </button>
            </div>
          </div>

          {(photoStyle === "backend" || photoStyle === "multiview") && (
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] flex items-center gap-1">
                  <Server className="w-3 h-3 text-indigo-400" /> Backend URL:
                </span>
                <input
                  type="text"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 text-[10px] w-36 font-mono"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerateFromPhoto}
            disabled={(photoStyle === "multiview" ? reconstructionFiles.length < 8 : !selectedImage) || isGenerating}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition shadow-lg ${
              (photoStyle === "multiview" ? reconstructionFiles.length < 8 : !selectedImage)
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : isGenerating
                  ? "bg-indigo-600/40 text-indigo-300 cursor-wait"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Converting to 3D Model...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {photoStyle === "multiview"
                  ? "Reconstruct 3D Model from Photo Set"
                  : "Generate 3D Model from Photo"}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
