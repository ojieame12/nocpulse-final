export type MapExtrusionMaterial = {
  ambient: number;
  diffuse: number;
  shininess: number;
  specularColor: [red: number, green: number, blue: number];
};

export const DEFAULT_MAP_EXTRUSION_MATERIAL: MapExtrusionMaterial = {
  ambient: 0.40,
  diffuse: 1.0,
  shininess: 28,
  specularColor: [255, 255, 255],
};
