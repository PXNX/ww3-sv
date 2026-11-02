with open('src/lib/game/sabotage/levels.ts') as f:
    text = f.read()
start = text.find("id: 'terminal-strike'")
end = text.find('],', start)
block = text[start:end]
for i, l in enumerate(block.split(',')):
    s = l.strip().strip("'").strip('"')
    if s and s.startswith('#'):
        print('term', i+1, len(s), s[:20])
start2 = text.find("id: 'tarmac-spray'")
end2 = text.find('],', start2)
block2 = text[start2:end2]
for i, l in enumerate(block2.split(',')):
    s = l.strip().strip("'").strip('"')
    if s and s.startswith('#'):
        print('tarmac', i+1, len(s), s[:20])
