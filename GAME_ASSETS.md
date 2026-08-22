# RINGWERK game assets

All five source raster assets were generated with the built-in `image_gen` mode. No CLI/API fallback was used. The shipped files under `public/` are compact WebP derivatives resized from those imagegen originals for web delivery; the large PNG working copies were removed from `public/` after conversion and QA. The original imagegen renders remain in Codex's generated-image store.

## Shared art direction

- Camera: orthographic top-down game view.
- Tone: premium, energetic arcade sci-fi; mature rather than childish.
- Palette: near-black/deep blue-green environment, turquoise machinery, coral-orange player, acid-yellow signals, bright-red threats.
- Readability: bold low-frequency silhouettes, clean transparent padding around sprites, no baked UI.
- Text policy: no text on gameplay assets; `public/og.webp` contains exactly `RINGWERK` and `DEUTSCH UNTER DRUCK`.

## Final files and QA

| Path | Size | Bytes | Color / alpha | Intended use |
| --- | ---: | ---: | --- | --- |
| `public/game-assets/arena-floor.webp` | 768 x 512 | 31,552 | RGB, opaque | Wide arena floor / void backdrop beneath code-rendered rings |
| `public/game-assets/player-core.webp` | 256 x 234 | 19,154 | RGBA, transparent corners | Coral player runner-drone, facing upper-right |
| `public/game-assets/terminal-core.webp` | 256 x 242 | 24,794 | RGBA, transparent corners | Neutral terminal body; draw A/B/C in code over the pale cyan core |
| `public/game-assets/hazard-core.webp` | 256 x 234 | 27,780 | RGBA, transparent corners | Fixed red cutter / energy-emitter hazard |
| `public/og.webp` | 768 x 512 | 34,376 | RGB, opaque | Bespoke social sharing card |

Visual QA was performed on the final WebP files at their shipped dimensions with `view_image`. Decode metadata and corner-alpha checks confirm that the three sprite files carry a genuine alpha channel; all four corner samples are alpha `0`. The arena and social card are intentionally opaque. Every shipped asset is below 35,000 bytes except none: all five meet the preferred threshold as well as the 55 KB hard maximum.

## Final prompt specs

### Arena floor

```text
Use case: stylized-concept
Asset type: wide 2D game environment background texture
Primary request: create a premium, energetic top-down industrial floor and void background for a fast arcade learning game called RINGWERK; this is only the environmental backdrop underneath a code-rendered circular mechanism
Scene/backdrop: dark subterranean machine chamber floor fading into a deep near-black blue-green void at the outer edges; restrained radial wear, recessed service plates, a few broad structural seams, subtle grime, faint turquoise conduit glow and sparse acid-yellow warning light reflections
Subject: environmental floor only, no gameplay objects
Style/medium: polished hand-painted 2D game art with crisp stylized materials, subtle 3D depth, arcade readability, mature European sci-fi industrial design, premium rather than childish
Composition/framing: wide landscape canvas, strict orthographic top-down view, visually quiet center and middle area so three code-rendered concentric rings remain readable; broad low-frequency texture, balanced asymmetry, seamless-looking edges
Lighting/mood: moody controlled ambient light, dark but readable, cool teal machinery glow with very sparse warm warning accents
Color palette: near-black and deep blue-green base, desaturated teal metal, subtle cyan glow, tiny acid-yellow accents; no coral player color and no bright red hazard color
Materials/textures: worn painted steel, dark rubberized deck, recessed bolts and service seams, fine dust and oil scuffs, no photoreal clutter
Text: none
Constraints: background only; no rings, no circles that resemble gameplay lanes, no characters, no terminals, no hazards, no saws, no fire, no lasers, no UI, no text, no letters, no logo, no watermark; keep contrast low enough for bright gameplay sprites; polished production-ready game asset
```

### Player core

```text
Use case: stylized-concept
Asset type: transparent 2D game player sprite
Primary request: a compact top-down runner-drone for a fast arcade learning game in a rotating industrial ring machine; it is the player avatar and must read instantly at 48 to 80 pixels
Scene/backdrop: genuinely transparent background
Subject: one compact agile mechanical runner drone, wedge-shaped forward nose, two swept stabilizer fins, protected bright core, subtly humanoid motion character without being a person; facing diagonally toward the upper-right at about 30 degrees
Style/medium: premium hand-painted 2D game sprite with crisp stylized 3D materials, mature sci-fi arcade design, strong graphic silhouette, clean production asset
Composition/framing: strict orthographic top-down view, centered single object, generous even transparent padding, no parts cropped, directional silhouette clearly points upper-right
Lighting/mood: punchy controlled rim light, energetic but readable
Color palette: dominant coral orange and warm vermilion shell, small ivory highlights, tiny acid-yellow energy detail, restrained dark teal mechanical joints; strong contrast
Materials/textures: painted metal shell, dark rubber joints, emissive glass core, clean edge highlights
Text: none
Constraints: actual transparent alpha background; exactly one isolated sprite; no ground plane, no floor, no cast shadow, no circular badge, no border, no glow cloud, no exhaust trail, no text, no letters, no logo, no watermark; avoid thin fragile appendages; silhouette must remain clear when scaled down
```

### Terminal core

```text
Use case: stylized-concept
Asset type: transparent 2D game interactive terminal sprite
Primary request: a stationary top-down sci-fi terminal node used as one of three selectable A/B/C stations in a rotating industrial mechanism; code will draw the letter separately, so the image must be neutral and letter-free
Scene/backdrop: genuinely transparent background
Subject: one compact hexagonal terminal pedestal with three sturdy contact feet, a large neutral luminous central core/recess intentionally left clear for an overlaid code-rendered letter, subtle cable sockets and small status lamps
Style/medium: premium hand-painted 2D game sprite with crisp stylized 3D materials, mature industrial sci-fi arcade design, strong graphic silhouette, clean production asset
Composition/framing: strict orthographic top-down view, centered single object, generous even transparent padding, no parts cropped, near-radial silhouette but with a clear front notch
Lighting/mood: controlled cyan/teal machinery glow, inviting and legible rather than dangerous
Color palette: dark blue-green casing, teal metal edges, neutral pale cyan core, tiny acid-yellow ready indicators; absolutely no bright red
Materials/textures: worn powder-coated metal, brushed steel edge caps, translucent emissive glass
Text: none
Constraints: actual transparent alpha background; exactly one isolated sprite; central core must contain no symbol, letter, number, glyph or UI; no ground plane, no floor, no cast shadow, no circular badge, no border, no text, no logos, no watermark; silhouette must remain clear at 56 to 96 pixels
```

### Hazard core

```text
Use case: stylized-concept
Asset type: transparent 2D game hazard sprite
Primary request: a fixed stationary mechanical cutter fused with a short-range energy emitter for a fast top-down arcade game; it stays anchored in world coordinates while rings rotate beneath it and must read instantly as lethal
Scene/backdrop: genuinely transparent background
Subject: exactly one squat industrial hazard unit: heavy triangular anchor base, one large exposed serrated cutter wheel integrated into the front, compact red energy aperture behind it, two robust warning fins; no separate projectiles
Style/medium: premium hand-painted 2D game sprite with crisp stylized 3D materials, mature industrial sci-fi arcade design, aggressive strong silhouette, clean production asset
Composition/framing: strict orthographic top-down view, centered single object, generous even transparent padding, no parts cropped; hazard faces toward the upper-right
Lighting/mood: sharp alarming red emissive highlights, dangerous and high-energy, still readable
Color palette: gunmetal and near-black body, bright threat red and hot scarlet core, sparse acid-yellow chevrons, restrained teal reflected edge light
Materials/textures: hardened steel, worn safety paint, heat-scorched metal, emissive red glass
Text: none
Constraints: actual transparent alpha background; exactly one isolated hazard; no ground plane, no floor, no cast shadow, no circular badge, no border, no separate flames, no laser beam extending outside the unit, no blood, no text, no letters, no logo, no watermark; avoid tiny fragile details; silhouette must remain clear at 56 to 96 pixels
```

### Social sharing card

```text
Use case: ads-marketing
Asset type: bespoke social sharing card for the finished 2D arcade game
Primary request: cinematic key art for RINGWERK, a fast top-down arcade learning game set inside a circular industrial mechanism with three counter-rotating concentric rings, a coral-orange runner drone, fixed red mechanical hazards, and three cyan terminal nodes
Scene/backdrop: deep near-black blue-green machine chamber viewed from directly overhead; a large circular ring mechanism dominates the frame, with controlled sparks and motion streaks that imply speed without obscuring gameplay shapes
Subject: three concentric teal mechanical rings rotating in alternating directions; small but clearly visible coral-orange player drone threading between fixed bright-red cutter hazards; three neutral cyan terminal nodes; premium arcade tension
Style/medium: polished cinematic 2D game key art, crisp stylized realism, mature premium sci-fi arcade aesthetic, bold and highly readable at thumbnail size, not childish
Composition/framing: 3:2 landscape social card; ring mechanism fills the right and lower areas; title block in the upper-left with generous dark negative space; clear hierarchy; no UI frame
Lighting/mood: electric, urgent and exhilarating; teal machinery glow, hot coral player highlight, acid-yellow signals and red threat lights; controlled bloom
Color palette: near-black/deep blue-green, luminous turquoise mechanisms, coral-orange player, acid-yellow signals, bright red threats, warm ivory title
Materials/textures: worn painted steel, brushed metal, emissive glass, subtle sparks and heat scuffs
Text (verbatim): "RINGWERK" and "DEUTSCH UNTER DRUCK"
Typography: render RINGWERK exactly once in large bold condensed uppercase industrial sans serif; spell R-I-N-G-W-E-R-K exactly; render DEUTSCH UNTER DRUCK exactly once beneath it in smaller tracked uppercase sans serif; spell D-E-U-T-S-C-H space U-N-T-E-R space D-R-U-C-K exactly; clean straight baseline, high contrast, no distorted letters
Constraints: include exactly and only those two text lines; no other words, letters, numbers, labels, badges, logos, trademarks, or watermark; title must be fully legible and not overlap the machine; strict top-down game-world perspective; premium finished-game social art
```

## Integration notes

- Preserve each sprite's native aspect ratio and use `object-fit: contain` or the canvas equivalent.
- Draw terminal labels A/B/C in code over the clear center; the asset intentionally contains no glyph.
- Keep the arena floor behind all procedural rings and gameplay elements.
- The sprite canvases include transparent breathing room; collision geometry should be authored from game logic rather than the full image bounds.
