import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app import OUTPUT_DIR, app
from test_photogrammetry import make_turntable_photos


class ReconstructionApiTests(unittest.TestCase):
    def test_multiview_route_returns_downloadable_stl(self):
        client = TestClient(app)
        photos = make_turntable_photos()
        files = [
            ("images", (f"view_{index:02}.png", photo, "image/png"))
            for index, photo in enumerate(photos)
        ]

        response = client.post(
            "/api/reconstruct-multiview",
            files=files,
            data={"target_format": "stl"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["input_photos"], 8)
        self.assertEqual(result["reconstruction_method"], "silhouette_visual_hull")
        self.assertTrue(result["is_watertight"])
        self.assertGreater(result["faces"], 100)

        download = client.get(result["download_url"])
        try:
            self.assertEqual(download.status_code, 200)
            self.assertGreater(len(download.content), 84)
            self.assertEqual(
                int.from_bytes(download.content[80:84], byteorder="little"),
                result["faces"],
            )
        finally:
            (Path(OUTPUT_DIR) / result["filename"]).unlink(missing_ok=True)

    def test_multiview_route_rejects_too_few_photos(self):
        files = [
            ("images", (f"view_{index}.png", photo, "image/png"))
            for index, photo in enumerate(make_turntable_photos(7))
        ]

        response = TestClient(app).post("/api/reconstruct-multiview", files=files)
        self.assertEqual(response.status_code, 400)
        self.assertIn("between 8 and 48 photos", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
