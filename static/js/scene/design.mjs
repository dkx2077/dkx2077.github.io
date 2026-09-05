/** Shared dimensions and lighting keep editable faces, their housings, and reflections aligned. */
export const SIGN_LAYOUT = Object.freeze({
  name: { at: [-1.6, 7.2, -18.5], scale: 0.012, width: 840, height: 455, color: '#56e7d4' },
  about: { at: [-5.5, 2.8, -12], scale: 0.009, width: 600, height: 230, color: '#3aeadb' },
  research: { at: [17.2, 6, -7.6], scale: 0.011, width: 760, height: 255, color: '#32cfff' },
  featured: { at: [5.8, 3.5, -15], scale: 0.01, width: 620, height: 230, color: '#ec48cf' },
  direction: { at: [10.4, 8.6, -14.8], scale: 0.01, width: 370, height: 142, color: '#ed6594' },
  awards: { at: [1.4, 6.3, 19], scale: 0.014, width: 650, height: 265, color: '#ffa94e' },
  work: { at: [-18.3, 5.5, 0.6], scale: 0.012, width: 670, height: 238, color: '#ff3cb4' },
  contact: { at: [-13.7, 2.8, 9], scale: 0.011, width: 600, height: 230, color: '#40ddec' },
  district: { at: [12.5, 9.5, 12], scale: 0.01, width: 480, height: 142, color: '#839af0' },
});

// A bounded number of real lights, each paired with its actual facade and wet-ground glow.
export const DISTRICT_LIGHTS = Object.freeze([
  { at: [-8.8, 5.6, -10.8], color: '#08dfef', power: 205, reach: 33 },
  { at: [9, 5.2, -12.8], color: '#ed24b7', power: 215, reach: 31 },
  { at: [15.7, 5.1, -6.5], color: '#16bfff', power: 210, reach: 34 },
  { at: [1.2, 5.5, 17.5], color: '#ff8d32', power: 155, reach: 28 },
  { at: [-16.5, 4.8, 0.5], color: '#ec1eae', power: 225, reach: 33 },
]);

// Upper-storey floodlights have separate targets and do not create extra shadow maps.
export const FACADE_LIGHTS = Object.freeze([
  { at: [3, 7.5, 23], target: [3, 27, 39], color: '#0bd4e8', power: 1100 },
  { at: [-23, 7.5, -1], target: [-39, 25, -1], color: '#e824ae', power: 1180 },
]);
