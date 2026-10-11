import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { PLYExporter } from 'three/examples/jsm/exporters/PLYExporter.js';
import { strToU8, zipSync } from 'fflate';

export type ExportFormat = 'stl' | 'obj' | 'glb' | 'ply' | '3mf';

/**
 * Triggers a browser file download from a Blob or String.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function create3MFModel(mesh: THREE.Mesh): string {
  const exportGroup = new THREE.Group();
  const clonedMesh = mesh.clone();
  clonedMesh.geometry = mesh.geometry.clone();
  exportGroup.add(clonedMesh);
  exportGroup.updateMatrixWorld(true);

  const vertices: string[] = [];
  const triangles: string[] = [];

  exportGroup.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    const positions = geometry.getAttribute('position');
    if (!positions) {
      throw new Error('Cannot export a mesh without vertex positions.');
    }

    const vertexOffset = vertices.length;
    for (let i = 0; i < positions.count; i++) {
      vertices.push(
        `<vertex x="${positions.getX(i)}" y="${positions.getY(i)}" z="${positions.getZ(i)}"/>`,
      );
    }

    const index = geometry.getIndex();
    const triangleCount = index ? index.count : positions.count;
    if (triangleCount % 3 !== 0) {
      throw new Error('Cannot export geometry with an incomplete triangle.');
    }

    for (let i = 0; i < triangleCount; i += 3) {
      const v1 = vertexOffset + (index ? index.getX(i) : i);
      const v2 = vertexOffset + (index ? index.getX(i + 1) : i + 1);
      const v3 = vertexOffset + (index ? index.getX(i + 2) : i + 2);
      triangles.push(`<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`);
    }
    geometry.dispose();
  });

  if (vertices.length === 0 || triangles.length === 0) {
    throw new Error('Cannot export an empty mesh.');
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>${vertices.join('')}</vertices>
        <triangles>${triangles.join('')}</triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`;
}

/**
 * Exports a Three.js mesh object into the chosen file format.
 */
export async function exportMesh(mesh: THREE.Mesh, format: ExportFormat, filename: string = 'model') {
  if (!mesh) throw new Error('No mesh available for export.');

  // Create a clean object for exporting with applied transforms
  const exportGroup = new THREE.Group();
  const clonedMesh = mesh.clone();
  clonedMesh.geometry = mesh.geometry.clone();
  exportGroup.add(clonedMesh);

  switch (format) {
    case 'stl': {
      const exporter = new STLExporter();
      const result = exporter.parse(exportGroup, { binary: true });
      const blob = new Blob([result], { type: 'application/octet-stream' });
      downloadBlob(blob, `${filename}.stl`);
      break;
    }

    case 'obj': {
      const exporter = new OBJExporter();
      const result = exporter.parse(exportGroup);
      const blob = new Blob([result], { type: 'text/plain' });
      downloadBlob(blob, `${filename}.obj`);
      break;
    }

    case 'ply': {
      const exporter = new PLYExporter();
      const result = exporter.parse(exportGroup, () => {}, { binary: true });
      if (!result) throw new Error('PLY export did not produce a file.');
      const blob = new Blob([result], { type: 'application/octet-stream' });
      downloadBlob(blob, `${filename}.ply`);
      break;
    }

    case 'glb': {
      const exporter = new GLTFExporter();
      await new Promise<void>((resolve, reject) => {
        exporter.parse(
          exportGroup,
          (gltf) => {
            if (gltf instanceof ArrayBuffer) {
              const blob = new Blob([gltf], { type: 'model/gltf-binary' });
              downloadBlob(blob, `${filename}.glb`);
            } else {
              const output = JSON.stringify(gltf, null, 2);
              const blob = new Blob([output], { type: 'application/json' });
              downloadBlob(blob, `${filename}.gltf`);
            }
            resolve();
          },
          (error) => reject(new Error(error.message)),
          { binary: true }
        );
      });
      break;
    }

    case '3mf': {
      const model = create3MFModel(mesh);
      const archive = zipSync({
        '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`),
        '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`),
        '3D/3dmodel.model': strToU8(model),
      });
      const blob = new Blob([archive], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel' });
      downloadBlob(blob, `${filename}.3mf`);
      break;
    }

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
