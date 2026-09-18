import re
import os

for filepath in ['app/layout.tsx', 'app/page.tsx']:
    with open(filepath, 'r') as f:
        content = f.read()
    content = content.replace('文昌同行', '文昌七媽學堂')
    with open(filepath, 'w') as f:
        f.write(content)
