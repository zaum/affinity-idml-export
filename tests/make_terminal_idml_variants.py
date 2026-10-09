import pathlib
import zipfile

source = pathlib.Path(__file__).with_name('generated_probe.idml')
desktop = pathlib.Path.home() / 'Desktop'

with zipfile.ZipFile(source) as original:
    for variant in ('baseline', 'final-br', 'para-point', 'style-resource', 'empty-run'):
        output = desktop / f'idml-terminal-{variant}.idml'
        with zipfile.ZipFile(output, 'w') as target:
            for item in original.infolist():
                data = original.read(item.filename)
                if variant == 'final-br' and item.filename.startswith('Stories/'):
                    closing = b'</CharacterStyleRange></ParagraphStyleRange></Story>'
                    assert closing in data
                    data = data.replace(closing,
                        b'<Br/></CharacterStyleRange></ParagraphStyleRange></Story>', 1)
                if variant == 'para-point' and item.filename.startswith('Stories/'):
                    opening = b'<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"'
                    at = data.rfind(opening)
                    assert at >= 0
                    data = data[:at] + data[at:].replace(opening,
                        opening + b' PointSize="14"', 1)
                if variant == 'style-resource' and item.filename.startswith('Stories/'):
                    old = b'AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle"'
                    at = data.rfind(old)
                    assert at >= 0
                    data = data[:at] + data[at:].replace(old,
                        b'AppliedParagraphStyle="ParagraphStyle/Terminal14"', 1)
                if variant == 'empty-run' and item.filename.startswith('Stories/'):
                    closing = b'</CharacterStyleRange></ParagraphStyleRange></Story>'
                    assert closing in data
                    insertion = (
                        b'</CharacterStyleRange>'
                        b'<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]" FontStyle="Bold" PointSize="14">'
                        b'<Properties><AppliedFont type="string">Arial</AppliedFont></Properties>'
                        b'<Content></Content></CharacterStyleRange></ParagraphStyleRange></Story>'
                    )
                    data = data.replace(closing, insertion, 1)
                if variant == 'style-resource' and item.filename == 'designmap.xml':
                    data = data.replace(b'<idPkg:Preferences',
                        b'<idPkg:Styles src="Resources/Styles.xml"/><idPkg:Preferences', 1)
                target.writestr(item.filename, data, compress_type=item.compress_type)
            if variant == 'style-resource':
                target.writestr('Resources/Styles.xml',
                    b'<?xml version="1.0" encoding="UTF-8"?>'
                    b'<idPkg:Styles xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0">'
                    b'<RootCharacterStyleGroup><CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/></RootCharacterStyleGroup>'
                    b'<RootParagraphStyleGroup><ParagraphStyle Self="ParagraphStyle/Terminal14" Name="Terminal14" PointSize="14" FontStyle="Bold">'
                    b'<Properties><AppliedFont type="string">Arial</AppliedFont></Properties>'
                    b'</ParagraphStyle></RootParagraphStyleGroup></idPkg:Styles>')
        print(output)
