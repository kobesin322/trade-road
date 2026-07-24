# Order flow and volume profile

Strategy Lab builds **OHLCV-based** volume profiles, proxy CVD, and a proxy footprint/Bookmap view. This is research-grade Auction Market Theory tooling, not a tick footprint or MBO replacement.

## Modules

| Path | Role |
|------|------|
| `lib/orderflow/engine/*` | Pure calculation: histogram, VA, nodes, IB, sessions, incremental state |
| `lib/orderflow/computations.ts` | Bar delta, CVD, bounce strategy (existing) |
| `lib/orderflow/footprint.ts` | Proxy footprint, residual heat trails, aggression tiers, trapped liquidity |
| `components/tools/volume-profile-panel.tsx` | Profile UI |
| `components/charts/footprint-bookmap-chart.tsx` | DeepChart/Bookmap canvas: heat + bubbles + trap diamonds |
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
