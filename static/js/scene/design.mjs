/** Shared dimensions and lighting keep editable faces, their housings, and reflections aligned. */
export const SIGN_LAYOUT = Object.freeze({
  name: { at: [-1.6, 7.2, -18.5], scale: 0.012, width: 840, height: 455, color: '#b7ecb8' },
  university: { at: [-10.8, 7.4, -12.5], scale: 0.011, width: 225, height: 590, color: '#74dcec' },
  about: { at: [-5.5, 2.8, -12], scale: 0.009, width: 600, height: 230, color: '#7de3df' },
  research: { at: [17.2, 6, -7.6], scale: 0.011, width: 760, height: 255, color: '#7cdaff' },
  featured: { at: [5.8, 3.5, -15], scale: 0.01, width: 620, height: 230, color: '#caa5ec' },
  direction: { at: [10.4, 8.6, -14.8], scale: 0.01, width: 370, height: 142, color: '#f398a6' },
  awards: { at: [1.4, 6.3, 19], scale: 0.014, width: 650, height: 265, color: '#f2bb77' },
  work: { at: [-18.3, 5.5, 0.6], scale: 0.012, width: 670, height: 238, color: '#e68cc6' },
  contact: { at: [-13.7, 2.8, 9], scale: 0.011, width: 600, height: 230, color: '#88d8e7' },
  district: { at: [12.5, 9.5, 12], scale: 0.01, width: 480, height: 142, color: '#93c3e9' },
});

// A bounded number of real lights, each paired with its actual facade and wet-ground glow.
export const DISTRICT_LIGHTS = Object.freeze([
  { at: [-8.8, 5.6, -10.8], color: '#48dfe7', power: 90 },
  { at: [9, 5.2, -12.8], color: '#df59b8', power: 88 },
  { at: [15.7, 5.1, -6.5], color: '#68caff', power: 82 },
  { at: [1.2, 5.5, 17.5], color: '#edaa5b', power: 82 },
  { at: [-16.5, 4.8, 0.5], color: '#cb69ce', power: 84 },
]);
