"""Diagnostic IDML: faithful artwork PNG beneath enlarged editable text."""
import base64
import sys
import zipfile
import xml.etree.ElementTree as ET


def main(source, destination, artwork):
    ET.register_namespace("idPkg", "http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging")
    pixels = base64.b64encode(open(artwork, "rb").read()).decode("ascii")
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(destination, "w") as dst:
        for entry in src.infolist():
            data = src.read(entry.filename)
            if entry.filename == "designmap.xml":
                data = data.replace(b'<Layer Self="layerPreview" Name="Visual proof - hide to edit" Visible="true"',
                                    b'<Layer Self="layerPreview" Name="Visual proof - hide to edit" Visible="false"', 1)
            elif entry.filename.startswith("Stories/") and entry.filename.endswith(".xml"):
                root = ET.fromstring(data)
                for node in root.iter():
                    for key in ("PointSize", "Leading", "BaselineShift"):
                        if key in node.attrib:
                            node.set(key, str(round(float(node.get(key)) * (192 / 72), 3)))
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            elif entry.filename.startswith("Spreads/") and entry.filename.endswith(".xml"):
                root = ET.fromstring(data)
                spread = root.find("Spread")
                children = list(spread)
                preview = next(child for child in children if child.attrib.get("ItemLayer") == "layerPreview")
                preview.set("ItemLayer", "layer1")
                preview.find(".//Contents").text = pixels
                frames = [child for child in children if child.tag == "TextFrame"]
                for frame in frames:
                    points = frame.findall(".//PathPointType")
                    coords = [tuple(map(float, point.get("Anchor").split())) for point in points]
                    left = min(x for x, _ in coords)
                    top = min(y for _, y in coords)
                    for point, (x, y) in zip(points, coords):
                        new = f"{left + (x - left) * 2:.3f} {top + (y - top) * 2:.3f}"
                        for key in ("Anchor", "LeftDirection", "RightDirection"):
                            point.set(key, new)
                for child in children:
                    spread.remove(child)
                spread.extend([child for child in children if child.tag == "Page"] + [preview] + frames)
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            dst.writestr(entry, data)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
