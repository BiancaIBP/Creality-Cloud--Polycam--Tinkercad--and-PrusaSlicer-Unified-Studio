"""Silhouette-based multi-view visual hull reconstruction."""

import io
from dataclasses import dataclass

import numpy as np
import trimesh
from PIL import Image
from scipy import ndimage
from skimage import measure

MIN_PHOTOS = 8
MAX_PHOTOS = 48
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_IMAGE_SIDE = 2048


@dataclass
class ViewSilhouette:
    mask: np.ndarray
    center_x: float
    center_y: float
    width: int
    height: int
    bbox_width: int
    bbox_height: int


def _extract_silhouette(image_bytes: bytes) -> ViewSilhouette:
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Each photo must be 15 MB or smaller.")
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image.load()
    except Exception as exc:
        raise ValueError("One of the uploaded files is not a valid image.") from exc

    if image.width > MAX_IMAGE_SIDE or image.height > MAX_IMAGE_SIDE:
        image.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.Resampling.LANCZOS)

    rgba = np.asarray(image.convert("RGBA"))
    rgb = rgba[:, :, :3].astype(np.int16)
    alpha = rgba[:, :, 3]
    height, width = alpha.shape

    if np.any(alpha < 250):
        foreground = alpha > 16
    else:
        border = np.concatenate(
            (rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]),
            axis=0,
        )
        background = np.median(border, axis=0)
        distance = np.sqrt(np.sum((rgb - background) ** 2, axis=2))
        foreground = distance > 38

    foreground = ndimage.binary_closing(foreground, structure=np.ones((3, 3)))
    labels, component_count = ndimage.label(foreground)
    if component_count == 0:
        raise ValueError(
            "Could not separate the object from the background. Use a plain, "
            "contrasting background or transparent-background photos."
        )

    component_sizes = np.bincount(labels.ravel())
    component_sizes[0] = 0
    foreground = labels == int(np.argmax(component_sizes))
    foreground = ndimage.binary_fill_holes(foreground)

    rows, columns = np.nonzero(foreground)
    if rows.size < width * height * 0.002:
        raise ValueError("The object silhouette is too small; move closer and retake the photo.")

    x_min, x_max = int(columns.min()), int(columns.max()) + 1
    y_min, y_max = int(rows.min()), int(rows.max()) + 1
    bbox_width, bbox_height = x_max - x_min, y_max - y_min
    if bbox_width > width * 0.95 or bbox_height > height * 0.98:
        raise ValueError(
            "The silhouette touches the image edge. Leave a visible margin around the object."
        )

    return ViewSilhouette(
        mask=foreground,
        center_x=(x_min + x_max - 1) / 2,
        center_y=(y_min + y_max - 1) / 2,
        width=width,
        height=height,
        bbox_width=bbox_width,
        bbox_height=bbox_height,
    )


def reconstruct_visual_hull(
    image_bytes: list[bytes],
    resolution: int = 80,
) -> trimesh.Trimesh:
    """Reconstruct a watertight visual hull from evenly spaced turntable photos."""
    if not MIN_PHOTOS <= len(image_bytes) <= MAX_PHOTOS:
        raise ValueError(f"Upload between {MIN_PHOTOS} and {MAX_PHOTOS} photos.")
    if not 48 <= resolution <= 128:
        raise ValueError("Reconstruction resolution must be between 48 and 128.")

    views = [_extract_silhouette(content) for content in image_bytes]
    reference_size = max(max(view.width, view.height) for view in views)
    pixel_scale = max(
        max(view.bbox_width, view.bbox_height) / max(view.width, view.height)
        for view in views
    ) * reference_size

    axis = np.linspace(-0.5, 0.5, resolution, dtype=np.float32)
    x, y, z = np.meshgrid(axis, axis, axis, indexing="ij")
    occupied = np.ones((resolution, resolution, resolution), dtype=bool)

    for view_index, view in enumerate(views):
        angle = 2 * np.pi * view_index / len(views)
        projected_x = x * np.cos(angle) + z * np.sin(angle)
        columns = np.rint(view.center_x + projected_x * pixel_scale).astype(np.int32)
        rows = np.rint(view.center_y - y * pixel_scale).astype(np.int32)

        in_frame = (
            (columns >= 0)
            & (columns < view.width)
            & (rows >= 0)
            & (rows < view.height)
        )
        inside = np.zeros_like(occupied)
        inside[in_frame] = view.mask[rows[in_frame], columns[in_frame]]
        occupied &= inside

    occupied = ndimage.binary_closing(occupied, structure=np.ones((3, 3, 3)))
    occupied = ndimage.binary_fill_holes(occupied)
    if int(occupied.sum()) < resolution**3 * 0.0005:
        raise ValueError(
            "The photos did not produce an overlapping 3D silhouette. Retake them "
            "with the object centered, similarly framed, and evenly rotated."
        )

    vertices, faces, _, _ = measure.marching_cubes(
        np.pad(occupied, 1),
        level=0.5,
        spacing=(1 / (resolution - 1),) * 3,
    )
    vertices -= 1 / (resolution - 1)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
    mesh.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(mesh)
    mesh.apply_scale(100 / float(mesh.extents.max()))
    mesh.apply_translation((0, 0, -float(mesh.bounds[0, 2])))
    return mesh
