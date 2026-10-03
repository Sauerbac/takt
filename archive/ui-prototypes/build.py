"""Regenerate the HTML studies. No JavaScript is shipped or required."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent
DESIGNS = [
    ('01-swiss-grid', 'swiss', 'Swiss Grid', 'Clarity, with a point of view.', 'A disciplined navy grid, precise labels and a traditional top toolbar. The most direct corporate direction.', 'Segoe UI / 3 px bars / 61 px rows', '#244d75', '#467969', '#a87940'),
    ('02-quiet-ledger', 'ledger', 'Quiet Ledger', 'An editorial view of time.', 'A serif masthead, warm paper and restrained botanical tones. A planning document with the quiet confidence of an annual report.', 'Georgia + Segoe UI / 2 px bars / 63 px rows', '#566f54', '#927a51', '#697d8c'),
    ('03-signal', 'signal', 'Signal', 'Precision in every lane.', 'A compact identity rail, crisp blue accents and a framed workspace. Technical and efficient without becoming a project dashboard.', 'Segoe UI / 5 px bars / 62 px rows', '#2859db', '#14817b', '#8e64be'),
    ('04-clay-studio', 'clay', 'Clay Studio', 'Make room for the work.', 'A broad canvas, terracotta accents and a small toolbar dock below the chart. Rounded periods soften an otherwise rigorous timeline.', 'Segoe UI / pill bars / 60 px rows', '#ab604a', '#718061', '#8a7b9d'),
    ('05-monograph', 'mono', 'Monograph', 'Less interface. More timeline.', 'An almost monochrome drafting surface, square edges and monospaced time labels. The chart reads like a carefully typeset exhibit.', 'Segoe UI + Consolas / square bars / 61 px rows', '#34373d', '#68736d', '#8f8170'),
    ('06-soft-geometry', 'geometry', 'Soft Geometry', 'Order, with a softer edge.', 'A detached control strip, gentle violet tones and rounded geometry. Polished and approachable, with the density of a desktop tool.', 'Segoe UI / 7 px bars / 58 px rows', '#7965ac', '#538482', '#b5874e'),
    ('07-grid-club', 'club', 'Grid Club', 'A little structure. A lot of character.', 'Swiss Grid loosens its collar: oversized ink typography, chartreuse highlights and punchy rectangular periods. Clear enough for work, with the energy of an independent studio.', 'Arial + Segoe UI / square bars / 61 px rows', '#353e24', '#b14e3b', '#496bb1'),
    ('08-signal-house', 'house', 'Signal House', 'Make time your own.', 'Signal moves its small toolset into a blue-accented side rail. Bright blue periods, apricot contrasts and rounded week labels make the precision feel personal.', 'Segoe UI + Consolas / 6 px bars / 61 px rows', '#3155c9', '#af642e', '#6f7f43'),
    ('09-daybreak', 'daybreak', 'Daybreak', 'Room for a fresh perspective.', 'Clay Studio meets a sunny creative workspace: soft peach, lilac and sea blue, a warm serif heading and gently sculpted bars. Friendly, open and quietly expressive.', 'Georgia + Segoe UI / asymmetric bars / 61 px rows', '#aa5642', '#7564a2', '#397c91'),
    ('10-fieldwork', 'fieldwork', 'Fieldwork', 'Plans with a human touch.', 'Swiss Grid’s clarity and Clay Studio’s warmth become a working notebook. Olive ink, fine dotted rules and paper-edge details give the chart a tactile, unpolished confidence.', 'Georgia + Segoe UI / 3 px bars / 61 px rows', '#61704a', '#a76249', '#517887'),
    ('11-swiss-precision', 'precision', 'Swiss Precision', 'Clear structure. Strong presence.', 'White surfaces, confident Arial typography and disciplined alignment. A purposeful vermilion selection, charcoal periods and prominent section numbers give the editor contrast without visual noise.', 'Arial / 7 px bars / 64 px rows', '#bb392c', '#52606d', '#3e7169'),
    ('12-swiss-grid-refined', 'refined', 'Swiss Grid / Refined', 'The original grid. A clearer read.', 'The original Swiss Grid with stronger, larger typography and more compact rows. Week 0 has the same surface as every other week. Selection is a clean outline; hovering a bar reveals its move affordance.', 'Segoe UI / 13–14 px chart type / 44 px rows', '#244d75', '#467969', '#a87940'),
]
COUNT = len(DESIGNS)

ICONS = '''<svg class="icon-defs" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>
<symbol id="undo" viewBox="0 0 24 24"><path d="M9 6 4 11l5 5M4 11h10a6 6 0 0 1 6 6"/></symbol>
<symbol id="redo" viewBox="0 0 24 24"><path d="m15 6 5 5-5 5M20 11H10a6 6 0 0 0-6 6"/></symbol>
<symbol id="plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="chevron" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
<symbol id="right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
<symbol id="left" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></symbol>
<symbol id="grip" viewBox="0 0 24 24"><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" stroke-width="3"/></symbol>
<symbol id="calendar-icon" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2"/></symbol>
<symbol id="weeks" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14M15 5v14"/></symbol>
<symbol id="zoom" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6M10 7v6"/></symbol>
<symbol id="cursor" viewBox="0 0 24 24"><path d="m5 3 3 17 4-6 7-2Z"/></symbol>
<symbol id="diamond" viewBox="0 0 24 24"><path d="m12 3 9 9-9 9-9-9Z"/></symbol>
<symbol id="edit" viewBox="0 0 24 24"><path d="m15 4 5 5M4 20l1-6L16 3l5 5-11 11Z"/></symbol>
<symbol id="trash" viewBox="0 0 24 24"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></symbol>
<symbol id="check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>
<symbol id="pan" viewBox="0 0 24 24"><path d="M12 3v18M3 12h18m-6-6-3-3-3 3m6 12-3 3-3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/></symbol>
<symbol id="grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></symbol>
<symbol id="info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></symbol>
</defs></svg>'''

def icon(name, cls=''):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#{name}"/></svg>'

def brand():
    return '<a class="brand" href="index.html" aria-label="Takt design gallery"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="wordmark">takt<span class="brand-dot">.</span></span></a>'

def toolbar():
    return f'''<div class="control-toolbar" aria-label="Editor toolbar">
    <div class="undo-group"><button type="button" class="icon-button" aria-label="Undo (visual sample)" title="Undo">{icon('undo')}</button><button type="button" class="icon-button" disabled aria-label="Redo (visual sample)" title="Redo">{icon('redo')}</button></div>
    <span class="tool-divider"></span><div class="zoom-control">{icon('zoom')}<select aria-label="Zoom (visual sample)"><option>100%</option><option>75%</option><option>125%</option></select></div>
    <span class="tool-divider"></span><div class="mode-switch" aria-label="Timeline display"><label class="relative-label" for="relative">{icon('weeks')}Weeks</label><label class="calendar-label" for="calendar">{icon('calendar-icon')}Dates</label></div></div>'''

def reference():
    return f'''<details class="reference-picker"><summary>{icon('calendar-icon')}<span class="relative-text">Calendar reference</span><span class="calendar-text">Week 3 · Oct 5, 2026</span>{icon('chevron')}</summary><div class="floating-panel"><strong>Set a week’s start date</strong><p>Week 3 starts on:</p><input type="date" value="2026-10-05" aria-label="Reference date visual sample"><p>Week 0 is September 14, 2026. This specimen uses a fixed reference; changing the input does not reschedule the preview.</p></div></details>'''

def header():
    dates = ['Aug 31','Sep 7','Sep 14','Sep 21','Sep 28','Oct 5','Oct 12','Oct 19','Oct 26','Nov 2','Nov 9','Nov 16']
    weeks = []
    for i in range(12):
        w = i-2
        label = f'Week {str(w).replace("-", "−")}'
        classes = 'week origin' if w == 0 else 'week'
        small = 'ORIGIN' if w == 0 else ('2026' if i in (0,5) else '7 DAYS')
        weeks.append(f'<div class="{classes}"><span class="relative-text">{label}</span><span class="calendar-text">{dates[i]}</span><small>{small}</small></div>')
    return '<div class="chart-header"><div class="lane-heading">Sections &amp; rows</div><div class="week-heading">'+''.join(weeks)+'</div></div>'

def bar(label, start, span, selected=False, override=False):
    classes = 'bar'+(' selected' if selected else '')+(' override' if override else '')
    desc = f'{label or "Unlabeled bar"}: Weeks {start-2}–{start+span-3}'
    return f'<div class="{classes}" style="--start:{start};--span:{span}" title="{desc}"><span>{escape(label)}</span></div>'

def milestone(label, boundary, left=False):
    return f'<div class="milestone{" label-left" if left else ""}" style="--boundary:{boundary}" title="{escape(label)}: end of Week {boundary-3}"><span>{escape(label)}</span></div>'

def row(name, items, phase=''):
    return f'<div class="chart-row {phase}"><div class="row-label">{icon("grip", "grip")}<span class="row-name">{escape(name)}</span></div><div class="lane">{items}</div></div>'

def section(name, n, phase='', subtitle=''):
    return f'<div class="section-heading {phase}"><div class="section-label">{icon("grip","grip")}{icon("chevron","chevron")}<i class="section-color"></i><span>{name}</span><span class="count">{n:02}</span></div><div class="section-timeline">{subtitle}</div></div>'

def add_row():
    return f'<div class="add-row-line"><div><button type="button" class="add-control" aria-label="Add row (visual sample)">{icon("plus")}Add row</button></div><div></div></div>'

def add_section():
    return f'<div class="add-section"><button type="button" class="add-control" aria-label="Add section (visual sample)">{icon("plus")}Add section</button></div>'

def charts():
    example = header()+section('Discovery',3,subtitle='')
    example += row('Research',bar('Interviews',1,3)+bar('Synthesis',4,2))
    example += row('Strategy',bar('Positioning',3,3)+milestone('Direction agreed',7))
    example += row('Alignment',bar('Workshop',4,2)+bar('Follow-up',7,2))
    example += add_row()+section('Design',3,'phase-b')
    example += row('Experience',bar('Exploration',5,3,True)+bar('Refinement',8,2),'phase-b')
    example += row('Visual system',bar('Foundations',5,2)+bar('Components',7,3,override=True),'phase-b')
    example += row('Review',milestone('Design review',8)+bar('Revisions',9,2),'phase-b')
    example += add_row()+section('Delivery',2,'phase-c')
    example += row('Build',bar('Implementation',8,3),'phase-c')
    example += row('Release',bar('Preparation',9,2)+milestone('Launch',11),'phase-c')
    example += add_row()+add_section()
    empty = header()+section('Unnamed section',1)+f'<div class="chart-row"><div class="row-label">{icon("grip","grip")}<span>Unnamed row</span></div><div class="lane"><div class="empty-hint">{icon("cursor")}Drag to create a bar · Double-click for a milestone.</div></div></div>'+add_row()+add_section()
    return f'<div class="chart-scroll" role="region" aria-label="Whole-week Gantt chart" tabindex="0"><div class="chart populated-chart">{example}</div><div class="chart empty-chart">{empty}</div></div>'

def foot():
    return f'<div class="canvas-foot"><span class="gesture">{icon("cursor")}Drag bars to move · Drag ends to resize · Double-click to rename</span><span class="gesture">{icon("pan")}<kbd>Space</kbd> + drag to pan</span></div>'

def shell(theme):
    canvas = f'<div class="canvas-wrap">{charts()}{foot()}</div>'
    if theme == 'precision':
        return f'<div class="editor-frame"><header class="app-head">{brand()}<span class="app-caption">Whole weeks. Clear decisions.</span></header><div class="workspace-head"><div class="workspace-title">Timeline<span>Draw directly. Keep the whole picture.</span></div>{toolbar()}</div>{canvas}</div>'
    if theme == 'club':
        return f'<header class="app-head"><div class="brand-block">{brand()}<span class="studio-label">A little structure.<br>A lot of possibility.</span></div>{toolbar()}</header><div class="workspace-head"><div class="workspace-title">Your timeline<span>Make it take shape.</span></div><span class="edition-mark">DRAW / ARRANGE / REPEAT</span></div>{canvas}'
    if theme == 'house':
        return f'<aside class="app-rail" aria-label="Chart controls">{brand()}<div class="rail-tools">{toolbar()}</div><div class="rail-signature"><i aria-hidden="true">✳</i><span>Make time<br>your own.</span></div></aside><div class="workspace-head"><div class="workspace-title">A plan in the making<span>Whole weeks. Your rhythm.</span></div><span class="house-badge">takt / studio</span></div>{canvas}'
    if theme == 'daybreak':
        return f'<header class="app-head">{brand()}<span class="daybreak-tag"><i aria-hidden="true"></i>A little room for what’s next.</span></header><div class="workspace-head"><div class="workspace-title">Let’s give it some shape<span>Draw a period. Find your rhythm.</span></div>{toolbar()}</div>{canvas}'
    if theme == 'fieldwork':
        return f'<header class="app-head"><div class="brand-block">{brand()}<span class="notebook-label">A working canvas<br>for things to come.</span></div>{toolbar()}</header><div class="workspace-head"><div class="workspace-title">Your timeline<span>Start anywhere. Build from here.</span></div>{reference()}</div>{canvas}'
    if theme in ('swiss','refined'):
        return f'<header class="app-head"><div class="brand-block">{brand()}<span class="app-kicker">Timeline editor</span></div><span class="app-caption">A clear view of what comes next.</span></header><div class="workspace-head"><div class="workspace-title">Your timeline <span>Whole weeks. Room to think.</span></div>{toolbar()}</div>{canvas}'
    if theme == 'ledger':
        return f'<header class="app-head"><div><div class="app-kicker">A study in time</div>{brand()}</div><span class="app-caption">Plan with perspective.</span></header><div class="workspace-head"><div class="workspace-title">A little structure. A clearer picture.<span>The timeline is your editing surface.</span></div>{toolbar()}</div>{canvas}'
    if theme == 'signal':
        return f'<header class="app-head">{brand()}<span class="rail-monogram" aria-label="Timeline editor">{icon("weeks")}</span><span class="rail-caption">Takt / Timeline editor</span></header><div class="workspace-head"><div class="workspace-title">Timeline <span>Whole-week editor</span></div>{toolbar()}</div>{canvas}'
    if theme == 'clay':
        return f'<header class="app-head">{brand()}<span class="app-caption">Good plans start with a little space.</span></header><div class="workspace-head"><div class="workspace-title">Shape what comes next.<span>Draw a period. Mark a moment. Make it yours.</span></div>{reference()}</div>{canvas}<div class="tool-dock">{toolbar()}</div>'
    if theme == 'mono':
        return f'<header class="app-head">{brand()}<span class="app-kicker">The timeline, considered.</span></header><div class="workspace-head"><div class="workspace-title">Timeline / <span>Whole-week view</span></div>{toolbar()}</div>{canvas}'
    return f'<header class="app-head"><div class="brand-block">{brand()}<span class="app-kicker">A simpler kind of planning</span></div>{toolbar()}</header><div class="workspace-head"><div class="workspace-title">Your timeline<span>Every period in its place.</span></div>{reference()}</div>{canvas}'

def notes(d, n):
    slug,theme,name,tagline,desc,type_desc,c1,c2,c3 = d
    swatches = ''.join(f'<span class="swatch {"active" if i==1 else ""}" style="--swatch:{c}" aria-label="Color {c}">{"✓" if i==1 else ""}</span>' for i,c in enumerate([c1,c2,c3,'#8290a3','#b37976']))
    menu = f'''<div class="context-menu" aria-label="Item context-menu specimen"><div class="menu-location">Exploration · Weeks 3–5</div><div class="menu-row">{icon('edit')}Rename<small>Double-click</small></div><div class="menu-divider"></div><div class="menu-location">Item color</div><div class="palette">{swatches}</div><div class="color-inherit">{icon('check')}Use section color</div><div class="menu-divider"></div><div class="menu-row menu-danger">{icon('trash')}Delete bar</div></div>'''
    creation = f'''<div class="context-menu" aria-label="Empty-space context-menu specimen"><div class="menu-location">Experience · Week 3</div><div class="menu-row">{icon('plus')}Add bar here</div><div class="menu-row">{icon('diamond')}Add milestone here</div></div>'''
    tokens=''.join(f'<span class="token"><i class="token-chip" style="background:{c}"></i>{label}</span>' for c,label in [(c1,'Primary'),(c2,'Secondary'),(c3,'Accent')])
    return f'''<section class="study-notes" id="design-notes" aria-label="Prototype notes and component studies">
    <div class="study-heading"><div><div class="app-kicker">Design study {n:02} / {COUNT:02} · {name}</div><h1>{tagline}</h1><p>{desc}</p></div><div class="state-toggle" aria-label="Preview state"><label for="example">Example chart</label><label for="empty">New document</label></div></div>
    <div class="token-strip">{tokens}<span class="type-sample">Aa <small style="font-size:10px;letter-spacing:0;color:var(--muted)">{type_desc}</small></span></div>
    <div class="specimen-grid"><article class="specimen"><h2>01 / In-place controls<small>Selected bar</small></h2>{menu}<p class="specimen-caption">Color and rename actions stay beside the item. A section supplies the default; an item may override it. Rows have no color setting.</p></article>
    <article class="specimen"><h2>02 / Recoverable deletion<small>Section</small></h2><div class="dialog" role="group" aria-label="Deletion confirmation specimen"><div class="dialog-icon">{icon('trash')}</div><h3>Delete “Design”?</h3><p>This removes 3 rows, 5 bars and 1 milestone in this section. You can undo this action.</p><div class="dialog-actions"><button type="button" class="small-button">Cancel</button><button type="button" class="small-button danger">Delete section</button></div></div><p class="specimen-caption">Rows and sections ask for confirmation with the full scope visible. One undo restores the entire action.</p></article>
    <article class="specimen"><h2>03 / Name it where it lives<small>Inline editing</small></h2><div class="sample-inline"><div class="inline-bar">{icon('grip')}<input type="text" value="Exploration" aria-label="Inline bar name specimen">{icon('edit')}</div></div><p class="specimen-caption">Enter finishes naming. Escape retains the new item without a label. This input shows the visual editing state only.</p><div class="collapsed-sample">{icon('right')}<i class="section-color" style="background:var(--phase-c)"></i>Delivery<small>2 rows hidden</small></div><p class="specimen-caption">Collapsed sections keep their content and week positions.</p></article>
    <article class="specimen"><h2>04 / Create at the pointer<small>Empty row</small></h2>{creation}<p class="specimen-caption">A menu-created bar occupies Week 3. A milestone marks its end: the boundary at the start of Week 4.</p></article>
    <article class="specimen"><h2>05 / Continuous, then precise<small>Drag preview</small></h2><div class="snap-example"><div class="ghost"></div><div class="tracking">Exploration</div></div><p class="specimen-caption">Solid bar: continuous pointer position. Dashed outline: whole-week result. Displaced bars glide; one undo restores every affected item. Motion is an implementation requirement.</p></article>
    <article class="specimen"><h2>06 / Anchor the calendar<small>Week 3</small></h2><div class="dialog" style="margin-top:0"><h3>October 5, 2026</h3><p style="margin-bottom:10px">Start of Week 3</p><div class="menu-divider"></div><p>Week 0 · September 14<br>Week 2 · September 28<br>Week 4 · October 12</p></div><p class="specimen-caption">Use Weeks / Dates above to change the labels. Positions stay fixed. A milestone in the October 5 week represents October 11.</p></article>
    <article class="specimen"><h2>07 / Organize the lanes<small>Row menu</small></h2><div class="context-menu"><div class="menu-location">Experience</div><div class="menu-row">{icon('plus')}Insert row above</div><div class="menu-row">{icon('plus')}Insert row below</div><div class="menu-divider"></div><div class="menu-row">{icon('edit')}Rename</div><div class="menu-row menu-danger">{icon('trash')}Delete row…</div></div><p class="specimen-caption">Drag a row’s name to reorder or move it between sections. Dates remain fixed. Row deletion asks for confirmation: “This removes 2 bars in Experience. You can undo this action.”</p></article>
    <article class="specimen"><h2>08 / Keep the group together<small>Section menu</small></h2><div class="context-menu"><div class="menu-location">Design</div><div class="menu-row">{icon('plus')}Add row</div><div class="menu-row">{icon('plus')}Add section</div><div class="menu-row">{icon('edit')}Rename</div><div class="menu-divider"></div><div class="palette">{swatches}</div><div class="menu-row menu-danger">{icon('trash')}Delete section…</div></div><p class="specimen-caption">The section supplies its color to all inherited items. The differently colored Components bar illustrates an explicit override. Drag the heading to move the whole group.</p></article>
    <article class="specimen"><h2>09 / Make space, keep duration<small>Collision study</small></h2><div class="cascade-label">Before · three adjacent bars</div><div class="cascade-row"><i style="--s:0;--d:2">A</i><i style="--s:2;--d:2">B</i><i style="--s:4;--d:1">C</i></div><div class="cascade-label">After · extend A by one week</div><div class="cascade-row"><i style="--s:0;--d:3">A</i><i style="--s:3;--d:2">B</i><i style="--s:5;--d:1">C</i></div><p class="specimen-caption">B and C shift one week to the right. Their durations stay the same. Reversing the drag keeps the push; one undo restores all three bars. Creation-collision behavior remains undecided.</p></article></div>
    <p class="prototype-disclaimer">{icon('info')}Static HTML + CSS study. Example / new document and Weeks / Dates switch via CSS. Chart gestures and editing commands are visual specimens.</p></section>'''

def switcher(n):
    prev = DESIGNS[(n-2)%COUNT][0]
    nxt = DESIGNS[n%COUNT][0]
    links = ''.join(f'<a href="{d[0]}.html" class="{"active" if i==n else ""}" {"aria-current=\"page\"" if i==n else ""} title="{d[2]}">{i:02}</a>' for i,d in enumerate(DESIGNS,1))
    return f'<nav class="prototype-switcher" aria-label="Design comparison"><a href="{prev}.html" aria-label="Previous design">{icon("left")}</a><span class="switch-title">{n:02} / {DESIGNS[n-1][2]}</span>{links}<a href="{nxt}.html" aria-label="Next design">{icon("right")}</a><a class="gallery-link" href="index.html">{icon("grid")}Gallery</a><label class="empty-switch" for="empty">Empty</label><label class="example-switch" for="example">Example</label><a class="gallery-link" href="#design-notes">States</a></nav>'

for n,d in enumerate(DESIGNS,1):
    slug,theme,name,*_ = d
    extra_css = '<link rel="stylesheet" href="round-two.css">' if 6 < n <= 10 else ('<link rel="stylesheet" href="swiss-precision.css">' if n == 11 else ('<link rel="stylesheet" href="swiss-grid-refined.css">' if n == 12 else ''))
    body_class = 'swiss refined' if theme == 'refined' else theme
    document=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Takt · {name} · UI prototype {n:02}</title><link rel="stylesheet" href="base.css"><link rel="stylesheet" href="themes.css">{extra_css}</head>
    <body class="{body_class}">{ICONS}<span id="canvas-preview" aria-hidden="true"></span><input class="state-radio" type="radio" name="document-state" id="example" checked aria-label="Example document"><input class="state-radio" type="radio" name="document-state" id="empty" aria-label="New document"><input class="state-radio" type="radio" name="timeline-mode" id="relative" checked aria-label="Relative weeks"><input class="state-radio" type="radio" name="timeline-mode" id="calendar" aria-label="Calendar dates">
    <main class="shell" aria-label="Takt editor visual prototype">{shell(theme)}</main>{notes(d,n)}{switcher(n)}</body></html>'''
    if theme == 'precision':
        document = document.replace('<span class="relative-text">Week 0</span>', '<span class="relative-text"><span class="origin-label">Week</span><span class="origin-number">0</span></span>')
    if theme == 'refined':
        document = document.replace('<small>ORIGIN</small>', '<small>7 DAYS</small>')
    (ROOT / f'{slug}.html').write_text(document,encoding='utf-8')

cards=[]
for n,d in enumerate(DESIGNS,1):
    slug,theme,name,tagline,desc,typ,c1,c2,c3=d
    cards.append(f'''<article class="design-card"><a class="preview-link" href="{slug}.html" aria-label="Open {name}"><div class="preview-window"><iframe scrolling="no" src="{slug}.html#canvas-preview" title="{name} live preview" tabindex="-1" loading="lazy"></iframe></div><span class="open-preview">Explore design ↗</span></a><div class="card-body"><div class="card-top"><span class="design-number">{n:02}</span><h2><a href="{slug}.html">{name}</a></h2><span class="swatches"><i style="background:{c1}"></i><i style="background:{c2}"></i><i style="background:{c3}"></i></span></div><p>{desc}</p><a class="card-action" href="{slug}.html">Open full preview <span>↗</span></a></div></article>''')
index=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Takt · Six directions</title><link rel="stylesheet" href="gallery.css"></head><body><header class="gallery-header"><a class="gallery-brand" href="index.html">takt<span>.</span></a><span class="header-caption">Design exploration / October 2026</span><span class="header-status"><i></i>Local prototype studio</span></header><main><div class="intro"><div class="eyebrow">ONE EDITOR. SIX POINTS OF VIEW.</div><h1>A clearer way<br>to see what’s next<span>.</span></h1><div class="intro-bottom"><p>Six light-mode directions for Takt. The same timeline, six distinct visual systems. Explore the canvas, inspect the details, and find the one that feels right.</p><a href="compare.html" class="compare-button">Compare side by side <span>↗</span></a></div></div><div class="gallery-label"><span>THE COLLECTION <small>06 studies</small></span><span>HTML + CSS · No setup · No JavaScript</span></div><section class="design-grid" aria-label="Six UI design directions">{''.join(cards)}</section><section class="review-guide"><div><div class="eyebrow">HOW TO REVIEW</div><h2>Look at the work.<br>Then look at the details.</h2></div><ol><li><span>01</span><div><strong>Open a direction.</strong><p>Use the bottom switcher to move between all six full-size previews.</p></div></li><li><span>02</span><div><strong>Inspect its states.</strong><p>Scroll below the canvas for empty-document, selection, palette, deletion and inline-editing specimens. Switch Weeks / Dates in the toolbar.</p></div></li><li><span>03</span><div><strong>Pick what feels right.</strong><p>Choose one direction, or combine the typography, layout and component details you like from several.</p></div></li></ol></section><div class="scope-note"><strong>Built around the Takt UX specification.</strong><p>Week 0 stays fixed. Whole-week bars and week-ending milestones sit inside colored sections. The chart leads; controls stay small. These are visual studies, so chart gestures and editing commands are not implemented.</p><a href="../docs/ux-specification.md">Read the UX specification ↗</a><a href="CLAUDE-DESIGN-RESEARCH.md">Claude Design research ↗</a></div></main><footer><span>Takt / An exploration of time and interface.</span><span>Six directions. One decision.</span></footer></body></html>'''
# The refined original leads; all previous studies remain available.
index = index.replace('Takt · Six directions', 'Takt · Twelve directions')
index = index.replace('ONE EDITOR. SIX POINTS OF VIEW.', 'VERSION 12 / SWISS GRID, REFINED')
index = index.replace('A clearer way<br>to see what’s next', 'The original grid.<br>A clearer read')
index = index.replace('Six light-mode directions for Takt. The same timeline, six distinct visual systems. Explore the canvas, inspect the details, and find the one that feels right.', 'Swiss Grid, refined with larger type and tighter rows. A clean selection, hover cues and an even timeline surface. All eleven earlier studies are kept below.')
index = index.replace('THE COLLECTION <small>06 studies</small>', 'SWISS GRID / REFINED <small>12 / The latest version</small>')
index = index.replace('aria-label="Six UI design directions"', 'id="latest-study" aria-label="Swiss Grid refined version 12"')
original_label = '<div class="gallery-label original-label" id="original-six"><span>THE ORIGINAL COLLECTION <small>01–06 / Kept for comparison</small></span><a href="#round-two">Back to the new directions ↑</a></div>'
second_label = '<div class="gallery-label original-label" id="round-two"><span>ROUND TWO <small>07–10 / Four less corporate directions</small></span><a href="#final-study">Back to Swiss Precision ↑</a></div>'
final_label = '<div class="gallery-label original-label" id="final-study"><span>SWISS PRECISION <small>11 / The reference-led study</small></span><a href="#latest-study">Back to version 12 ↑</a></div>'
final_context = '<aside class="final-context"><span class="eyebrow">YOUR REFINEMENTS</span><h2>More legible.<br>Less vertical space.</h2><p>Row names are 14 px and bar labels are 13 px. The original palette and layout stay familiar, with stronger text and a clearer hierarchy.</p><p>Rows shrink from 61 to 44 px. Week 0 shares the same background as every other week. Selected bars have no end handles; hover shows a grab cursor and a subtle color change.</p><a href="12-swiss-grid-refined.html">Open version 12 ↗</a><a href="compare.html">Compare with original Swiss Grid ↗</a></aside>'
index = index.replace(''.join(cards), cards[11] + final_context + '</section>' + final_label + '<section class="design-grid" aria-label="Swiss Precision version 11">' + cards[10] + '</section>' + second_label + '<section class="design-grid" aria-label="Four round-two UI design directions">' + ''.join(cards[6:10]) + '</section>' + original_label + '<section class="design-grid" aria-label="Six original UI design directions">' + ''.join(cards[:6]))
index = index.replace('all six full-size previews', 'all twelve full-size previews')
index = index.replace('Six directions. One decision.', 'Twelve directions. Find your favorite.')
(ROOT/'index.html').write_text(index,encoding='utf-8')

def compare_pane(side,default):
    radios=''.join(f'<input class="compare-radio" type="radio" name="{side}" id="{side}{i}" {"checked" if i==default else ""}>' for i in range(1,COUNT+1))
    labels=''.join(f'<label for="{side}{i}">{i:02} {d[2]}</label>' for i,d in enumerate(DESIGNS,1))
    frames=''.join(f'<div class="compare-frame frame-{i}"><iframe scrolling="no" src="{d[0]}.html#canvas-preview" title="{side} preview: {d[2]}" loading="lazy"></iframe><a href="{d[0]}.html" target="_blank" rel="noopener">Open {d[2]} full size ↗</a></div>' for i,d in enumerate(DESIGNS,1))
    return f'<section class="compare-pane" aria-label="{side} design">{radios}<div class="compare-options">{labels}</div><div class="compare-frames">{frames}</div></section>'

compare=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Takt · Compare directions</title><link rel="stylesheet" href="gallery.css"></head><body class="comparison"><header class="gallery-header"><a class="gallery-brand" href="index.html">takt<span>.</span></a><span class="header-caption">Compare two directions</span><a class="back-link" href="index.html">← Collection</a></header><main><div class="compare-intro"><h1>Find your point of view.</h1><p>Choose a direction on each side. These live previews are scaled for comparison; open a full-size view to judge text and detail.</p></div><div class="compare-grid">{compare_pane('left',1)}{compare_pane('right',2)}</div><p class="compare-note">All six use the same chart content. Native HTML radio controls switch the previews; no JavaScript is used.</p></main></body></html>'''
compare = compare.replace('All six use the same chart content.', 'All twelve use the same chart content. Version 12 refines the original Swiss Grid typography, spacing and selection styling.')
compare = compare.replace('<link rel="stylesheet" href="gallery.css">', '<link rel="stylesheet" href="gallery.css"><link rel="stylesheet" href="comparison.css">')
compare = compare.replace(compare_pane('left',1), compare_pane('left',12)).replace(compare_pane('right',2), compare_pane('right',1))
(ROOT/'compare.html').write_text(compare,encoding='utf-8')

visible = []
selected = []
for side in ('left','right'):
    for i in range(1,COUNT+1):
        visible.append(f'#{side}{i}:checked~.compare-frames .frame-{i}')
        selected.append(f'#{side}{i}:checked~.compare-options label[for={side}{i}]')
(ROOT/'comparison.css').write_text(','.join(visible)+'{display:block}\n'+','.join(selected)+'{background:#edf1f6;color:#334c69;font-weight:600}\n'+'.compare-radio:focus-visible~.compare-options{outline:2px solid #526c8e;outline-offset:-2px}\n',encoding='utf-8')
print(f'Generated {COUNT} studies, gallery, and side-by-side comparison.')

from color_themes import generate as generate_color_themes
generate_color_themes()


