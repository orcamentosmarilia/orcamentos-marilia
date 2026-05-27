# Design System Document: High-End Editorial Catering Management

## 1. Overview & Creative North Star
The visual identity of this design system is anchored in a concept we call **"The Editorial Concierge."** We are moving away from the "SaaS dashboard" aesthetic—characterized by cold blues and rigid grids—and moving toward the warmth of a high-end lifestyle magazine or a bespoke invitation.

This design system prioritizes **Atmospheric Depth** over structural rigidity. By leveraging a palette of creams, wines, and soft clays, we create an environment that feels premium, tactile, and intentional. We challenge the standard grid by using generous white space (luxury) and serif-driven typography (authority) to guide the user through complex catering logistics with a sense of calm and sophistication.

---

## 2. Colors & Tonal Architecture
The palette is designed to evoke the sensory experience of a coffee break: the warmth of steamed milk, the richness of dark cherries, and the precision of silver service.

### Color Roles
*   **Primary (`#D14237`):** Use for high-impact actions. It represents the "Heat" and energy of the kitchen.
*   **Secondary/Sidebar (`#5C1F2E`):** A deep wine that acts as our "Anchor." It provides the authoritative weight needed for navigation and headers.
*   **Surface/Background (`#FDF6F2`):** A soft cream that prevents the "digital eye strain" associated with pure white, making the interface feel like fine stationery.
*   **Section Fills (`#FAE8E6`):** A delicate pink used for secondary grouping and alternating table rows.

### The "No-Line" Rule
To maintain a high-end feel, **1px solid borders are strictly prohibited for sectioning.** 
*   Boundaries must be defined through **Background Color Shifts**. For example, a `surface-container-low` (`#FDF6F2`) section sitting on a `surface` background, or a white card (`#FFFFFF`) against a cream backdrop.
*   The only exception is the "Ghost Border": if an edge must be defined for accessibility, use the `outline-variant` (`#F5D8D5`) at **20% opacity**.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of paper and glass:
1.  **Level 0 (Base):** `surface` (`#FDF6F2`) — The tabletop.
2.  **Level 1 (Sectioning):** `surface-container` (`#FAE8E6`) — Defined zones.
3.  **Level 2 (Interaction):** `surface-container-lowest` (`#FFFFFF`) — The cards/plates where data sits.

### Signature Textures
Main CTAs should not be flat. Apply a subtle linear gradient from `primary` (`#D14237`) to `primary-container` (`#E8635A`) at 135 degrees. This adds a "silk" finish that flat hex codes cannot replicate.

---

## 3. Typography
Our typography is a conversation between **The Artisan** (Dancing Script), **The Editor** (Lora), and **The Architect** (DM Sans).

*   **The Artisan (Logo):** `Dancing Script 700`. Used exclusively for the brand mark to signify a personal, handcrafted touch.
*   **The Editor (Titles & Metrics):** `Lora (400/600/700)`. High-contrast serifs used for page titles, section headers, and "Hero Numbers" (e.g., Total Revenue, Guest Count). This brings a prestigious, editorial feel to raw data.
*   **The Architect (Interface):** `DM Sans (300/400/500/600)`. A clean, geometric sans-serif for buttons, labels, and body text. It ensures maximum legibility and professional rigor.

**Scale Highlight:** 
*   **Display-LG:** Lora 400 | 3.5rem | Tracking -2%.
*   **Label-MD:** DM Sans 600 | 0.75rem | Uppercase | Tracking 5% (Used for status badges and small caps headers).

---

## 4. Elevation & Depth
In this design system, depth is achieved through **Tonal Layering** rather than heavy shadows.

*   **The Layering Principle:** Instead of a shadow, place a `#FFFFFF` card on a `#FDF6F2` background. The subtle 4% difference in luminance creates a sophisticated "natural lift."
*   **Ambient Shadows:** For floating elements (Modals, Dropdowns), use a shadow with a 24px blur and 4% opacity. The shadow color must be tinted with the "Wine" token (`#5C1F2E`) rather than black. This keeps the shadow "warm" and integrated into the cream environment.
*   **Glassmorphism:** For the 220px Sidebar or floating navigation bars, use the `surface` color at 85% opacity with a `backdrop-filter: blur(12px)`. This makes the interface feel light and modern, allowing the colors of the content to bleed through softly.

---

## 5. Components

### Buttons
*   **Primary:** 10px radius. Gradient fill (`#D14237` to `#E8635A`). White text. 
*   **Secondary:** 10px radius. Ghost style. `outline-variant` border at 40% opacity. Text in `primary`.
*   **Tertiary:** No border or fill. Bold DM Sans text in `secondary` (`#5C1F2E`) with a bottom-aligned dot indicator on hover.

### Cards & Lists
*   **Cards:** 16px border-radius. No borders. Use `surface-container-lowest` (`#FFFFFF`) and a soft ambient shadow.
*   **Lists:** Forbid divider lines. Separate items using 8px of vertical whitespace or a subtle hover shift to `surface-container-low`.
*   **Tables:** Header background in `secondary` (`#5C1F2E`) with white text. Body rows must alternate between `#FFFFFF` and `#FAE8E6`.

### Input Fields
*   **Styling:** 8px radius. Background in `surface-container-low`.
*   **Placeholder:** `gray-lt` (`#C4ABA8`).
*   **Focus State:** A 2px "Ghost Border" of `primary` at 50% opacity. No "glow" effects.

### Status Badges
*   **General:** Use `wine2` (`#3D1320`) for text on a `pink` (`#FAE8E6`) background.
*   **Specific Green:** Only for "Confirmed" or "Paid" statuses. Use a muted Sage Green—never neon.

---

## 6. Do's and Don'ts

### Do
*   **DO** use Lora for any number that represents a key performance indicator (KPI).
*   **DO** prioritize whitespace. If a screen feels "busy," increase the padding between sections rather than adding a divider line.
*   **DO** use asymmetrical layouts for dashboard summaries to evoke a "magazine spread" feel.

### Don't
*   **DON'T** use blue, yellow, or standard "Success Green" except where strictly defined.
*   **DON'T** use 100% black text. Always use `body-text` (`#6B5C5A`) or `secondary` (`#5C1F2E`) for a softer, premium look.
*   **DON'T** use sharp 0px corners. Everything in this system should feel approachable and soft, mirroring the hospitality industry.
*   **DON'T** use standard "drop shadows." If the element doesn't feel like it's lifting off the page naturally through color, your shadow is too heavy.
