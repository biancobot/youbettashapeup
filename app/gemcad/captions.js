// Publishable captions for every design: a title per variant and one marketing description per
// shape, on what makes the shape special. Shapes are named by their geometry (as grading reports
// do), never by trade names that are or have been registered marks, and nothing here quotes a
// laboratory's text, so the captions can be printed as they are.
// One description per shape (every variant of a shape shares it); the title names the variant.
const D = {
  round: 'The round brilliant is the shape every other is measured against: fifty-seven facets worked out to return more light to the eye than any other cut, with the fire and flash that have made it the first choice for an engagement ring for a hundred years.',
  marquise: 'Long, slender and pointed at both ends, the marquise looks larger than any other cut of the same weight and has a silhouette that is unmistakable from across a room.',
  pear: 'A rounded head tapering to a single point, the pear brings softness and drama together in one teardrop, lit from end to end by its brilliant facets and looking larger face up than a round of the same weight.',
  heart: 'The heart\u2019s outline is the hardest of any cut to get right, two matching lobes, a crisp cleft and a clean point brought into perfect symmetry before a single facet is polished, and when it is right the stone is full of light and impossible to mistake for anything else.',
  oval: 'The oval has all the brilliance of a round with a longer, more graceful line, spreading its weight across a larger face so that it looks bigger than its carats.',
  cushion: 'With its soft corners and pillow-shaped outline, the cushion glows rather than glitters, throwing broad warm flashes with a feel of candlelight and antique jewelry about it.',
  cushionModified: 'A square cushion whose pavilion has been cut into a shimmer of small facets, so the stone sparkles the way light plays on crushed ice while keeping the cushion\u2019s gentle, pillow-shaped charm.',
  princess: 'Crisp, square and sharp-cornered, with a pavilion of chevrons that light it from corner to corner, the square modified brilliant is the clean contemporary answer to the round and puts more of the crystal into the ring than any other brilliant.',
  radiant: 'The cut-cornered rectangle takes the tailored outline of a step cut and fills it with brilliant-cut fire, dazzling from every part of the stone and hard-wearing at every corner.',
  emerald: 'The emerald cut does not sparkle, it gleams: long open step facets turn the stone into a hall of mirrors with a cool, architectural glamour that nothing else can match.',
  asscher: 'Deep clipped corners, a high crown and a small table make the square emerald cut the step cut at its most hypnotic, its facets forming a stair of concentric squares turning in to the center with all the poise of art deco jewelry.',
  shield: 'With a broad curved top, rounded shoulders and sides that sweep in to a point like the crest on a coat of arms, the shield is a rare, confident shape that fills its whole outline with brilliant light.',
  shieldStep: 'Six straight sides, a pointed base and rows of flat step facets that catch the light in bold clean flashes make the step-cut shield more armor than ornament, as modern as anything cut this year.',
  trillion: 'Three sides, three points and a blaze of light: the triangular brilliant is pure geometry, with a wide flat spread that makes it look far larger than its weight.',
  singleCut: 'The single cut is the brilliant stripped to its essentials, eight facets above and eight below, so that even the tiniest stones keep the crisp bright flashes that have set the sparkle in pav\u00e9 work for a century.',
  oldMine: 'The old mine cut is the brilliant as it was cut by candlelight, a squarish cushion with a small table, high crown, deep pavilion and open culet that throws big soft flashes and carries the romance of antique jewelry in every facet.',
  blank: 'A round preform with no facets yet: the beginning of a design.',
};
const CAPTIONS = {
  round: ['Round Brilliant', D.round],
  marquiseGia: ['Marquise Brilliant, French Tips', D.marquise],
  marquiseStd: ['Marquise Brilliant, Pointed Tips', D.marquise],
  marquise8: ['Marquise Brilliant, Pointed Tips', D.marquise],
  marquise4: ['Marquise Brilliant, Pointed Tips', D.marquise],
  marquiseSideHub: ['Marquise Brilliant, Side Hubs, French Tips', D.marquise],
  marquiseSideHubStd: ['Marquise Brilliant, Side Hubs, Pointed Tips', D.marquise],
  pear: ['Pear Brilliant, French Tip', D.pear],
  pearStd: ['Pear Brilliant, Pointed Tip', D.pear],
  heart: ['Heart Brilliant, French Tip', D.heart],
  heartHand: ['Heart Brilliant, Straighter Wings, French Tip', D.heart],
  heartHandStd: ['Heart Brilliant, Straighter Wings, Pointed Tip', D.heart],
  heartStd: ['Heart Brilliant, Pointed Tip', D.heart],
  oval: ['Oval Brilliant, Eight Mains', D.oval],
  oval8head: ['Oval Brilliant, Mains at the Ends', D.oval],
  oval4: ['Oval Brilliant, Four Mains', D.oval],
  cushion: ['Cushion Brilliant', D.cushion],
  cushionPoint: ['Cushion Brilliant, Pointed Culet', D.cushion],
  cushionModified: ['Square Cushion Modified Brilliant', D.cushionModified],
  princess: ['Square Modified Brilliant', D.princess],
  radiant: ['Cut-Cornered Rectangular Modified Brilliant', D.radiant],
  emerald: ['Emerald Cut', D.emerald],
  asscher: ['Square Emerald Cut', D.asscher],
  shield: ['Shield Brilliant, French Tip', D.shield],
  shieldStd: ['Shield Brilliant, Pointed Tip', D.shield],
  shieldStepKite: ['Kite Shield, Step Cut', D.shieldStep],
  shieldStepLong: ['Hexagonal Shield, Step Cut', D.shieldStep],
  shieldStepWide: ['Wide Shield, Step Cut', D.shieldStep],
  trillion: ['Triangular Brilliant, Curved Sides', D.trillion],
  trillionStraight: ['Triangular Brilliant, Straight Sides', D.trillion],
  trillionBrilliant: ['Triangular Brilliant, Corner Facets', D.trillion],
  singleCut: ['Single Cut', D.singleCut],
  oldMine: ['Old Mine Cut', D.oldMine],
  blank: ['Round Preform', D.blank],
};
const FAMILY = [[/round brilliant/i, 'round'], [/marquise/i, 'marquiseStd'], [/pear/i, 'pearStd'], [/heart/i, 'heartStd'], [/oval/i, 'oval'], [/cushion modified/i, 'cushionModified'], [/cushion/i, 'cushion'], [/princess|square modified/i, 'princess'], [/radiant/i, 'radiant'], [/asscher|square emerald/i, 'asscher'], [/emerald/i, 'emerald'], [/shield step|step cut/i, 'shieldStepKite'], [/shield/i, 'shieldStd'], [/trillion|triangular/i, 'trillion'], [/single cut/i, 'singleCut'], [/old mine/i, 'oldMine']];
/** The caption for a template key, or the nearest family's caption judged from a design name. */
export function captionFor(key, designName = '') {
  const c = CAPTIONS[key] || CAPTIONS[(FAMILY.find(([re]) => re.test(designName)) || [])[1]] || CAPTIONS.blank;
  return { title: c[0], description: c[1] };
}
export const captions = CAPTIONS;
