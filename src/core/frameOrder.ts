/**
 * useFrame priorities. Negative values run before the default (0) and never
 * take over rendering, so each frame the ride moves the train, the train
 * places its cars, and only then does the camera frame them. Without a fixed
 * order the camera can read last frame's train and the motion judders.
 * Resolution changes come first of all: R3F resets the camera's aspect when the
 * pixel ratio changes, and the camera has to put its view offset back before
 * the frame is drawn, or that frame renders stretched.
 */
export const FRAME = {
  quality: -40,
  ride: -30,
  train: -20,
  camera: -10,
} as const
