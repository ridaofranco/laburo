---
name: Tech-Noir Synthetic
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#c2c6d8'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#8c90a1'
  outline-variant: '#424655'
  surface-tint: '#b0c6ff'
  primary: '#b0c6ff'
  on-primary: '#002d6f'
  primary-container: '#568dff'
  on-primary-container: '#002661'
  inverse-primary: '#0058cb'
  secondary: '#c3c6d1'
  on-secondary: '#2d3039'
  secondary-container: '#454952'
  on-secondary-container: '#b5b8c3'
  tertiary: '#00dbe9'
  on-tertiary: '#00363a'
  tertiary-container: '#00a0aa'
  on-tertiary-container: '#002f33'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#00429c'
  secondary-fixed: '#e0e2ed'
  secondary-fixed-dim: '#c3c6d1'
  on-secondary-fixed: '#181c23'
  on-secondary-fixed-variant: '#43474f'
  tertiary-fixed: '#7df4ff'
  tertiary-fixed-dim: '#00dbe9'
  on-tertiary-fixed: '#002022'
  on-tertiary-fixed-variant: '#004f54'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  label-sm:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.1em
  button:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The brand personality is a sophisticated fusion of "Tech-Noir" and high-end digital craftsmanship. It targets a tech-savvy audience that values deep focus, futuristic aesthetics, and atmospheric immersion. The UI should evoke a sense of advanced intelligence, precision, and depth.

The design style is **Evolved Glassmorphism**. This system moves beyond simple transparency, utilizing extreme backdrop blurs (40px+), defined glass-etched borders, and subtle grain textures to simulate high-tech optical surfaces. The interface should feel like a physical "Light Interface" projected onto dark synthetic glass.

## Colors
The palette is rooted in the deep void of the night. 

- **Primary:** Electric Blue (#0070FF), used primarily for interactive elements and "glow" states.
- **Secondary (Base):** Deep Dark Navy (#05080F), serving as the infinite background.
- **Tertiary (Accent):** Cyan Glow (#00F0FF), used sparingly for high-alert data or status indicators.
- **Neutral:** Pure White and Cool Grays with high transparency for typography and borders.

The "Glow" effect is achieved by applying a 20-30px Gaussian blur to primary-colored shapes positioned behind glass layers.

## Typography
The system uses **Geist** for its technical precision and minimal footprint, ensuring the interface remains legible against complex background blurs. **Space Mono** is utilized for labels, metadata, and technical readouts to reinforce the "hacker-terminal" or "synthetic" aesthetic. 

Typography should often use varying levels of opacity (80% for primary body, 50% for secondary info) rather than gray hex codes to maintain the glass-integration effect.

## Layout & Spacing
The layout follows a **Fluid Grid** model with generous margins to allow the background light effects to breathe. Content is organized into modular "Glass Modules."

- **Desktop:** 12-column grid with 24px gutters.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px gutters.

The spacing rhythm is strictly based on 8px increments. Padding within glass cards should be generous (typically 32px or 40px) to prevent the "etched" borders from feeling crowded.

## Elevation & Depth
Depth is not created through traditional drop shadows, but through **Optical Stacking**:

1.  **Level 0 (Background):** Pure #05080F with subtle animated "blobs" of Electric Blue.
2.  **Level 1 (Base Cards):** Background Blur (40px) + 5% White Opacity Fill + 1px Inner Border (15% White).
3.  **Level 2 (Floating Elements):** Background Blur (64px) + 10% White Opacity Fill + 1px Outer Border (30% White) + Subtle 0 20px 40px rgba(0,0,0,0.5) shadow.
4.  **Overlays:** High-contrast borders and a subtle noise texture overlay (2% opacity) to prevent color banding in the gradients.

## Shapes
The shape language is controlled and geometric. We use **Rounded (Level 2)** settings for primary containers (12px - 16px radius). This provides a modern, high-tech feel without being too organic or "bubbly." 

Small interactive components like tags or status dots may use pill shapes (Level 3), but the structural layout remains strictly modular with consistent 16px corner radii for cards.

## Components
- **Buttons:** Primary buttons use a solid Electric Blue fill with a subtle outer glow (box-shadow: 0 0 15px rgba(0, 112, 255, 0.4)). Secondary buttons use the "Glass" style with a white 1px border at 20% opacity.
- **Input Fields:** Dark transparent backgrounds (3% white) with a 1px bottom border. On focus, the border glows Electric Blue.
- **Glass Cards:** The signature component. Must include `backdrop-filter: blur(40px)` and a linear-gradient border (top-left to bottom-right) from 20% white to 5% white.
- **Chips/Labels:** Small, all-caps Space Mono text. Backgrounds are high-transparency (10%) version of the primary color.
- **Glow-Lines:** Horizontal dividers should be 1px tall gradients that fade to 0% opacity at both ends, appearing like a beam of light.
- **Noise Overlay:** A global fixed `div` with a tileable noise texture set to `overlay` or `soft-light` at very low opacity to add grain to the glass.