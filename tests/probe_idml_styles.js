'use strict';
const { Document } = require('/document');
const api = require('affinity:story');
const doc = Document.all.find(d => d.title === 'kisokos-toltheto-hallokeszulek');
if (!doc) throw new Error('Source document is not open.');
const frame = Array.from(doc.layers.all).find(n => (n.isFrameTextNode || n.isArtTextNode) && n.text);
if (!frame) throw new Error('No text frame.');
const story = frame.story;
const glyph = api.StoryApi.getGlyphAtts(story.handle, frame.storyRange.begin);
const para = api.StoryApi.getParagraphAtts(story.handle, frame.storyRange.begin);
const unwrap = v => v && typeof v === 'object' ? {value:v.value,name:v.name} : v;
function values(handle, obj, kinds) {
  const result = {};
  for (const key of Object.keys(kinds)) {
    try { result[key] = unwrap(obj.getDoubleValue(handle,kinds[key])); }
    catch(e) { result[key] = 'ERROR: '+e.message; }
  }
  return result;
}
function getters(handle,obj) {
  const result={};
  for (const key of Object.keys(obj)) {
    if (!/^get(Is|Keep|Use|Align|Leading|Start|Hyphenate|Max|Caps|Super|Strike|Underline|Optical|PDF|LineBreak|OpenType|Toc)/.test(key)) continue;
    if (key === 'getDoubleValue' || key === 'getStringValue') continue;
    try { result[key] = unwrap(obj[key](handle)); } catch(e) { result[key]='ERROR: '+e.message; }
  }
  return result;
}
console.log(JSON.stringify({dpi:doc.dpi,glyphDoubles:values(glyph,api.GlyphAttsApi,api.GlyphAttDoubleType),
  paragraphDoubles:values(para,api.ParagraphAttsApi,api.ParagraphAttDoubleType),
  glyphGetters:getters(glyph,api.GlyphAttsApi),paragraphGetters:getters(para,api.ParagraphAttsApi),
  alignEnum:api.ParagraphAlignXType,capitalEnum:api.GlyphCapsType},null,2));
