---
name: Radical Minimalist
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#cfc4c5'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#988e90'
  outline-variant: '#4c4546'
  surface-tint: '#c6c6c6'
  primary: '#c6c6c6'
  on-primary: '#303030'
  primary-container: '#000000'
  on-primary-container: '#757575'
  inverse-primary: '#5e5e5e'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#b9c3ff'
  on-tertiary: '#00228a'
  tertiary-container: '#000000'
  on-tertiary-container: '#4266ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#dde1ff'
  tertiary-fixed-dim: '#b9c3ff'
  on-tertiary-fixed: '#001257'
  on-tertiary-fixed-variant: '#0033c0'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-xl:
    fontFamily: Syne
    fontSize: 120px
    fontWeight: '800'
    lineHeight: 110%
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Syne
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 110%
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Syne
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 110%
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Syne
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 120%
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 160%
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 160%
    letterSpacing: 0em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 140%
    letterSpacing: 0.1em
spacing:
  container-max: 1440px
  gutter: 32px
  margin-desktop: 80px
  margin-mobile: 24px
  section-gap: 160px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
This design system embodies an architectural, ultra-premium aesthetic defined by structural rigor and expansive negative space. It is designed for high-end digital experiences where the content is treated as a gallery exhibit. The personality is disciplined, sophisticated, and authoritative.

The style is **Radical Minimalism** mixed with **Modern Corporate** precision. It avoids all decorative flourishes, relying instead on "monumental" typography and a strict adherence to a mathematical grid. The emotional response should be one of calm, clarity, and uncompromised quality.

## Colors
The palette is rooted in a "Black Absolute" philosophy. The primary surface is always pure black (#000000) to create infinite depth. Text and core UI elements utilize "Off-White" (#F5F5F5) to reduce eye strain while maintaining maximum contrast.

An "Electric Blue" (#0047FF) is used with extreme restraint—only for critical interaction points, active states, or subtle data indicators. Neutral tones are used exclusively for subtle structural dividers and secondary containers to maintain the hierarchy of the void.

## Typography
Typography is the primary visual driver of this design system.
- **Headlines:** We use `Syne` for its "Extended" and monumental feel. It should be set with tight letter-spacing to create a block-like, architectural impact.
- **Body:** `Inter` provides a neutral, systematic counterpoint to the expressive headlines, ensuring high legibility in dense information blocks.
- **Labels/Technical:** `Geist` is used for UI labels, buttons, and data, providing a developer-focused, precise aesthetic. These are often set in uppercase with increased letter spacing for a "technical luxury" look.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop and a **Fluid Grid** on mobile. 
- **The 12-Column Grid:** All elements must align to a strict 12-column grid. 
- **Massive White Space:** Section vertical spacing (`section-gap`) is intentionally oversized to force the user to focus on one concept at a time.
- **Margins:** Generous outer margins create a "frame" effect, emphasizing the premium nature of the content.
- **Reflow:** On mobile, columns collapse to a single stack, but the 24px horizontal margin remains sacred to preserve the "framed" aesthetic.

## Elevation & Depth
In this design system, depth is achieved through **Tonal Layering** and **Low-Contrast Outlines**, never through heavy shadows.

- **Level 0 (Surface):** Pure Black (#000000).
- **Level 1 (Containers):** Very Dark Grey (#0A0A0A) with a 1px solid border (#1A1A1A).
- **Interactions:** Subtle backdrop blurs (10px - 20px) are permitted only for navigation bars or overlays to maintain a sense of glass-like transparency without breaking the minimalist aesthetic.
- **Borders:** Lines should be "hairline" (0.5pt or 1px) to mimic architectural blueprints.

## Shapes
The shape language is strictly **Sharp**. 
- All buttons, input fields, and card containers must have 0px border radius.
- The use of hard 90-degree angles reinforces the architectural and sober tone of the design system. 
- Circular elements are only permitted for specific functional icons (e.g., radio buttons) or profile avatars.

## Components
- **Buttons:** Primary buttons are solid #F5F5F5 with #000000 text. Hover states should trigger a "ghost" effect (transparent background with #F5F5F5 border). Transitions must be instant or very fast (150ms).
- **Input Fields:** Bottom-border only, or a full thin border. Text should be #F5F5F5, with labels using the `label-sm` style positioned above the field.
- **Cards:** No shadows. Use a 1px border (#1A1A1A). On hover, the border color may shift to the Electric Blue accent.
- **Lists:** Separated by 1px horizontal rules. Large padding (24px - 32px) between items to maintain the "Massive Space" narrative.
- **Navigation:** Minimalist text-only links in `label-sm`. The active state is indicated by a 2px Electric Blue underline or a simple dot.
- **Cursors:** Custom circular "dot" cursors or large "view" tags are recommended for high-end gallery interactions.