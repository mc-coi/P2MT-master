"""P2MT static regression checks.

1. Every <script type="module"> in every page, and every js/*.js module,
   parses under `node --check`.
2. Every call to a shared-module helper passes an argument count the
   function actually accepts.
3. No page declares the same element id twice.
4. Every function an inline handler (onclick="…") calls is reachable from
   global scope.

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
SIGNATURE_SOURCES = ["js/db.js", "js/attendance.js", "js/tmiEngine.js", "js/data.js", "js/labInterventions.js", "js/utils.js", "js/guardians.js"]


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
            # A page that declares its own function of this name (and doesn't
            # import the shared one) is calling its local version — e.g.
            # student-profile.html's getInitials(first, last) — so the shared
            # signature says nothing about those calls.
            if re.search(r'(?<![.\w$])function\s+%s\s*\(' % re.escape(name), code) and \
               not re.search(r'import\s*\{[^}]*\b%s\b[^}]*\}' % re.escape(name), code):
                continue
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


def check_duplicate_ids():
    """An id used twice in one page.

    getElementById returns the FIRST match, so the second element is simply
    never found: it is never filled in, never shown, never updated, and
    nothing errors. This check exists because a search-and-replace meant to
    add one element to a modal also matched an identical block in a filter
    bar, and the warning it was supposed to show appeared in the filter bar
    while the modal stayed blank.
    """
    problems = []
    for path in sorted(glob.glob(os.path.join(root, "*.html"))):
        raw = open(path, encoding="utf-8", errors="ignore").read()
        seen = {}
        # Only static ids in the markup; ids built inside template literals
        # (id="room-card-${room.id}") are generated per row and are not
        # duplicates in the source.
        for m in re.finditer(r'\sid\s*=\s*"([^"${}]+)"', raw):
            seen.setdefault(m.group(1), []).append(raw[:m.start()].count('\n') + 1)
        for el_id, lines in seen.items():
            if len(lines) > 1:
                problems.append(f"{os.path.relpath(path, root)}  id=\"{el_id}\" declared {len(lines)} times, on lines {', '.join(map(str, lines))}")
    return problems


# Names an inline handler may use without the page defining them.
_HANDLER_BUILTINS = set("""
  if else return new typeof void delete in of instanceof true false null undefined this event
  window document location history navigator console localStorage sessionStorage
  alert confirm prompt print open close setTimeout clearTimeout setInterval clearInterval
  requestAnimationFrame fetch encodeURIComponent decodeURIComponent parseInt parseFloat isNaN
  Number String Boolean Array Object Date Math JSON Promise Set Map RegExp Error
  $ jQuery
""".split())


def _exposed_names(raw):
    """Names a page makes reachable from an onclick attribute."""
    names = set()
    names |= set(re.findall(r'window\.([A-Za-z_$][\w$]*)\s*=(?!=)', raw))
    for blk in re.findall(r'Object\.assign\(\s*window\s*,\s*\{([^}]*)\}', raw, re.S):
        for part in blk.split(','):
            part = part.strip()
            if part:
                names.add(re.split(r'\s*:\s*', part)[0].strip())
    # Classic (non-module) scripts put their top-level declarations on window.
    for attrs, body in re.findall(r'<script([^>]*)>(.*?)</script>', raw, re.S):
        if 'module' in attrs:
            continue
        names |= set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)', body))
        names |= set(re.findall(r'\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)', body))
    return names


def check_inline_handlers():
    """An inline handler calling a function the page never puts on window.

    A <script type="module"> keeps its functions private, but onclick="…"
    runs in global scope — so onclick="updateSelCount()" throws
    'updateSelCount is not defined' even though the function is right there
    in the page. Nothing visible happens: the click just does less than it
    should. That is exactly how the "N selected" counter on Email Students
    stopped counting clicks on the checkbox itself.
    """
    problems = []
    for path in sorted(glob.glob(os.path.join(root, "*.html"))):
        raw = open(path, encoding="utf-8", errors="ignore").read()
        exposed = _exposed_names(raw)
        handler_re = re.compile(r'\son[a-z]+\s*=\s*(?:"([^"]*)"|\\"((?:(?!\\").)*)\\")', re.S)
        for m in handler_re.finditer(raw):
            body = m.group(1) if m.group(1) is not None else m.group(2)
            body = re.sub(r'\$\{[^}]*\}', 'x', body)          # template interpolations
            body = re.sub(r"'(?:[^'\\]|\\.)*'", "''", body)  # string literals
            for name in re.findall(r'(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(', body):
                if name in _HANDLER_BUILTINS or name in exposed:
                    continue
                line = raw[:m.start()].count('\n') + 1
                problems.append(f"{os.path.relpath(path, root)}:{line}  inline handler calls {name}(), which is not on window")
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
dupes = check_duplicate_ids()
handlers = check_inline_handlers()

for p, i, e in failures:
    print(f"SYNTAX FAIL: {p} #{i}\n{e}\n")
for p in problems:
    print(f"ARITY FAIL: {p}")
for d in dupes:
    print(f"DUPLICATE ID: {d}")
for h in handlers:
    print(f"UNREACHABLE HANDLER: {h}")

if failures or problems or dupes or handlers:
    sys.exit(1)
print(f"All {count} scripts pass node --check")
print(f"All shared-module calls pass the argument-count check ({len(signatures())} signatures)")
print("No page declares the same element id twice")
print("Every inline handler calls a function reachable from global scope")
