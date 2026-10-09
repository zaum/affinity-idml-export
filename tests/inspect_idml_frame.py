import re
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as package:
    names = package.namelist()
    spread = next(name for name in names if name.startswith('Spreads/Spread_'))
    story = next(name for name in names if name.startswith('Stories/Story_story4'))
    xml = package.read(spread).decode('utf-8')
    match = re.search(r'<TextFrame Self="frame4".*?</TextFrame>', xml)
    print(match.group(0)[:1600] if match else 'Frame not found')
    print(package.read(story).decode('utf-8')[:1800])
