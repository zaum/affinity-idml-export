import sys
import zipfile

source, target = sys.argv[1:3]
method = sys.argv[3] if len(sys.argv) > 3 else '$ID/Metrics'
value = sys.argv[4] if len(sys.argv) > 4 else '100'
changed = False
with zipfile.ZipFile(source) as zin, zipfile.ZipFile(target, 'w') as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if not changed and item.filename.startswith('Stories/Story_') and item.filename.endswith('.xml'):
            old = b'<CharacterStyleRange '
            attrs = ' KerningMethod="' + method + '"'
            if value != 'omit':
                attrs += ' KerningValue="' + value + '"'
            new = ('<CharacterStyleRange' + attrs + ' ').encode()
            if old in data:
                data = data.replace(old, new, 1)
                changed = True
        zout.writestr(item, data)
assert changed, 'No character style range found'
print(target)
