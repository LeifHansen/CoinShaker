# DittoCoin Brand Guide

Shared visual identity for **dittocoin.com** (coin site) and **mixer.dittocoin.com** (DittoMixer).

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Purple 900 (Background) | `#1a0a2e` | Main background, darkest shade |
| Purple 800 | `#2d1052` | Card backgrounds, secondary surfaces |
| Purple 700 | `#0d0d2b` | Gradient endpoint |
| Purple 600 (Accent) | `#7b2fbe` | Accent purple, staking tier highlights |
| Teal (Primary) | `#1ac8b0` | Primary action color, CTAs, active states |
| Pink (Secondary) | `#d64b8a` | Secondary accent, warnings, burn indicators |
| Amber | `#f59e0b` | Rewards, earnings displays |

### Background Gradient
```css
background: linear-gradient(to right bottom, #1a0a2e, #2d1052, #0d0d2b);
```

### Glass Card Style
```css
background: rgba(45, 16, 82, 0.3);
backdrop-filter: blur(12px);
border: 1px solid rgba(123, 47, 190, 0.2);
```

---

## Typography

| Role | Font | Weight |
|------|------|--------|
| Display / Headings | Space Grotesk | 600–700 |
| Body / UI | Inter | 300–700 |
| Monospace / Numbers | System mono | — |

Google Fonts import:
```
Inter:wght@300;400;500;600;700;800;900
Space Grotesk:wght@400;500;600;700
```

---

## Logo Usage

- **Primary**: `logo.png` (512×512, transparent PNG)
- **Favicon**: `favicon.png` (32×32)
- **Mobile/PWA**: `logo-192.png` (192×192)
- **Social**: `og-image.png` (1200×630)

The logo features a coin shape with teal-to-purple gradient ring, bold "D" monogram in teal, three flame dots (pink–teal–pink) representing the burn mechanism, and "$DITTO" text.

---

## Naming Convention

- Token name: **DittoCoin**
- Ticker: **$DITTO**
- Stylized: Ditto**Coin** (second word in teal)
- Tagline: "The Memecoin That Burns Brighter"

---

## Component Patterns

### Buttons
- **Primary**: `bg-gradient-to-r from-ditto-teal to-emerald-400` with `text-ditto-purple-900`
- **Secondary**: `bg-white/5 border border-white/10` with `text-white/60`
- **Hover shine**: `.btn-shine` class with sweep animation

### Cards
- Use `.glass-card` with hover border color transition to teal
- Glow variants: `.glow-teal`, `.glow-pink`, `.glow-purple`

### Text Hierarchy
- Headings: white
- Body: `text-white/60`
- Muted: `text-white/40`
- Subtle: `text-white/20`

---

## Tailwind Config (for mixer)

```js
colors: {
  ditto: {
    purple: {
      900: "#1a0a2e",
      800: "#2d1052",
      700: "#0d0d2b",
      600: "#7b2fbe",
    },
    teal: { DEFAULT: "#1ac8b0", light: "#21cab9" },
    pink: { DEFAULT: "#d64b8a" },
    amber: "#f59e0b",
  },
}
```

---

## Assets Location

Copy `logo.png`, `favicon.png`, `logo-192.png`, and `og-image.png` from this repo's root into the mixer's `client/public/` directory to maintain visual consistency across both sites.
