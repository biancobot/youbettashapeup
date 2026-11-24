// Registry of fancy-shape modules. Each module exports `templates` and `plots`.
import * as marquise from './marquise.js?v=70';
import * as pear from './pear.js?v=70';
import * as heart from './heart.js?v=70';
import * as oval from './oval.js?v=70';
import * as cushion from './cushion.js?v=70';
import * as cushionModified from './cushionModified.js?v=70';
import * as princess from './princess.js?v=70';
import * as radiant from './radiant.js?v=70';
import * as emerald from './emerald.js?v=70';
import * as asscher from './asscher.js?v=70';
import * as shield from './shield.js?v=70';
import * as shieldStep from './shieldStep.js?v=70';
import * as trillion from './trillion.js?v=70';
import * as oldcuts from './oldcuts.js?v=70';

export const shapeModules = { marquise, pear, heart, oval, cushion, cushionModified, princess, radiant, emerald, asscher, shield, shieldStep, trillion, oldcuts };
export const shapeTemplates = Object.assign({}, ...Object.values(shapeModules).map((m) => m.templates || {}));
export const shapePlots = Object.values(shapeModules).flatMap((m) => m.plots || []);
