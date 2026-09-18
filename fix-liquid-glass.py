import re

with open('app/globals.css', 'r') as f:
    content = f.read()

# The elements we want to add liquid glass to
extra_selectors = ", .simple-today-heading > a, .today-ai-entry-actions a, .today-pilgrimage-recommendation > a, .simple-study-note a, .progress-page-heading > a, .learning-culture-bridge > a, .progress-next-step a, .progress-tools a, .prayer-shortcuts a"
selector = f":is(button{extra_selectors})"

# Replace 'button {'
content = re.sub(r'\nbutton {', f'\n{selector} {{', content)
# Replace 'button::after {'
content = re.sub(r'\nbutton::after {', f'\n{selector}::after {{', content)
# Replace 'button:hover::after {'
content = re.sub(r'\nbutton:hover::after {', f'\n{selector}:hover::after {{', content)
# Replace 'button:active {'
content = re.sub(r'\nbutton:active {', f'\n{selector}:active {{', content)
# Replace 'button:active::after {'
content = re.sub(r'\nbutton:active::after {', f'\n{selector}:active::after {{', content)
# Replace 'button.checked,\nbutton.active {'
content = re.sub(r'\nbutton\.checked,\nbutton\.active {', f'\n{selector}.checked,\n{selector}.active {{', content)
# Replace 'button.checked::after,\nbutton.active::after {'
content = re.sub(r'\nbutton\.checked::after,\nbutton\.active::after {', f'\n{selector}.checked::after,\n{selector}.active::after {{', content)
# Replace 'button:disabled {'
content = re.sub(r'\nbutton:disabled {', f'\n{selector}:disabled {{', content)
# Replace 'button:disabled::after {'
content = re.sub(r'\nbutton:disabled::after {', f'\n{selector}:disabled::after {{', content)

with open('app/globals.css', 'w') as f:
    f.write(content)
