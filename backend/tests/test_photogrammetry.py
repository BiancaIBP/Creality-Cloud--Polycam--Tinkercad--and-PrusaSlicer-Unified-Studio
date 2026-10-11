import io
import unittest

import numpy as np
import trimesh
from PIL import Image, ImageDraw

from photogrammetry import reconstruct_visual_hull


def make_turntable_photos(count: int = 8) -> list[bytes]:
    photos = []
    for index in range(count):
        angle = 2 * np.pi * index / count
        radius_x = 0.42
        radius_z = 0.24
        half_width = np.sqrt(
            (radius_x * np.cos(angle)) ** 2
            + (radius_z * np.sin(angle)) ** 2
        )
        image = Image.new("RGB", (256, 256), "white")
        draw = ImageDraw.Draw(image)
        draw.ellipse(
            (
                128 - half_width * 150,
                128 - 0.32 * 150,
                128 + half_width * 150,
                128 + 0.32 * 150,
            ),
            fill="black",
        )
        output = io.BytesIO()
        image.save(output, format="PNG")
        photos.append(output.getvalue())
    return photos


class VisualHullTests(unittest.TestCase):
    def test_turntable_photos_generate_closed_three_dimensional_mesh(self):
        mesh = reconstruct_visual_hull(make_turntable_photos(), resolution=56)

        self.assertIsInstance(mesh, trimesh.Trimesh)
        self.assertGreater(len(mesh.vertices), 100)
        self.assertGreater(len(mesh.faces), 100)
        self.assertTrue(mesh.is_watertight)
        self.assertGreater(float(mesh.extents.min()), 0)
        self.assertAlmostEqual(float(mesh.extents.max()), 100, places=3)
        self.assertAlmostEqual(float(mesh.bounds[0, 2]), 0, places=3)

    def test_rejects_too_few_photos(self):
        with self.assertRaisesRegex(ValueError, "between 8 and 48 photos"):
            reconstruct_visual_hull(make_turntable_photos(7))

    def test_rejects_images_without_separable_object(self):
        image = Image.new("RGB", (128, 128), "white")
        output = io.BytesIO()
        image.save(output, format="PNG")
        with self.assertRaisesRegex(ValueError, "Could not separate the object"):
            reconstruct_visual_hull([output.getvalue()] * 8)


if __name__ == "__main__":
    unittest.main()
