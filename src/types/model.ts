import * as THREE from 'three';

export type UserTier = 'free' | 'premium';

export interface ModelTransform {
  scale: [number, number, number];
  rotation: [number, number, number]; // degrees
  position: [number, number, number];
}

export interface ModelDimensions {
  x: number; // width in mm
  y: number; // depth in mm
  z: number; // height in mm
  volume: number; // estimated cm3
  surfaceArea: number; // estimated cm2
}

export interface ModelMeshStats {
  vertices: number;
  triangles: number;
  isWatertight: boolean;
}

export interface SlicerSettings {
  layerHeight: number; // mm
  firstLayerHeight: number; // mm
  wallThickness: number; // mm
  infillDensity: number; // percentage (0 - 100)
  infillPattern: 'grid' | 'lines' | 'gyroid' | 'honeycomb';
  printSpeed: number; // mm/s
  travelSpeed: number; // mm/s
  nozzleTemp: number; // Celsius
  bedTemp: number; // Celsius
  filamentDiameter: number; // mm (default 1.75)
}

export interface SliceResult {
  gcode: string;
  totalLayers: number;
  estimatedTimeSeconds: number;
  filamentMeters: number;
  filamentGrams: number;
  layerPaths: THREE.Vector3[][][]; // layer -> polygons -> points
}

export interface PrinterStatus {
  printer_name: string;
  status: 'idle' | 'printing' | 'paused' | 'offline';
  nozzle_temp: number;
  target_nozzle_temp: number;
  bed_temp: number;
  target_bed_temp: number;
  fan_speed: number;
  print_progress: number;
  current_file: string | null;
  elapsed_time_seconds: number;
  remaining_time_seconds: number;
  is_connected: boolean;
}

export interface CloudModelItem {
  id: string;
  title: string;
  category: 'Miniatures' | 'Household' | 'Art' | 'Figures' | 'Tools';
  author: string;
  downloads: number;
  likes: number;
  image: string;
  gcodeAvailable: boolean;
  isPremiumOnly?: boolean;
  description: string;
}

export type CADPrimitiveType =
  | 'cube'
  | 'cylinder'
  | 'sphere'
  | 'cone'
  | 'ring'
  | 'torus'
  | 'pyramid'
  | 'wedge'
  | 'vase'
  | 'gear'
  | 'keychain'
  | 'container';

export interface GCodeMetadata {
  filename: string;
  totalLayers: number;
  nozzleTemp: number;
  bedTemp: number;
  estimatedTimeSeconds: number;
  filamentGrams: number;
  filamentMeters: number;
  layers: { x: number; y: number; z: number; extruding: boolean }[][];
}
