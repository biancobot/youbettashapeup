// Registry of fancy-shape modules. Each module exports `templates` and `plots`.
import * as marquise from './marquise.js';
import * as pear from './pear.js';
import * as heart from './heart.js';
import * as oval from './oval.js';
import * as cushion from './cushion.js';
import * as cushionModified from './cushionModified.js';
import * as princess from './princess.js';
import * as radiant from './radiant.js';
import * as emerald from './emerald.js';
import * as asscher from './asscher.js';

export const shapeModules = { marquise, pear, heart, oval, cushion, cushionModified, princess, radiant, emerald, asscher };
export const shapeTemplates = Object.assign({}, ...Object.values(shapeModules).map((m) => m.templates || {}));
export const shapePlots = Object.values(shapeModules).flatMap((m) => m.plots || []);
