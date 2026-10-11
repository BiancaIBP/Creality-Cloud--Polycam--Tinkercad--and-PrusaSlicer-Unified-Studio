const API_BASE_URL = "http://127.0.0.1:8000";

export interface GenerateModelResponse {
  status: string;
  filename: string;
  vertices: number;
  faces: number;
  is_watertight: boolean;
  download_url: string;
}

export async function generate3DModel(
  prompt: string,
  targetFormat: string = "stl",
  file?: File,
): Promise<GenerateModelResponse> {
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("target_format", targetFormat);

  if (file) {
    formData.append("file", file);
  }

  const response = await fetch(`${API_BASE_URL}/api/generate-3d`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return response.json();
}

export function getModelUrl(downloadUrl: string): string {
  return `${API_BASE_URL}${downloadUrl}`;
}
