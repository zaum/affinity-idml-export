'use strict';
const { Document } = require('/document');
const storyApi = require('affinity:story');
const fontApi = require('affinity:fonts').FontApi;
const source = Document.all.find(d => d.title === 'kisokos-toltheto-hallokeszulek');
if (!source) throw new Error('The source document is not open.');
const imported = Document.load('C:\\Users\\peter\\Desktop\\kisokos-toltheto-hallokeszulek 4.idml');
try {
  const frames = d => Array.from(d.layers.all).filter(n => n.isFrameTextNode || n.isArtTextNode);
  const left = frames(source), right = frames(imported);
  const issues = [];
  const number = (value, dpi) => Number(value) * 72 / dpi;
  const close = (a,b) => Math.abs(a-b) < 0.02;
  let characters = 0, paragraphs = 0, fontChecks = 0;
  if (left.length !== right.length) issues.push('frame count ' + left.length + '/' + right.length);
  for (let i=0; i<Math.min(left.length,right.length); i++) {
    const a=left[i], b=right[i], ta=String(a.text || ''), tb=String(b.text || '');
    if (ta !== tb) issues.push('frame '+i+' text differs, lengths '+ta.length+'/'+tb.length);
    characters += ta.length;
    const sa=a.story, sb=b.story, ra=a.storyRange, rb=b.storyRange;
    for (let p=0; p<Math.min(ta.length,tb.length); p++) {
      if (sa.isParagraphBreak(ra.begin+p)) continue;
      const ga=storyApi.StoryApi.getGlyphAtts(sa.handle,ra.begin+p);
      const gb=storyApi.StoryApi.getGlyphAtts(sb.handle,rb.begin+p);
      const fa=storyApi.GlyphAttsApi.getFont(ga), fb=storyApi.GlyphAttsApi.getFont(gb);
      const ha=number(storyApi.GlyphAttsApi.getDoubleValue(ga,storyApi.GlyphAttDoubleType.Height),source.dpi);
      const hb=number(storyApi.GlyphAttsApi.getDoubleValue(gb,storyApi.GlyphAttDoubleType.Height),imported.dpi);
      const na=fontApi.getFamilyName(fa)+'/'+fontApi.getTraitsName(fa);
      const nb=fontApi.getFamilyName(fb)+'/'+fontApi.getTraitsName(fb);
      if ((!close(ha,hb) || na!==nb) && issues.length<20)
        issues.push('frame '+i+' char '+p+' font '+na+'/'+ha+' vs '+nb+'/'+hb);
      for (const key of ['ManualKerning','AutoKernMinHeight','CharacterSpacing','ScaleX','ScaleY','ShearX','OffsetY']) {
        const va=Number(storyApi.GlyphAttsApi.getDoubleValue(ga,storyApi.GlyphAttDoubleType[key]));
        const vb=Number(storyApi.GlyphAttsApi.getDoubleValue(gb,storyApi.GlyphAttDoubleType[key]));
        const aa = key==='CharacterSpacing'||key==='OffsetY' ? number(va,source.dpi) : va;
        const bb = key==='CharacterSpacing'||key==='OffsetY' ? number(vb,imported.dpi) : vb;
        if (!close(aa,bb) && issues.length<20) issues.push('frame '+i+' char '+p+' '+key+' '+aa+'/'+bb);
      }
      fontChecks++;
    }
    let start=0;
    for (const paragraph of ta.split('\n')) {
      const pa=storyApi.StoryApi.getParagraphAtts(sa.handle,ra.begin+start);
      const pb=storyApi.StoryApi.getParagraphAtts(sb.handle,rb.begin+start);
      const api=storyApi.ParagraphAttsApi, kind=storyApi.ParagraphAttDoubleType;
      const hyA=api.getIsAutoHyphenate(pa), hyB=api.getIsAutoHyphenate(pb);
      if (hyA!==hyB) issues.push('frame '+i+' paragraph '+paragraphs+' hyphenation');
      for (const key of ['SpaceBefore','SpaceAfter','LeftIndent','RightIndent','FirstLineIndent']) {
        const va=number(api.getDoubleValue(pa,kind[key]),source.dpi);
        const vb=number(api.getDoubleValue(pb,kind[key]),imported.dpi);
        if (!close(va,vb)) issues.push('frame '+i+' paragraph '+paragraphs+' '+key+' '+va+'/'+vb);
      }
      const la=api.getDoubleValue(pa,kind.RelativeLeading);
      const lb=api.getDoubleValue(pb,kind.RelativeLeading);
      if (!close(la,lb)) issues.push('frame '+i+' paragraph '+paragraphs+' leading '+la+'/'+lb);
      paragraphs++;
      start += paragraph.length+1;
    }
  }
  console.log(JSON.stringify({frames:left.length,characters,paragraphs,fontChecks,issues}));
} finally { imported.close(); }
