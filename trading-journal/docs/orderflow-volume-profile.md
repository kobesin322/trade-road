# Order flow and volume profile

Strategy Lab builds **OHLCV-based** volume profiles and proxy CVD. This is research-grade Auction Market Theory tooling, not a tick footprint replacement.

## Modules

| Path | Role |
|------|------|
| `lib/orderflow/engine/*` | Pure calculation: histogram, VA, nodes, IB, sessions, incremental state |
| `lib/orderflow/computations.ts` | Bar delta, CVD, bounce strategy (existing) |
| `components/tools/volume-profile-panel.tsx` | Profile UI |
| `components/tools/orderflow-faq-modal.tsx` | In-app FAQ + SVG diagrams |

## Formulas (summary)

- **Histogram:** distribute each bar’s volume across price bins covering `[low, high]` (uniform or close-weighted).
- **POC:** max-volume bin (tie-break: nearest mid-range, then higher price).
- **Value area:** expand from POC until volume ≥ configured % (default 70%).
- **HVN / LVN:** local maxima / minima with sigma and prominence thresholds.
- **Initial balance:** high/low of first N minutes of the session slice.
- **Developing / session / composite / fixed range:** see FAQ modal in the app.

## Tests

```bash
npm test
```

Covers histogram totals, value area, fixed/developing/composite, IB window, and incremental rebuild parity.
