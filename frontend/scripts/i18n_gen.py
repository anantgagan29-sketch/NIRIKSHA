"""
Emits src/i18n/<code>.ts for every language from the dictionaries below.

One place for all of them, so parity with the English key set is checked
mechanically rather than by eye: a language missing a key falls back to
English at runtime, which is invisible in the interface and easy to ship
without noticing.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
EN_TS = ROOT / "src/i18n/en.ts"

def en_keys():
    s = EN_TS.read_text()
    return [m.group(1) for m in re.finditer(r'^  "([^"]+)":', s, re.M)]

def emit(code, native, english, script_note, table):
    keys = en_keys()
    missing = [k for k in keys if k not in table]
    extra = [k for k in table if k not in keys]
    if missing or extra:
        print(f"  ✗ {code}: missing {len(missing)} {missing[:4]}  extra {extra[:4]}")
        return False
    lines = [f'import type {{ EN }} from "./en";', "",
             "/**", f" * The {english} interface ({native}).", " *",
             f" * {script_note}", " *",
             " * Written to read as an Indian regulatory application would speak. Terms that",
             " * Indian practice keeps in English or abbreviated — NIRIKSHA, OCR, MRP, GTIN,",
             " * EAN-13, AI, PDF — are left as they are.",
             " */",
             f"export const {code.upper().replace('-','_')}: Partial<Record<keyof typeof EN, string>> = {{"]
    group = None
    for k in keys:
        g = k.split(".")[0]
        if g != group:
            lines.append(f"  /* {g} */"); group = g
        v = table[k].replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  "{k}": "{v}",')
    lines.append("};")
    (ROOT / f"src/i18n/{code}.ts").write_text("\n".join(lines) + "\n")
    print(f"  ✓ {code}: {len(keys)} keys")
    return True

LANGS = {}
def lang(code, native, english, note):
    def reg(table): LANGS[code] = (native, english, note, table); return table
    return reg

if __name__ == "__main__":
    import importlib
    for mod in sorted(p.stem for p in (ROOT/"scripts/i18n").glob("*.py")):
        importlib.import_module(f"i18n.{mod}")
    # The dictionaries import `i18n_gen` by name, so they register into that
    # module's table rather than into __main__'s.
    import i18n_gen
    ok = all(emit(c, *v) for c, v in i18n_gen.LANGS.items())
    sys.exit(0 if ok else 1)
