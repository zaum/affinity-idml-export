const { Document } = require('/document');
const { StoryApi, GlyphAttsApi, GlyphAttDoubleType } = require('affinity:story');
const { StoryInterfaceApi } = require('affinity:dom');
for (const node of Document.current.layers.all) {
    if (!node.isFrameTextNode && !node.isArtTextNode) continue;
    let transform = null, height = null, box = null;
    try { transform = Array.from(node.baseToSpreadTransform.data); } catch (_) {}
    try { const b = node.getSpreadBaseBox(false); box = [b.x,b.y,b.width,b.height]; } catch (_) {}
    try { const atts = StoryApi.getGlyphAtts(node.story.handle,node.storyRange.begin);
        height = GlyphAttsApi.getDoubleValue(atts,GlyphAttDoubleType.Height); } catch (_) {}
    let renderScale = null, uiScale = null, domain = null, scalar = null;
    let baseBox = null;
    try { const b = node.baseBox; baseBox = [b.x,b.y,b.width,b.height]; } catch (_) {}
    try { renderScale = node.storyInterface.textRenderScale; } catch (_) {}
    try { uiScale = node.storyInterface.textUiScale; } catch (_) {}
    try { domain = Array.from(node.storyInterface.domainTransform.data); } catch (_) {}
    try { scalar = Array.from(node.storyInterface.scalarDomainTransform.data); } catch (_) {}
    let apiRender = null, apiUi = null;
    try { apiRender = StoryInterfaceApi.getTextRenderScale(node.storyInterface.handle); } catch (_) {}
    try { apiUi = StoryInterfaceApi.getTextUiScale(node.storyInterface.handle); } catch (_) {}
    console.log(JSON.stringify({ text: String(node.text || '').slice(0,40),
        transform, renderScale, uiScale, apiRender, apiUi, domain, scalar,
        baseBox, height, box }));
}
