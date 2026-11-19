// Predefined orientations. The camera is fixed on +Z looking at the origin with +Y up;
// a view is the rotation applied to the stone.
//
// Model axes: X = width (right in the face-up view), Y = length (head up), Z = table normal.
// Front  = face-up (table towards the viewer).      Back = pavilion towards the viewer.
// Top / Bottom / Left / Right are profile views taken from the head end, the point end and
// the two sides, each drawn with the table up as on a lab proportion diagram.
// Isometric keeps the face-up view dominant and tilts the stone to reveal the crown and girdle.

import * as THREE from '../vendor/three/three.module.js';

const q = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), (deg * Math.PI) / 180);
const mul = (...qs) => qs.reduce((acc, x) => acc.multiply(x), new THREE.Quaternion()); // apply right-most first

export const VIEWS = [
  { id: 'front', label: 'Front', q: new THREE.Quaternion() },
  { id: 'back', label: 'Back', q: q([0, 1, 0], 180) },
  { id: 'top', label: 'Top', q: q([0, 1, 1], 180) },
  { id: 'bottom', label: 'Bottom', q: q([1, 0, 0], -90) },
  { id: 'left', label: 'Left', q: mul(q([0, 0, 1], 90), q([0, 1, 0], 90)) },
  { id: 'right', label: 'Right', q: mul(q([0, 0, 1], -90), q([0, 1, 0], -90)) },
  { id: 'iso', label: 'Isometric', q: mul(q([1, 0, 0], -32), q([0, 1, 0], -32)) },
];

export function getView(id) {
  return VIEWS.find((v) => v.id === id) || VIEWS[0];
}
