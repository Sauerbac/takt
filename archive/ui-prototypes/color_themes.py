"""Color-only studies of version 12. No layout or behavior changes."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent

# key, name, character, description, accent, then three bar ink / surface pairs.
# All page, canvas, text, border and toolbar neutrals stay inherited from v12.
THEMES = [
    ('a', 'Navy', 'Original / conservative', 'The version 12 accents: navy, sage and muted ochre. Familiar, precise and quietly professional.', '#244d75', '#315d82', '#e4edf5', '#467969', '#e4f0eb', '#a87940', '#f5ebd9'),
    ('b', 'Graphite', 'Conservative', 'Graphite with petrol teal and warm amber. Restrained, with complementary accents that give the timeline some personality.', '#434c58', '#434c58', '#e7eaee', '#336f73', '#dcf0ed', '#876039', '#f6e8cf'),
    ('c', 'Forest', 'Conservative', 'Deep pine, dusty blue and bronze. Calm and grounded, with subtle color that feels natural and considered.', '#34614d', '#34614d', '#dceede', '#526b76', '#e5edf1', '#836036', '#f1eadb'),
    ('d', 'Sandstone', 'Conservative / warm', 'Soft umber, dusty olive and muted plum. Warmth in the accents, with a neutral white canvas that keeps the work clear.', '#7b5b40', '#7b5b40', '#f0e2cb', '#626b4b', '#e9edde', '#76596c', '#eee0ec'),
    ('e', 'Lagoon', 'Balanced / fresh', 'Ocean teal, cornflower and golden sand. Fresh, distinct accents bring color into the workspace without overwhelming it.', '#176e79', '#176e79', '#d4f0f0', '#4265a6', '#e0eaff', '#896024', '#faedcb'),
    ('f', 'Iris', 'Balanced / expressive', 'Iris purple, soft teal and honey. A gentle creative direction, with lavender bars and a clear purple focus.', '#7050a4', '#7050a4', '#e8ddfa', '#387571', '#ddf1eb', '#895d24', '#f9ebcc'),
    ('g', 'Coral', 'Playful / warm', 'Coral, lavender and sea green. Cheerful but composed: peach-colored bars, a warm coral brand accent and fresh complementary colors.', '#a34738', '#a34738', '#ffded2', '#7654a0', '#ebdefb', '#34756b', '#d8f1e6'),
    ('h', 'Citrus', 'Playful / bright', 'Chartreuse, vivid blue and raspberry. The most energetic accents, with bright bar surfaces balanced by dark, readable labels.', '#576d17', '#576d17', '#e0f39b', '#345bc0', '#dde7ff', '#a13c70', '#ffdced'),
    # I–R use saturated fills, with separate label colors for readable solid bars.
    ('i', 'Electric Blue', 'Strong / crisp', 'Electric cobalt, vivid teal and tangerine. Clean and confident, with solid blue bars that immediately give the grid an identity.', '#2455f5', '#2455f5', '#2455f5', '#008579', '#008579', '#ff9b36', '#ff9b36', '#ffffff', '#ffffff', '#482400'),
    ('j', 'Vermilion', 'Strong / graphic', 'Vermilion, charcoal and solar yellow. A bold graphic palette: punchy red discovery, quiet dark design and a yellow finish.', '#dc341a', '#dc341a', '#dc341a', '#303342', '#303342', '#ffd129', '#ffd129', '#ffffff', '#ffffff', '#433300'),
    ('k', 'Indigo', 'Strong / unexpected', 'Saturated indigo, acid lime and poppy red. A precise grid with the energy of a poster, using complementary color at full strength.', '#5035df', '#5035df', '#5035df', '#c0ed28', '#c0ed28', '#d73648', '#d73648', '#ffffff', '#293a00', '#ffffff'),
    ('l', 'Orchid', 'Strong / creative', 'Electric orchid, rich turquoise and mango. Bright purple leads a colorful studio palette that stays sharp on the white canvas.', '#9236e8', '#9236e8', '#9236e8', '#00847c', '#00847c', '#ffc13d', '#ffc13d', '#ffffff', '#ffffff', '#4d3200'),
    ('m', 'Fuchsia', 'Strong / expressive', 'Hot fuchsia, deep aubergine and vivid blue. A confident pink signature with jewel-colored companions and white bar labels.', '#ce1971', '#ce1971', '#ce1971', '#64267d', '#64267d', '#2752ef', '#2752ef', '#ffffff', '#ffffff', '#ffffff'),
    ('n', 'Emerald', 'Strong / fresh', 'Emerald, mandarin and royal blue. Saturated green anchors the timeline while orange adds warmth and blue gives the finish a crisp contrast.', '#00815d', '#00815d', '#00815d', '#ff963e', '#ff963e', '#2554ec', '#2554ec', '#ffffff', '#482200', '#ffffff'),
    ('o', 'Tangerine', 'Strong / sunny', 'Tangerine, violet and bright turquoise. A warm orange signature, with two vivid cooler accents for a playful, energetic workspace.', '#c45100', '#c45100', '#ff8b2c', '#7529d9', '#7529d9', '#03b9ae', '#03b9ae', '#482000', '#ffffff', '#003b35'),
    ('p', 'Ocean Pop', 'Strong / clear', 'Azure blue, cyan and lime. A bright coastal palette with solid blue periods, clear cyan design work and a lively lime delivery.', '#006cd9', '#006cd9', '#006cd9', '#00b5c5', '#00b5c5', '#bceb21', '#bceb21', '#ffffff', '#003940', '#293b00'),
    ('q', 'Acid Lime', 'Strong / daring', 'Acid lime, plum and blazing orange. The boldest contrast in the collection: electric green bars, deep purple selection and an orange finish.', '#607900', '#607900', '#bceb21', '#7623a8', '#7623a8', '#ff752b', '#ff752b', '#273800', '#ffffff', '#4a1a00'),
    ('r', 'Primary', 'Strong / playful', 'Pure blue, cherry red and sunny yellow. A simple, unmistakable three-color palette that makes each section feel lively and distinct.', '#2549e8', '#2549e8', '#2549e8', '#cf273e', '#cf273e', '#ffd52b', '#ffd52b', '#ffffff', '#ffffff', '#483700'),
    # S–X: medium-strength fills, between pastel surfaces and solid saturated bars.
    ('s', 'Cornflower', 'Medium / clear', 'Cornflower blue, soft teal and golden apricot. Clearly colorful fills with dark labels: a cooler, confident middle ground.', '#3461cb', '#25439d', '#9ebcff', '#1e655a', '#82c8bc', '#774215', '#f2bb78'),
    ('t', 'Apricot', 'Medium / warm', 'Apricot, lavender and sea blue. Warm orange leads, with enough color to feel friendly while leaving the white canvas calm.', '#b35d35', '#874327', '#f3b184', '#563c86', '#b5a2e0', '#2e626b', '#a0d4dd'),
    ('u', 'Periwinkle', 'Medium / creative', 'Periwinkle, jade and honey. A composed creative palette with richer lavender bars and quieter complementary colors.', '#7555b9', '#564093', '#b1a3e6', '#285f59', '#94cec6', '#755421', '#edcb80'),
    ('v', 'Jade', 'Medium / natural', 'Jade green, denim blue and warm terracotta. Fresh and grounded, with fuller color than the original sage palette.', '#368658', '#276540', '#87c7a1', '#315583', '#93b3e1', '#864936', '#e8ac97'),
    ('w', 'Rose', 'Medium / playful', 'Rose pink, muted iris and marigold. A little warmth and playfulness, with medium-strength color rather than hot-pink blocks.', '#b4517b', '#853652', '#e7a4bf', '#464980', '#a9ade4', '#745222', '#ecca80'),
    ('x', 'Pistachio', 'Medium / lively', 'Pistachio, cornflower and soft coral. A lively green accent moderated by gentler blue and orange companions.', '#6e8730', '#4f6121', '#becf82', '#345b9d', '#a1baeb', '#894532', '#e6a18c'),
]

COUNT = len(THEMES)
REVIEW_THEMES = THEMES[18:] + THEMES[8:18] + THEMES[:8]


def filename(t):
    return f'12{t[0]}-{t[1].lower().replace(" ", "-")}.html'


def swatches(t):
    return '<span class="swatches" aria-label="Section colors">' + ''.join(
        f'<i style="background:{t[i]}" title="{t[i]}"></i>' for i in (6, 8, 10)
    ) + '</span>'


def generate():
    source = (ROOT / '12-swiss-grid-refined.html').read_text(encoding='utf-8')
    css = ['/* Accent tokens only. All light neutral surfaces, text, typography and geometry stay inherited from version 12. */']
    token_names = ('accent', 'phase-a', 'phase-a-bg', 'phase-b', 'phase-b-bg', 'phase-c', 'phase-c-bg')
    for index, t in enumerate(THEMES):
        key, name, character, desc = t[:4]
        solid = len(t) == 14
        tokens = list(zip(token_names, t[4:11]))
        if solid:
            tokens += list(zip(('phase-a-ink', 'phase-b-ink', 'phase-c-ink'), t[11:14]))
        css.append(f'.refined.color-{key}' + '{' + ''.join(f'--{k}:{v};' for k, v in tokens) + '}')
        page = source.replace('</head>', '<link rel="stylesheet" href="color-themes.css"><link rel="stylesheet" href="color-review-controls.css"></head>')
        page = page.replace('class="swiss refined"', f'class="swiss refined color-{key}{" color-bold" if solid else ""}"')
        page = re.sub(r'<title>.*?</title>', f'<title>Takt · 12{key.upper()} {name} · Color study</title>', page)
        page = page.replace('Design study 12 / 12 · Swiss Grid / Refined', f'Color study 12{key.upper()} / {COUNT} themes · {character}')
        page = page.replace('The original grid. A clearer read.', f'{name}. The same refined grid.')
        page = page.replace('The original Swiss Grid with stronger, larger typography and more compact rows. Week 0 has the same surface as every other week. Selection is a clean outline; hovering a bar reveals its move affordance.', desc + ' Layout, type, spacing, geometry and interactions are identical to version 12.')
        # Update every hardcoded palette specimen to match the theme tokens.
        palette_colors = (t[6], t[8], t[10]) if index >= 8 else (t[5], t[7], t[9])
        for old, new in zip(('#244d75', '#467969', '#a87940'), palette_colors):
            page = page.replace(f'background:{old}', f'background:{new}')
            page = page.replace(f'--swatch:{old}', f'--swatch:{new}')
            page = page.replace(f'Color {old}', f'Color {new}')
        group = THEMES[:8] if index < 8 else (THEMES[8:18] if index < 18 else THEMES[18:])
        position = group.index(t)
        previous, following = group[(position - 1) % len(group)], group[(position + 1) % len(group)]
        links = ''.join(f'<a href="{filename(o)}" class="theme-choice {"active" if o[0] == key else ""}" title="12{o[0].upper()} · {o[1]}" aria-label="12{o[0].upper()} {o[1]}"' + (' aria-current="page"' if o[0] == key else '') + f'>{o[0].upper()}</a>' for o in group)
        nav = f'''<nav class="prototype-switcher color-switcher" aria-label="Color theme comparison">
            <a href="{filename(previous)}" aria-label="Previous color theme">←</a><span class="switch-title">12{key.upper()} / {name}</span>{links}<a href="{filename(following)}" aria-label="Next color theme">→</a>
            <a class="gallery-link" href="colors.html">Themes</a><a class="gallery-link" href="compare-colors.html">Compare</a><label class="empty-switch" for="empty">Empty</label><label class="example-switch" for="example">Example</label><a class="gallery-link" href="#design-notes">States</a></nav>'''
        page = re.sub(r'<nav class="prototype-switcher".*?</nav>', nav, page, flags=re.S)
        (ROOT / filename(t)).write_text(page, encoding='utf-8')
    css.append('''/* Saturated bars: color treatment only, using the exact v12 geometry. */
.refined.color-bold .chart-row{--bar-ink:var(--phase-a-ink)}
.refined.color-bold .chart-row.phase-b{--bar-ink:var(--phase-b-ink)}
.refined.color-bold .chart-row.phase-c{--bar-ink:var(--phase-c-ink)}
.refined.color-bold .bar{color:var(--bar-ink)}
.refined.color-bold .bar.override{color:var(--phase-c-ink)}
.refined.color-bold .bar:hover{background:color-mix(in srgb,var(--bar-bg) 90%,#000 10%)}
.refined.color-bold .inline-bar{color:var(--phase-b-ink)}
.refined.color-bold .snap-example .tracking,.refined.color-bold .cascade-row i{color:var(--phase-a-ink)}
.refined.color-bold .swatch:nth-child(1){color:var(--phase-a-ink)}
.refined.color-bold .swatch:nth-child(2){color:var(--phase-b-ink)}
.refined.color-bold .swatch:nth-child(3){color:var(--phase-c-ink)}''')
    (ROOT / 'color-themes.css').write_text('\n'.join(css) + '\n', encoding='utf-8')

    cards = []
    for t in THEMES:
        key, name, character, desc = t[:4]
        cards.append(f'''<article class="design-card color-card" id="theme-{key}">
            <a class="preview-link" href="{filename(t)}" aria-label="Open 12{key.upper()} {name}"><div class="preview-window"><iframe scrolling="no" src="{filename(t)}#canvas-preview" title="{name} version 12 preview" tabindex="-1" loading="lazy"></iframe></div><span class="open-preview">Explore {name} ↗</span></a>
            <div class="card-body"><div class="card-top"><span class="design-number">12{key.upper()}</span><h2><a href="{filename(t)}">{name}</a></h2>{swatches(t)}</div><span class="theme-character">{character}</span><p>{desc}</p><a class="card-action" href="{filename(t)}">Open full preview <span>↗</span></a></div></article>''')
    shortcuts = ''.join(f'<a href="#theme-{t[0]}"><span>{t[0].upper()}</span> {t[1]}</a>' for t in REVIEW_THEMES)
    gallery = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Takt · Version 12 · Twenty-four color themes</title><link rel="stylesheet" href="gallery.css"><link rel="stylesheet" href="color-gallery.css"></head><body class="color-gallery">
        <header class="gallery-header"><a class="gallery-brand" href="index.html">takt<span>.</span></a><span class="header-caption">Version 12 / Color exploration</span><a class="back-link" href="index.html">All design studies ↗</a></header>
        <main><div class="intro"><div class="eyebrow">VERSION 12 / SIX NEW MEDIUM-STRENGTH PALETTES</div><h1>A little color.<br>The right balance<span>.</span></h1><div class="intro-bottom"><p>Six new palettes between the first soft colors and the saturated solids. Richer colored fills, dark labels and the same calm white canvas. Every earlier palette stays available for comparison.</p><a href="compare-colors.html" class="compare-button">Compare two themes <span>↗</span></a></div></div>
        <div class="fixed-design"><strong>Version 12 stays intact.</strong><span>Same light surfaces, layout, typography, spacing and components.</span><a href="12-swiss-grid-refined.html">Original reference ↗</a></div>
        <nav class="theme-index" aria-label="Jump to a color theme">{shortcuts}</nav>
        <div class="gallery-label"><span>BETWEEN THE TWO <small>S–X / Six new balanced palettes</small></span><span>Medium-strength fills · Dark labels</span></div><section class="design-grid" aria-label="Six medium-strength accent themes">{''.join(cards[18:])}</section>
        <div class="gallery-label original-label"><span>THE STRONGER PALETTES <small>I–R / Saturated</small></span><span>Kept for comparison</span></div><section class="design-grid" aria-label="Ten saturated accent themes">{''.join(cards[8:18])}</section>
        <div class="gallery-label original-label"><span>THE EARLIER PALETTES <small>A–D / Conservative</small></span><span>Kept for comparison</span></div><section class="design-grid" aria-label="Four conservative color themes">{''.join(cards[:4])}</section>
        <div class="gallery-label original-label"><span>SOFTER COLOR <small>E–H / Fresh to playful</small></span><span>The first color round</span></div><section class="design-grid" aria-label="Four fresh and playful color themes">{''.join(cards[4:8])}</section>
        <section class="color-decision"><div class="eyebrow">YOUR NEXT STEP</div><h2>Choose the one you want to work in.</h2><p>Open your favorites at full size, compare them side by side, and try the empty chart or Dates view. Then tell me the letter or name you prefer. That palette will become the direction for the app.</p><a class="compare-button" href="compare-colors.html">Find your favorite <span>↗</span></a></section>
        <p class="compare-note">Visual prototypes. Chart editing remains a component study; the app comes after your design choice. All twelve earlier designs are preserved.</p></main><footer><span>Takt / Swiss Grid, Refined.</span><span>Twenty-four palettes. Your choice.</span></footer></body></html>'''
    (ROOT / 'colors.html').write_text(gallery, encoding='utf-8')

    def pane(side, default):
        radios = ''.join(f'<input class="compare-radio" type="radio" name="{side}" id="{side}-{t[0]}" aria-label="{side.capitalize()} theme: {t[1]}" {"checked" if t[0] == default else ""}>' for t in THEMES)
        options = ''.join(f'<label for="{side}-{t[0]}">{t[0].upper()} · {t[1]}</label>' for t in THEMES[18:])
        earlier = ''.join(f'<label for="{side}-{t[0]}">{t[0].upper()} · {t[1]}</label>' for t in REVIEW_THEMES[6:])
        options += f'<details class="earlier-themes"><summary>Compare with earlier palettes (A–R)</summary><div class="earlier-theme-options">{earlier}</div></details>'
        frames = ''.join(f'<div class="compare-frame frame-{t[0]}"><iframe scrolling="no" src="{filename(t)}#canvas-preview" title="{side.capitalize()} preview: {t[1]}" loading="lazy"></iframe><a href="{filename(t)}">Open 12{t[0].upper()} {t[1]} full size ↗</a></div>' for t in THEMES)
        return f'<section class="compare-pane" aria-label="{side.capitalize()} color theme">{radios}<div class="compare-options">{options}</div><div class="compare-frames">{frames}</div></section>'

    compare = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Takt · Compare version 12 color themes</title><link rel="stylesheet" href="gallery.css"><link rel="stylesheet" href="color-gallery.css"><link rel="stylesheet" href="color-comparison.css"></head><body class="comparison color-comparison"><header class="gallery-header"><a class="gallery-brand" href="colors.html">takt<span>.</span></a><span class="header-caption">Version 12 / Color comparison</span><a class="back-link" href="colors.html">← All color themes</a></header><main><div class="compare-intro"><div class="eyebrow">SIX NEW PALETTES / S–X</div><h1>Color, in balance.</h1><p>S–X sit between the soft A–H palettes and the saturated I–R palettes: medium-strength fills, dark labels and the exact same light version 12 design. Expand the earlier palettes to compare any round.</p></div><div class="compare-grid">{pane('left', 's')}{pane('right', 't')}</div><p class="compare-note">Tell me the letter or name you prefer. Open a full-size preview to inspect the selection, empty chart, Dates view and component states.</p></main></body></html>'''
    (ROOT / 'compare-colors.html').write_text(compare, encoding='utf-8')

    visible, selected = [], []
    for side in ('left', 'right'):
        for t in THEMES:
            visible.append(f'#{side}-{t[0]}:checked~.compare-frames .frame-{t[0]}')
            selected.append(f'#{side}-{t[0]}:checked~.compare-options label[for={side}-{t[0]}]')
    (ROOT / 'color-comparison.css').write_text(','.join(visible) + '{display:block}\n' + ','.join(selected) + '{background:#edf1f6;color:#334c69;font-weight:600}\n', encoding='utf-8')

    # Make the new round discoverable from the existing collection, including rebuilds.
    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    banner = '<aside class="color-round"><div><span class="eyebrow">NEW / SIX BALANCED PALETTES</span><h2>A little color. The right balance.</h2><p>Six palettes between soft and saturated, twenty-four in total. The light backgrounds, layout, typography and components stay exactly the same.</p></div><a class="compare-button" href="colors.html">Explore all color themes <span>↗</span></a></aside>'
    if 'class="color-round"' in index:
        index = re.sub(r'<aside class="color-round">.*?</aside>', banner, index, flags=re.S)
    else:
        index = index.replace('<main>', '<main>' + banner, 1)
        index = index.replace('</head>', '<link rel="stylesheet" href="color-gallery.css"></head>')
    (ROOT / 'index.html').write_text(index, encoding='utf-8')
    print(f'Generated {COUNT} version 12 color themes, gallery, and comparison.')


if __name__ == '__main__':
    generate()
