import sys
from pathlib import Path
pdf_path = Path(r"Solar Engineering Tools for Africa.pdf")
out_path = Path(r"solar_tools_extracted.txt")

text = ""
try:
    import pypdf
except Exception:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf", "-q"])
    import pypdf

reader = pypdf.PdfReader(str(pdf_path))
parts = []
for i, page in enumerate(reader.pages, start=1):
    try:
        t = page.extract_text() or ""
    except Exception:
        t = ""
    parts.append(f"\n\n=== PAGE {i} ===\n" + t)

text = "".join(parts)
out_path.write_text(text, encoding="utf-8")
print(f"pages={len(reader.pages)} chars={len(text)} output={out_path}")
