import base64
import io
import re
import sys
import zipfile

from PIL import Image


with zipfile.ZipFile(sys.argv[1]) as archive:
    for name in archive.namelist():
        if not name.startswith('Spreads/'):
            continue
        spread = archive.read(name).decode('utf-8')
        for picture, encoded in re.findall(
            r'<Image Self="image(picture[0-9]+)".*?<Contents>(.*?)</Contents>', spread, re.S
        ):
            image = Image.open(io.BytesIO(base64.b64decode(encoded)))
            alpha = image.getchannel('A')
            raw = base64.b64decode(encoded)
            print(picture, image.size, alpha.getextrema(), 'sRGB=', b'sRGB' in raw[:100],
                  [alpha.getpixel(point) for point in (
                      (0, 0), (image.width // 2, image.height // 2),
                      (image.width - 1, image.height - 1))])
