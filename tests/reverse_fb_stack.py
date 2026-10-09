"""Build an FB-tavasz diagnostic IDML with reversed editable item order."""
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
                spread = root.find("Spread")
                children = list(spread)
                for child in children:
                    spread.remove(child)
                page = [child for child in children if child.tag == "Page"]
                items = [child for child in children if child.tag != "Page"
                         and child.attrib.get("ItemLayer") != "layerPreview"]
                preview = [child for child in children if child.attrib.get("ItemLayer") == "layerPreview"]
                spread.extend(page + list(reversed(items)) + preview)
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            dst.writestr(entry, data)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
