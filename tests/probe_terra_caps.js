const { Document } = require('/document');
const { StoryApi, GlyphAttsApi } = require('affinity:story');
const doc = Document.current;
for (const node of doc.layers.all) {
    if (!node.isFrameTextNode || String(node.text || '').indexOf('Szigetszentmiklós') < 0) continue;
    const atts = StoryApi.getGlyphAtts(node.story.handle, node.storyRange.begin);
    const caps = GlyphAttsApi.getCapsType(atts);
    const font = GlyphAttsApi.getFont(atts);
    console.log(JSON.stringify({ text: node.text, capsType: typeof caps,
        capsString: String(caps), capsName: caps && caps.name,
        capsValue: caps && caps.value }));
}
