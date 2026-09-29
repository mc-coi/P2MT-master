"""P2MT static regression checks.

1. Every <script type="module"> in every page, and every js/*.js module,
   parses under `node --check`.
2. Every call to a shared-module helper passes an argument count the
   function actually accepts.

Check 2 exists because three call sites passed a hand-generated document ID
to db.js's addDoc(collection, data), which takes two arguments. The ID went
to Firestore as the document body and the real data was silently dropped, so
adding a parent and adding an intervention type both failed with nothing in
the UI to say so. Nothing in `node --check` can see that — it is valid
JavaScript — but comparing each call against the signature finds it instantly.
"""
import re, subprocess, sys, os, glob

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = os.path.join(root, "tools", "extracted")
os.makedirs(out_dir, exist_ok=True)

# Modules whose exported functions have strict, positional signatures.
SIGNATURE_SOURCES = ["js/db.js", "js/attendance.js", "js/tmiEngine.js", "js/data.js"]


def strip_noncode(s):
    """Neutralise comments and string/template literals, preserving length and
    newlines so reported line numbers stay accurate.

    Comments become spaces, so 'addDoc()' written in a comment is not read as a
    call. String contents become 'x' rather than spaces, because a blanked
    literal would make getAll('students') look like a call with no arguments."""
    out = list(s)
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c == '/' and i + 1 < n and s[i+1] == '/':
            while i < n and s[i] != '\n':
                out[i] = ' '; i += 1
        elif c == '/' and i + 1 < n and s[i+1] == '*':
            while i < n and not (s[i] == '*' and i + 1 < n and s[i+1] == '/'):
                if s[i] != '\n': out[i] = ' '
                i += 1
            for j in range(i, min(i + 2, n)):
                out[j] = ' '
            i += 2
        elif c in '"\'`':
            quote = c
            out[i] = 'x'; i += 1
            while i < n:
                if s[i] == '\\':
                    out[i] = 'x'
                    if i + 1 < n and s[i+1] != '\n': out[i+1] = 'x'
                    i += 2; continue
                if s[i] == quote:
                    out[i] = 'x'; i += 1; break
                if s[i] != '\n': out[i] = 'x'
                i += 1
        else:
            i += 1
    return ''.join(out)


def split_params(param_src):
    """Parameter names at depth 0, so destructured and defaulted params count once."""
    params, depth, cur = [], 0, ''
    for ch in param_src:
        if ch in '([{': depth += 1
        elif ch in ')]}': depth -= 1
        if ch == ',' and depth == 0:
            params.append(cur); cur = ''
        else:
            cur += ch
    if cur.strip(): params.append(cur)
    return [p.strip() for p in params if p.strip()]


def signatures():
    """min/max acceptable argument count for each exported helper."""
    sigs = {}
    for rel in SIGNATURE_SOURCES:
        path = os.path.join(root, rel)
        if not os.path.exists(path): continue
        src = strip_noncode(open(path, encoding="utf-8").read())
        for m in re.finditer(r'export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)', src):
            name, params = m.group(1), split_params(m.group(2))
            if any(p.startswith('...') for p in params):
                sigs[name] = (len([p for p in params if not p.startswith('...')]), 99)
            else:
                required = len([p for p in params if '=' not in p])
                sigs[name] = (required, len(params))
    return sigs


def count_args(s, open_paren):
    """Arguments in the call whose '(' is at open_paren."""
    depth, args, cur = 0, 0, ''
    for j in range(open_paren, len(s)):
        c = s[j]
        if c in '([{':
            depth += 1
            if depth == 1: continue
        elif c in ')]}':
            depth -= 1
            if depth == 0:
                return args + (1 if cur.strip() else 0)
        elif c == ',' and depth == 1:
            args += 1; cur = ''; continue
        if depth >= 1: cur += c
    return None


def check_arity():
    sigs = signatures()
    problems = []
    files = sorted(glob.glob(os.path.join(root, "*.html"))) + sorted(glob.glob(os.path.join(root, "js", "*.js")))
    for path in files:
        raw = open(path, encoding="utf-8", errors="ignore").read()
        code = strip_noncode(raw)
        for name, (lo, hi) in sigs.items():
            for m in re.finditer(r'(?<![.\w$])%s\s*\(' % re.escape(name), code):
                # Skip the declaration itself and re-exports like `window.x = x`
                preceding = code[max(0, m.start() - 40):m.start()]
                if re.search(r'(function|export|window\.\w+\s*=\s*)$', preceding.rstrip()): continue
                n = count_args(code, m.end() - 1)
                if n is None or lo <= n <= hi: continue
                line = code[:m.start()].count('\n') + 1
                want = str(lo) if lo == hi else f"{lo}-{hi}"
                problems.append(f"{os.path.relpath(path, root)}:{line}  {name}(...) called with {n} argument(s), takes {want}")
    return problems


def check_syntax():
    failures, count = [], 0
    for path in sorted(glob.glob(os.path.join(root, "*.html"))):
        content = open(path, encoding="utf-8", errors="ignore").read()
        for i, script in enumerate(re.findall(r'<script[^>]*type=["\']module["\'][^>]*>(.*?)</script>', content, re.S)):
            count += 1
            out_path = os.path.join(out_dir, f"{os.path.basename(path)}.{i}.mjs")
            open(out_path, "w", encoding="utf-8").write(script)
            r = subprocess.run(["node", "--check", out_path], capture_output=True, text=True)
            if r.returncode != 0: failures.append((path, i, r.stderr))
    for js in sorted(glob.glob(os.path.join(root, "js", "*.js"))):
        count += 1
        r = subprocess.run(["node", "--check", js], capture_output=True, text=True)
        if r.returncode != 0: failures.append((js, 0, r.stderr))
    return failures, count


failures, count = check_syntax()
problems = check_arity()

for p, i, e in failures:
    print(f"SYNTAX FAIL: {p} #{i}\n{e}\n")
for p in problems:
    print(f"ARITY FAIL: {p}")

if failures or problems:
    sys.exit(1)
print(f"All {count} scripts pass node --check")
print(f"All shared-module calls pass the argument-count check ({len(signatures())} signatures)")
