"""Create an IDML diagnostic copy with its full-page preview layer hidden."""
import sys
import zipfile


def main(source, destination):
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(destination, "w") as dst:
        for entry in src.infolist():
            data = src.read(entry.filename)
            if entry.filename == "designmap.xml":
                old = b'<Layer Self="layerPreview" Name="Visual proof - hide to edit" Visible="true"'
                new = b'<Layer Self="layerPreview" Name="Visual proof - hide to edit" Visible="false"'
                if old not in data:
                    raise SystemExit("Preview layer was not found in designmap.xml")
                data = data.replace(old, new, 1)
            dst.writestr(entry, data)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
