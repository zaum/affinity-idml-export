"""Diagnostic IDML with only its editable text frames visible."""
import sys
import zipfile
import xml.etree.ElementTree as ET


ET.register_namespace("idPkg", "http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging")
with zipfile.ZipFile(sys.argv[1]) as src, zipfile.ZipFile(sys.argv[2], "w") as dst:
    for entry in src.infolist():
        data = src.read(entry.filename)
        if entry.filename.startswith("Spreads/") and entry.filename.endswith(".xml"):
            root = ET.fromstring(data)
            spread = root.find("Spread")
            for child in list(spread):
                if child.tag not in ("Page", "TextFrame"):
                    spread.remove(child)
                elif child.tag == "TextFrame":
                    points = child.findall(".//PathPointType")
                    coords = [tuple(map(float, point.get("Anchor").split())) for point in points]
                    left = min(x for x, _ in coords)
                    top = min(y for _, y in coords)
                    for point, (x, y) in zip(points, coords):
                        new = f"{left + (x - left) * 2:.3f} {top + (y - top) * 2:.3f}"
                        for key in ("Anchor", "LeftDirection", "RightDirection"):
                            point.set(key, new)
            data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
        dst.writestr(entry, data)
