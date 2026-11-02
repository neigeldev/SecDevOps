import re, sys, zipfile, shutil
ORDER = ['top', 'left', 'bottom', 'right', 'between', 'bar']
def reorder(m):
    kids = re.findall(r'<w:(\w+) [^>]*/>', m.group(1))
    els = re.findall(r'(<w:(\w+) [^>]*/>)', m.group(1))
    els.sort(key=lambda e: ORDER.index(e[1]) if e[1] in ORDER else 99)
    return '<w:pBdr>' + ''.join(e[0] for e in els) + '</w:pBdr>'
src = sys.argv[1]; tmp = src + '.tmp'
with zipfile.ZipFile(src) as zi, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zo:
    for item in zi.infolist():
        data = zi.read(item.filename)
        if item.filename.startswith('word/') and item.filename.endswith('.xml'):
            t = data.decode('utf-8')
            t = re.sub(r'<w:highlightCs [^>]*/>', '', t)
            t = re.sub(r'<w:pBdr>(.*?)</w:pBdr>', reorder, t)
            data = t.encode('utf-8')
        zo.writestr(item, data)
shutil.move(tmp, src)
