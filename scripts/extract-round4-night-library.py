"""Import the supplied Round 4 prompt and vetted night library without editing the PDF.

Usage: python scripts/extract-round4-night-library.py /path/to/developer-pack.pdf
Requires pdfplumber and pdftotext. No quotes or verification claims are invented.
"""

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
text = subprocess.check_output(["pdftotext", "-layout", str(source), "-"], text=True)
prompt = text[text.index("     You are Chloe,") : text.index("\n  Design notes")]
prompt = re.sub(r"^Chloe — Master Prompt \(iwillbe.me\)\s*$", "", prompt, flags=re.M)
prompt = re.sub(r"^\s*Page \d+ of 25\s*$", "", prompt, flags=re.M)
prompt = "\n".join(line.strip() for line in prompt.replace("\f", "").splitlines())
prompt = re.sub(r"\n{3,}", "\n\n", prompt).strip()
assert prompt.startswith("You are Chloe,")
assert "WHEN IT DIDN'T HAPPEN (night)" in prompt
assert "Change log" not in prompt and "Design notes" not in prompt
assert "${" not in prompt and "`" not in prompt
(ROOT / "supabase/functions/chloe/master-prompt.ts").write_text(
    "// Source: supplied 25 November 2026 Developer Pack Round 4, Current prompt only.\n"
    "// Screen-specific corrections and legacy-client safeguards live in prompt.ts.\n"
    "export const MASTER_PROMPT = `" + prompt + "`;\n"
)


def clean(value):
    value = re.sub(r"([-–—])\n\s*", r"\1", value or "")
    value = re.sub(r"\n\s*(—)", r"\1", value)
    return re.sub(r"\s+", " ", value).strip()


previous = {
    row["id"]: row
    for row in json.loads((ROOT / "data/night-thoughts.json").read_text())
}
entries = []
with pdfplumber.open(source) as pdf:
    for page in pdf.pages[39:]:
        for table in page.find_tables():
            rows = table.extract()
            if not rows or "#" not in rows[0]:
                continue
            offset = rows[0].index("#")
            for index, raw in enumerate(rows[1:], start=1):
                values = raw[offset : offset + 7]
                if len(values) != 7 or not values[0] or not values[0].isdigit():
                    continue
                identity, form, wording, credit, tags, status, checked = map(clean, values)
                identity = int(identity)
                old = previous.get(identity)
                if old:
                    person = re.sub(r"(?<=[-–]) +(?=\w)", "", old["person"])
                    reference = credit[len(person) + 2 :] if credit.startswith(person + ", ") else ""
                    assert credit == person or credit == person + ", " + reference, identity
                else:
                    person, _, reference = credit.partition(", ")
                traditions = re.findall(r"guided by faith \(([^)]+)\)", tags)
                tags = re.sub(r"guided by faith \([^)]+\)", "guided by faith", tags)
                x0, top, x1, bottom = table.rows[index].cells[offset + 6]
                urls = list(dict.fromkeys(
                    link["uri"] for link in page.hyperlinks
                    if link.get("uri") and x0 <= link["x0"] <= x1
                    and top <= (link["top"] + link["bottom"]) / 2 <= bottom
                ))
                assert urls, f"No supplied verification link for {identity}"
                entries.append({
                    "id": identity,
                    "format": form.lower(),
                    "text": wording,
                    "person": person,
                    "source": reference,
                    "credit": credit,
                    "priorities": [tag.strip() for tag in tags.split(",")],
                    "traditions": traditions,
                    "once_only": "once only" in status.lower(),
                    "status": "verified" if status.startswith("Verified") and "caveat" not in status.lower() else "needs_check",
                    "verification_note": status,
                    "checked_against": checked,
                    "source_urls": urls,
                })

entries.sort(key=lambda row: row["id"])
assert [row["id"] for row in entries] == list(range(1, 217))
withheld = [row["id"] for row in entries if row["status"] != "verified"]
assert withheld == [50, 69, 73, 90, 96, 97, 105, 114, 142]
(ROOT / "data/night-thoughts.json").write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")
target = ROOT / "data/round4"
target.mkdir(parents=True, exist_ok=True)
(target / "night-thought-source.json").write_text(json.dumps({
    "filename": source.name,
    "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "prompt_pages": "12–26 (Current prompt only)",
    "library_pages": "37–97",
    "entries": len(entries),
    "verified": len(entries) - len(withheld),
    "withheld_ids": withheld,
    "note": "The introduction mentions one caveat, but nine Status cells carry a caveat. All nine remain excluded.",
}, ensure_ascii=False, indent=2) + "\n")
columns = list(entries[0])
seed = json.dumps(entries, ensure_ascii=False, indent=2)
delimiter = "$night_thoughts_round4$"
assert delimiter not in seed
sql = (
    "-- Round 4: supplied 216-entry night thought library, with all nine caveats withheld.\n"
    "-- Generated by scripts/extract-round4-night-library.py; stable IDs preserve per-user history.\n"
    "begin;\n"
    f"insert into public.night_thoughts({','.join(columns)})\n"
    f"select {','.join(columns)} from jsonb_populate_recordset(null::public.night_thoughts,\n"
    f"{delimiter}{seed}{delimiter}::jsonb)\n"
    "on conflict(id) do update set\n"
    + ",\n".join(f"  {key}=excluded.{key}" for key in columns if key != "id")
    + ";\ncommit;\n"
)
(ROOT / "supabase/migrations/20261126153804_round4_night_library.sql").write_text(sql)
print(f"Imported Current prompt and {len(entries)} thoughts ({len(entries) - len(withheld)} eligible; {len(withheld)} caveats withheld).")
