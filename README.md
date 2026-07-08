# Finance projection

A tiny, dependency-free personal-finance projection you drive entirely from the URL.
Given your own figures it shows, in one monospace block:

- **Income** projected at your next few pay dates (a fortnightly inflow plus a monthly one on the 10th).
- A **30-day rolling** spend allowance (annual inflow − savings target, spread over 30 days).
- Offset-**mortgage payoff** time, assuming savings sweep into the offset each month.

It bakes in specific assumptions (Australian-style fortnightly pay, an offset mortgage, savings swept
into the offset), so it's most useful if your setup resembles that. It is **not** a general mortgage
calculator. Any section only appears if you supply its inputs, so a loan-only link works fine.

## Your numbers stay private

All values live in the URL **fragment** — the part after `#`. Browsers never transmit the fragment to a
server, so your figures never appear in this page, this repository, or any server/CDN log. Fill in the
builder on the page, bookmark the generated link, and open it whenever you want the numbers. Nothing is
stored server-side and there is nothing to sign in to.

## Usage

Open the page, expand **“What this is & how to use it”**, type your numbers, and bookmark the link it
builds. Or hand-write the fragment:

```
#loan=500000&offset=100000&rate=0.0575&pmt=3000&sav=20000&infl=0.02&sy=2026&sm=1
```

### Parameters

| Key | Meaning |
|-----|---------|
| `base` | Base annual income |
| `by`   | Base year (income anchor) |
| `om`   | Original monthly component |
| `mo`   | Current monthly component |
| `yr`   | Annual increment |
| `fort` | Fortnightly inflow |
| `sav`  | Annual savings target |
| `loan` | Loan balance (positive number) |
| `offset` | Offset balance |
| `pmt`  | Monthly payment |
| `rate` | Interest rate, APR as a decimal (e.g. `0.0541` = 5.41%) |
| `infl` | Annual inflation as a decimal (e.g. `0.02`) |
| `sy`   | Loan projection start year |
| `sm`   | Loan projection start month (`0` = January) |

Income needs `base, by, om, mo, yr`; the spend line needs `fort, sav`; the loan line needs
`rate, loan, pmt, sav, offset, infl, sy, sm`.

## Running locally

It's two static files (`index.html` + `calc.js`) with no build step and no dependencies. Because it uses
an ES module, open it through a web server rather than `file://`:

```
python -m http.server
# then visit http://localhost:8000/
```

Deployed via GitHub Pages; served straight from the repository root.
