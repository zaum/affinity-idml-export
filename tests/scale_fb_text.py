"""Diagnostic copy with visible proof hidden and IDML point sizes scaled."""
import sys
import zipfile
import xml.etree.ElementTree as ET


def main(source, destination, factor):
    ET.register_namespace("idPkg", "http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging")
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
                            node.set(key, str(round(float(node.get(key)) * factor, 3)))
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            dst.writestr(entry, data)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]))
