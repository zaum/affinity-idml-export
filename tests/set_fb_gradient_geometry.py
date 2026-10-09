"""Diagnostic IDML copy with explicit gradient start and length."""
import sys
import zipfile
import xml.etree.ElementTree as ET


def main(source, destination):
    ET.register_namespace("idPkg", "http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging")
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(destination, "w") as dst:
        for entry in src.infolist():
            data = src.read(entry.filename)
            if entry.filename == "designmap.xml":
                data = data.replace(b'<Layer Self="layerPreview" Name="Visual proof - hide to edit" Visible="true"',
                                    b'<Layer Self="layerPreview" Name="Visual proof - hide to edit" Visible="false"', 1)
            elif entry.filename.startswith("Spreads/") and entry.filename.endswith(".xml"):
                root = ET.fromstring(data)
                for item in root.iter():
                    if not item.attrib.get("FillColor", "").startswith("Gradient/"):
                        continue
                    anchors = [tuple(map(float, point.get("Anchor").split()))
                               for point in item.findall(".//PathPointType")]
                    if not anchors:
                        continue
                    xs = [x for x, _ in anchors]
                    ys = [y for _, y in anchors]
                    item.set("GradientFillStart", f"{min(xs):.3f} {(min(ys) + max(ys)) / 2:.3f}")
                    item.set("GradientFillLength", f"{max(xs) - min(xs):.3f}")
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            dst.writestr(entry, data)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
