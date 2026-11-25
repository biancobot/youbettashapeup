// Publishable captions for every design: a title per variant and one marketing description per
// shape, on what makes the shape special. Shapes are named by their geometry (as grading reports
// do), never by trade names that are or have been registered marks, and nothing here quotes a
// laboratory's text, so the captions can be printed as they are.
// One description per shape (every variant of a shape shares it); the title names the variant.
const D = {
  round: 'The round brilliant is the shape every other is measured against. Its fifty-seven facets were worked out to send light back to the eye from every angle, and no other cut returns more of it, with the fire and the flash that have made it the first choice for an engagement ring for a hundred years. Classic, symmetrical and endlessly versatile, it belongs in every setting ever made.',
  marquise: 'Long, slender and pointed at both ends, the marquise makes a stone look larger than its weight and a hand look longer than it is. Its two points draw the eye along the finger, its brilliant faceting fills the whole length with light, and the silhouette is unmistakable from across a room. A cut with a sense of theatre.',
  pear: 'The pear brings together the softness of a rounded head and the drama of a single point, a teardrop that reads as elegant whether it hangs from an ear, sits at the throat or points down a finger. Its tapered outline flatters the hand, its brilliant facets light the whole drop, and it looks larger face up than a round of the same weight.',
  heart: 'The heart is the most romantic of all the cuts, and the hardest to cut well: two matching lobes, a crisp cleft and a clean point have to be brought into perfect symmetry before the brilliant faceting can be laid over them. Done right, it is a declaration in a single stone, full of light and impossible to mistake for anything else.',
  oval: 'The oval has the brilliance of a round with a longer, more graceful line. It spreads its weight across a larger face than a round of the same carat, flatters the finger it sits on, and its gentle curves make an easy, modern alternative to the classic circle without giving up any of the sparkle.',
  cushion: 'Soft corners, a pillow-shaped outline and a glow that is warmer and more diffused than a round brilliant: the cushion is the romantic\u2019s choice, with a feel of candlelight and old jewellery about it. Its larger facets throw broad, bright flashes, and the rounded corners make it as comfortable to wear as it is to look at.',
  cushionModified: 'A square cushion whose pavilion has been cut into a shimmer of small facets, so the stone sparkles the way light plays on crushed ice. The soft, pillow-shaped outline keeps the cushion\u2019s gentle charm while the dense faceting fills it with a restless, glittering light that never seems to settle.',
  princess: 'Crisp, square and sharp-cornered, with a pavilion of chevrons that light it from corner to corner: the square modified brilliant is the clean, contemporary answer to the round. It keeps more of the rough crystal than any other brilliant, which puts more stone in the ring for the money, and its straight lines sit perfectly in a modern setting.',
  radiant: 'The cut-cornered rectangle takes the elegant outline of a step cut and fills it with brilliant-cut fire. Its clipped corners make it hard-wearing and easy to set, its seventy facets throw light from every part of the stone, and it reads as both tailored and dazzling at once.',
  emerald: 'The emerald cut does not sparkle; it gleams. Long, open step facets turn the stone into a hall of mirrors, with broad flashes of light and shadow instead of a thousand tiny glints, and the clean rectangular outline has a cool, architectural glamour that nothing else matches. It asks for a clear stone, and rewards one.',
  asscher: 'The square emerald cut is the step cut at its most hypnotic: deep clipped corners, a high crown and a small table, so that seen face up the facets form a stair of concentric squares turning in to the centre. It has the poise of the art deco jewellery it is so often set in, and a quiet, deliberate glamour.',
  shield: 'The shield is a shape with a story: a broad, gently curved top, rounded shoulders and sides that sweep in to a point, like the crest on a coat of arms. Rare enough to be noticed, its brilliant faceting fills the whole outline with light, and the strong, tapering silhouette makes a stone that is confident rather than pretty.',
  shieldStep: 'Six straight sides, a pointed base and rows of flat step facets that catch the light in clean, bold flashes: the step-cut shield is an architectural shape, more armour than ornament. It is cut to a stone\u2019s own outline rather than a standard template, so no two are quite alike, and it looks as modern as anything cut this year.',
  trillion: 'Three sides, three points and a blaze of light: the triangular brilliant is pure geometry, with a wide, flat spread that makes it look far larger than its weight. Striking on its own and the classic companion to a larger centre stone, its bold outline and brilliant facets make it a cut for someone who wants to be noticed.',
  singleCut: 'The single cut is the brilliant stripped to its essentials: eight facets above, eight below, a table and a point. Cut this way, the tiniest stones keep crisp, bright flashes where a full brilliant\u2019s facets would be too small to see, which is why it has set the sparkle in pav\u00e9 work for a century.',
  oldMine: 'The old mine cut is the brilliant as it was cut by candlelight: a squarish cushion with a small table, a high crown, a deep pavilion and an open culet, every one shaped by hand to the crystal it came from. It throws big, soft flashes rather than a modern glitter, and carries the romance of antique jewellery in every facet.',
  blank: 'A round preform with no facets yet: the beginning of a design.',
};
const CAPTIONS = {
  round: ['Round Brilliant', D.round],
  marquiseGia: ['Marquise Brilliant, French Tips', D.marquise],
  marquiseStd: ['Marquise Brilliant, Pointed Tips', D.marquise],
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
