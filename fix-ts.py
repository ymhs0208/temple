import re

with open('app/page.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'reviewStep: 1,', r'reviewStep: 1 as const,', content)
content = re.sub(r'reviewStep: 2,', r'reviewStep: 2 as const,', content)

with open('app/page.tsx', 'w') as f:
    f.write(content)
