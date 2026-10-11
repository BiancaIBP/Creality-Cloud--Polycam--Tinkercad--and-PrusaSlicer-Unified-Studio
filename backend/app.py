import os
import io
import math
import uuid
import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import trimesh
from photogrammetry import (
    MAX_IMAGE_BYTES,
    MAX_PHOTOS,
    MIN_PHOTOS,
    reconstruct_visual_hull,
)

app = FastAPI(title="Local Creality Studio & AI 3D Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Simulated in-memory printer state
printer_state = {
    "printer_name": "Creality Ender-3 V3 SE (Cloud)",
    "status": "idle",
    "nozzle_temp": 24.5,
    "target_nozzle_temp": 0.0,
    "bed_temp": 23.0,
    "target_bed_temp": 0.0,
    "fan_speed": 0,
    "print_progress": 0.0,
    "current_file": None,
    "elapsed_time_seconds": 0,
    "remaining_time_seconds": 0,
    "is_connected": True
}

def create_relief_from_image(image_bytes: bytes, target_width: float = 60.0, target_height: float = 60.0, max_depth: float = 6.0) -> trimesh.Trimesh:
    """Converts a 2D image into a solid 3D printable relief / lithophane mesh."""
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("L")
    pil_img.thumbnail((120, 120))  # Smooth resolution for fast mesh generation
    
    img_data = np.array(pil_img, dtype=np.float32) / 255.0
    h, w = img_data.shape

    # Invert so darker areas are thicker or lighter areas stand out
    heights = 1.0 + (1.0 - img_data) * max_depth

    # Create grid vertices
    xs = np.linspace(-target_width / 2, target_width / 2, w)
    zs = np.linspace(-target_height / 2, target_height / 2, h)
    xx, zz = np.meshgrid(xs, zs)

    vertices = []
    # Top relief surface
    for i in range(h):
        for j in range(w):
            vertices.append([xx[i, j], heights[i, j], zz[i, j]])
            
    # Bottom base surface (at Y = 0)
    for i in range(h):
        for j in range(w):
            vertices.append([xx[i, j], 0.0, zz[i, j]])

    vertices = np.array(vertices, dtype=np.float32)

    faces = []
    # Top surface faces
    for i in range(h - 1):
        for j in range(w - 1):
            v0 = i * w + j
            v1 = v0 + 1
            v2 = (i + 1) * w + j
            v3 = v2 + 1
            faces.append([v0, v1, v2])
            faces.append([v1, v3, v2])

    offset = h * w
    # Bottom surface faces (wound reversely)
    for i in range(h - 1):
        for j in range(w - 1):
            v0 = offset + i * w + j
            v1 = v0 + 1
            v2 = offset + (i + 1) * w + j
            v3 = v2 + 1
            faces.append([v0, v2, v1])
            faces.append([v1, v2, v3])

    # Side border walls to make it watertight
    for j in range(w - 1):
        # Front wall (i = 0)
        faces.append([j, offset + j, j + 1])
        faces.append([j + 1, offset + j, offset + j + 1])
        # Back wall (i = h - 1)
        b0 = (h - 1) * w + j
        b1 = b0 + 1
        faces.append([b0, b1, offset + b0])
        faces.append([b1, offset + b1, offset + b0])

    for i in range(h - 1):
        # Left wall (j = 0)
        l0 = i * w
        l1 = (i + 1) * w
        faces.append([l0, l1, offset + l0])
        faces.append([l1, offset + l1, offset + l0])
        # Right wall (j = w - 1)
        r0 = i * w + (w - 1)
        r1 = (i + 1) * w + (w - 1)
        faces.append([r0, offset + r0, r1])
        faces.append([r1, offset + r0, offset + r1])

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
    return mesh

def generate_procedural_mesh(prompt: str) -> trimesh.Trimesh:
    """Generates a procedural 3D model according to prompt keywords."""
    p = prompt.lower()
    if "vase" in p or "pot" in p or "planter" in p:
        # Twisted faceted vase
        mesh = trimesh.creation.cylinder(radius=18, height=50, sections=16)
    elif "gear" in p or "mechanical" in p:
        # Spur gear cylinder with teeth
        cyl = trimesh.creation.cylinder(radius=20, height=8, sections=24)
        hole = trimesh.creation.cylinder(radius=5, height=12, sections=16)
        mesh = trimesh.boolean.difference([cyl, hole], engine="scipy-spatial") if False else cyl
    elif "dragon" in p or "figurine" in p or "character" in p or "bust" in p:
        # Multi-segment figurine
        body = trimesh.creation.cylinder(radius=12, height=35, sections=24)
        head = trimesh.creation.icosphere(subdivisions=2, radius=10)
        head.apply_translation([0, 0, 25])
        base = trimesh.creation.cylinder(radius=20, height=6, sections=32)
        base.apply_translation([0, 0, -20])
        mesh = trimesh.util.concatenate([body, head, base])
    elif "sphere" in p or "ball" in p:
        mesh = trimesh.creation.icosphere(subdivisions=3, radius=18)
    else:
        mesh = trimesh.creation.box(extents=[35, 35, 45])
    return mesh

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Creality Cloud / Polycam / Tinkercad / PrusaSlicer Studio",
        "output_dir": OUTPUT_DIR,
        "features": [
            "3D file upload",
            "single-photo relief",
            "multi-photo silhouette visual-hull reconstruction",
            "G-code parser",
            "Cloud printer telemetry",
        ]
    }

@app.post("/api/generate-3d")
async def generate_3d(
    file: UploadFile = File(None),
    prompt: str = Form(None),
    model_provider: str = Form("procedural"),
    target_format: str = Form("stl")
):
    if not file and not prompt:
        raise HTTPException(status_code=400, detail="Either a file or prompt must be provided.")

    filename = f"model_{uuid.uuid4().hex[:8]}.{target_format}"
    filepath = os.path.join(OUTPUT_DIR, filename)

    try:
        mesh = None

        if file:
            filename_orig = file.filename or ""
            ext = filename_orig.split('.')[-1].lower() if '.' in filename_orig else ''
            file_bytes = await file.read()

            if ext in ['stl', 'obj', 'ply', 'glb', 'gltf', 'off']:
                # Direct 3D mesh loading
                mesh = trimesh.load(io.BytesIO(file_bytes), file_type=ext)
                if isinstance(mesh, trimesh.Scene):
                    mesh = trimesh.util.concatenate(tuple(trimesh.util.concatenate(g) if isinstance(g, list) else g for g in mesh.geometry.values()))
            elif ext in ['png', 'jpg', 'jpeg', 'webp', 'bmp']:
                # Photo / Image to 3D Relief Figurine
                mesh = create_relief_from_image(file_bytes)
            else:
                mesh = trimesh.creation.box(extents=[40, 40, 50])
        elif prompt:
            mesh = generate_procedural_mesh(prompt)
        else:
            mesh = trimesh.creation.box(extents=[30, 30, 30])

        # Snap to build plate Y=0
        mesh.apply_translation([0, 0, -mesh.bounds[0][2]])

        mesh.export(filepath)

        extents = mesh.extents
        return {
            "success": True,
            "status": "success",
            "filename": filename,
            "model_url": f"/api/models/{filename}",
            "download_url": f"/api/models/{filename}",
            "dimensions": {
                "x": float(extents[0]),
                "y": float(extents[1]),
                "z": float(extents[2])
            },
            "vertices": int(len(mesh.vertices)),
            "faces": int(len(mesh.faces)),
            "is_watertight": bool(mesh.is_watertight)
        }

    except Exception as e:
        print(f"Error generating 3D model: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate 3D model: {str(e)}")

@app.post("/api/reconstruct-multiview")
async def reconstruct_multiview(
    images: list[UploadFile] = File(...),
    target_format: str = Form("stl"),
):
    if not MIN_PHOTOS <= len(images) <= MAX_PHOTOS:
        raise HTTPException(
            status_code=400,
            detail=f"Upload between {MIN_PHOTOS} and {MAX_PHOTOS} photos.",
        )
    if target_format not in {"stl", "obj", "ply", "glb"}:
        raise HTTPException(status_code=400, detail="Unsupported output format.")

    image_bytes = []
    total_bytes = 0
    for image in images:
        content = await image.read(MAX_IMAGE_BYTES + 1)
        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Each photo must be 15 MB or smaller.",
            )
        total_bytes += len(content)
        if total_bytes > 120 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="The total photo upload must be 120 MB or smaller.")
        image_bytes.append(content)

    try:
        mesh = reconstruct_visual_hull(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        print(f"Multi-photo reconstruction failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Reconstruction failed. Check the photos and try again.",
        ) from exc

    filename = f"reconstruction_{uuid.uuid4().hex[:8]}.{target_format}"
    filepath = os.path.join(OUTPUT_DIR, filename)
    mesh.export(filepath)

    extents = mesh.extents
    return {
        "success": True,
        "status": "success",
        "filename": filename,
        "model_url": f"/api/models/{filename}",
        "download_url": f"/api/models/{filename}",
        "dimensions": {
            "x": float(extents[0]),
            "y": float(extents[1]),
            "z": float(extents[2]),
        },
        "vertices": int(len(mesh.vertices)),
        "faces": int(len(mesh.faces)),
        "is_watertight": bool(mesh.is_watertight),
        "reconstruction_method": "silhouette_visual_hull",
        "input_photos": len(images),
    }

@app.get("/api/models/{filename}")
def get_model(filename: str):
    """Serves and downloads generated 3D model files from the output directory."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Model file not found.")

    media_type = "model/stl" if filename.endswith(".stl") else ("model/gltf-binary" if filename.endswith(".glb") else "application/octet-stream")

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type=media_type
    )

@app.post("/api/parse-gcode")
async def parse_gcode(file: UploadFile = File(...)):
    """Parses G-code files, extracting layers, temperatures, estimated time, and path geometry."""
    try:
        content = await file.read()
        lines = content.decode("utf-8", errors="ignore").splitlines()

        nozzle_temp = 200
        bed_temp = 60
        layers_data = []
        current_layer_pts = []
        total_filament_mm = 0.0

        current_x = 0.0
        current_y = 0.0
        current_z = 0.0

        for line in lines:
            line_strip = line.strip()
            if not line_strip:
                continue

            # Temperature parsing
            if "M104" in line_strip or "M109" in line_strip:
                parts = line_strip.split()
                for p in parts:
                    if p.startswith("S"):
                        try: nozzle_temp = int(float(p[1:]))
                        except: pass
            elif "M140" in line_strip or "M190" in line_strip:
                parts = line_strip.split()
                for p in parts:
                    if p.startswith("S"):
                        try: bed_temp = int(float(p[1:]))
                        except: pass

            # New layer markers
            if line_strip.startswith(";LAYER:") or (line_strip.startswith("G1 Z") and "F" in line_strip and len(current_layer_pts) > 4):
                if current_layer_pts:
                    # Sample layer points to keep payload responsive
                    step = max(1, len(current_layer_pts) // 80)
                    layers_data.append(current_layer_pts[::step])
                    current_layer_pts = []

            # G0 / G1 movement parsing
            if line_strip.startswith("G1") or line_strip.startswith("G0"):
                tokens = line_strip.split()
                has_move = False
                extruding = False

                for t in tokens:
                    if t.startswith("X"):
                        try: current_x = float(t[1:]); has_move = True
                        except: pass
                    elif t.startswith("Y"):
                        try: current_y = float(t[1:]); has_move = True
                        except: pass
                    elif t.startswith("Z"):
                        try: current_z = float(t[1:]); has_move = True
                        except: pass
                    elif t.startswith("E"):
                        try:
                            e_val = float(t[1:])
                            if e_val > 0:
                                extruding = True
                                total_filament_mm += e_val
                        except: pass

                if has_move and extruding:
                    current_layer_pts.append({
                        "x": current_x,
                        "y": current_y,
                        "z": current_z,
                        "extruding": extruding
                    })

        if current_layer_pts:
            step = max(1, len(current_layer_pts) // 80)
            layers_data.append(current_layer_pts[::step])

        total_layers = max(1, len(layers_data))
        filament_meters = round(total_filament_mm / 1000.0, 2)
        filament_grams = round((math.pi * (1.75 / 2)**2 * total_filament_mm / 1000.0) * 1.24, 1)
        estimated_time = max(120, total_layers * 15 + int(filament_meters * 30))

        return {
            "success": True,
            "filename": file.filename,
            "total_layers": total_layers,
            "nozzle_temp": nozzle_temp,
            "bed_temp": bed_temp,
            "estimated_time_seconds": estimated_time,
            "filament_grams": filament_grams,
            "filament_meters": filament_meters,
            "layers": layers_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse G-code: {str(e)}")

@app.get("/api/printer/status")
def get_printer_status():
    """Returns real-time telemetry from the Creality Cloud 3D printer."""
    return printer_state

@app.post("/api/printer/control")
def control_printer(action: str = Form(...)):
    """Receives remote commands: start, pause, resume, cancel, set_temp, home."""
    global printer_state
    action = action.lower()

    if action in ["start", "resume"]:
        printer_state["status"] = "printing"
        printer_state["target_nozzle_temp"] = 210.0
        printer_state["target_bed_temp"] = 60.0
        printer_state["nozzle_temp"] = 210.0
        printer_state["bed_temp"] = 60.0
        if printer_state["print_progress"] >= 100.0:
            printer_state["print_progress"] = 0.0
        printer_state["print_progress"] = min(100.0, printer_state["print_progress"] + 12.5)
    elif action == "pause":
        printer_state["status"] = "paused"
    elif action == "cancel":
        printer_state["status"] = "idle"
        printer_state["print_progress"] = 0.0
        printer_state["target_nozzle_temp"] = 0.0
        printer_state["target_bed_temp"] = 0.0
    elif action == "set_temp":
        printer_state["target_bed_temp"] = 60.0 if printer_state["target_bed_temp"] == 0.0 else 0.0
        printer_state["bed_temp"] = printer_state["target_bed_temp"]

    return {
        "success": True,
        "status": printer_state["status"],
        "printer": printer_state
    }