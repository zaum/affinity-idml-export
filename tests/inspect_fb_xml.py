"""Print page item and path extents from an IDML spread."""
import sys
import zipfile
import xml.etree.ElementTree as ET


with zipfile.ZipFile(sys.argv[1]) as archive:
    root = ET.fromstring(archive.read("Spreads/Spread_spread1.xml"))
for item in root.find("Spread"):
    name = item.attrib.get("Self")
    if not name or not name.startswith("vector"):
        continue
    paths = item.findall(".//GeometryPathType")
    print(name, item.tag, "fill", item.attrib.get("FillColor"), "paths", len(paths))
    for path in paths:
        points = path.findall(".//PathPointType")
        print(" closed", path.attrib.get("PathOpen"), "points", len(points))
        for point in points[:8]:
            print("  ", point.attrib)
