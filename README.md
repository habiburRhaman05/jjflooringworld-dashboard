# J&J Flooring World: team workspace

No backend, no build step, no npm. Open `index.html` directly in a browser.

The shell is modelled on GoHighLevel's own frame so the tool reads as native
when it is embedded as a GHL custom page: a white top bar carrying the logo,
the page actions and the signed-in user, a horizontal tab strip for the
destinations, and a neutral canvas holding white cards. Brand blue stays a
soft tint on the active tab and a fill on primary buttons, so the pages read
white instead of turning into a wall of brand colour.

## Run it

Double-click `index.html`. Chrome and Firefox keep the data across page loads from
`file://`. Safari blocks storage on local files, so the app falls back to a
per-tab store and the demo still works inside one tab. Serving the folder over
any static server (`python -m http.server`) removes that caveat entirely.

## Brand system

The palette is extracted from the live marketing site, not invented. The site
ships its design tokens as OKLCH custom properties; these are those tokens
converted to sRGB.

| Token | Source (site) | Hex | Where it is used |
|---|---|---|---|
| Navy | `--primary` oklch(22% .071 251) | `#001B3A` | sign-in panel, toasts |
| Brand blue | `--brand-blue` oklch(57% .22 255) | `#0071F4` | primary buttons, active nav, links, focus |
| Bright blue | `--brand-bright` oklch(66% .2 252) | `#0093FF` | active nav gradient, hover |
| Soft gold | `--brand-gold-soft` oklch(91% .055 78) | `#F6DEB9` | sign-in tagline, warm tints |
| Oak | `--wood` oklch(70% .11 69) | `#CB914D` | secondary accent, Better tier marker |
| Ink | `--foreground` oklch(21% .05 251) | `#05192E` | body text |

Surfaces deliberately stay neutral so the workspace matches GHL: canvas
`#F4F5F7`, and `#FFFFFF` for cards, the top bar and the tab strip, with
`#E5E8EE` hairlines. Brand blue is the only strong accent, and it is applied
as a tint rather than a block: the active tab is `#E8F1FE` under `#0059C8`
text with a 2px blue underline, and anything merely selected gets the same
tint. A solid blue fill is reserved for a primary button. Warm cream and gold
survive as a secondary accent so the product still reads as J&J.

**Typography**: the app runs entirely on Manrope, the same UI sans the live
site uses, because that is what makes it read as a product rather than a
website. Libre Baskerville is kept for the sign-in heading and Caveat for the
e-signature input.

The brand aliases from the earlier pass (`--walnut`, `--oak`) are gone; every
component and every inline style in `js/` now names the real token.

The Admin **Products** catalog is seeded from the product lines the company
actually sells, so a rep quoting a job picks from the same list a customer
sees on the site: carpet, carpet tile, hardwood and hardwood refinishing,
luxury vinyl plank, laminate, sheet vinyl and vinyl tile, plus the job lines
every install carries (demolition and prep, transitions, trim, labour).

Logo assets in `assets/` are the client's own, pulled from the site:
`jj-logo.png` (mascot plus wordmark) and `jj-mascot.webp` (square mascot, used
as the favicon and as the collapsed rail mark).

## Commission and earnings

Commission is derived, never stored on a line, and it resolves through three
levels:

1. the product's own rate, when the product carries one
2. the rep's rate
3. the company default

Admin gets two pages for it. **Commission** is where rates are set: the company
default, each rep's base rate, and every product carrying a rate of its own.
**Earnings** is the report: revenue, cost, gross margin, commission paid and
net, broken out per product and per rep, with a totals row.

A product's commission is set on the product itself, in **Products**, including
when the product is first created. Leaving that field blank is meaningful: the
line pays the rep's rate instead, which is not the same as a rate of zero.

Every commission figure in the app goes through `DB.invoiceCommission()`, so the
number a rep sees on their own Commission page is the same number the office
sees on the earnings report. The rep's page also shows their blended rate, which
is what they actually averaged once product rates were applied.

## Layout notes

- Destinations live in the tab strip, the same pattern GHL uses for a module's
  sub navigation: a bordered pill of tabs with a bold module label at the left
  and a blue underline on the tab you are standing on.
- The strip scrolls sideways rather than collapsing, so every destination
  stays one tap away on a phone. Below 560px the bold module label drops out
  and the tabs take the width instead.
- The top bar carries the logo, where you are, the page's own actions, the
  demo Switch Role control and the signed-in user's avatar.

## Demo path (all four roles, in order)

1. **CSR**: create a lead, log outreach, book an appointment.
2. **Sales Rep**: open that lead, build an estimate (Good / Better / Best),
   Send, then Open sign sheet, pick a tier, type a name, Sign.
   A job and an invoice are created automatically and the lead moves to Won.
3. **Admin**: Jobs and Invoices, Manage, assign an installer and a date.
4. **Installer**: open the job, confirm materials, add a photo,
   En Route, In Progress, Completed.
5. **Admin**: Mark Paid, then check Sync and Settings for the full event log.

`Reset demo data` lives in Admin, Sync and Settings, and on the sign-in screen.

## Files

```
index.html        branded sign-in and role picker (four buttons, no password)
admin.html        dashboard, pipeline, jobs, products, commission, earnings, team, sync
sales-rep.html    own pipeline, estimator, e-sign, commission
csr.html          intake board, notes, appointments
installer.html    mobile-first job cards, status flow, bottom tab bar
assets/           client logo and mascot
css/base.css        brand tokens, reset, typography
css/components.css  buttons, cards, pills, tables, kanban, modal, toast, states
css/layout.css      shell: top bar, tab strip, login, installer nav
js/data.js        storage adapter, schema, seed data, resetDemoData()
js/auth.js        role session, page guard, top bar chrome
js/ui.js          toasts, modals, formatting helpers, tab and breadcrumb wiring
js/pipeline.js    kanban, funnel, job stage rail
js/estimator.js   product picker, tier builder, e-signature
js/invoice.js     invoice rendering, payment state
js/dashboard.js   Admin reporting and management
js/installer.js   installer job list and sequential status flow
js/ghlSync.js     GoHighLevel stub
```

## Responsive behaviour

- **Every width**: one column of content, capped at 1440px and centred. The
  tab strip scrolls sideways when the destinations do not fit on one line.
- **Installer** never gets a tab strip. It keeps a full-width bottom tab bar on
  phones, which becomes a centred floating dock from 768px up.

## Connecting the real GHL integration

Everything funnels through `js/ghlSync.js`. Replace the body of `transport()`
with the real v2 API call (the fetch skeleton is written out in the file's
header comment). No caller changes: `DB` already fires `GHLSync.out(...)` on
lead creation, stage changes, estimate sent and signed, job creation,
assignment, materials, photos, job stage changes and payment status.

## Permissions

Cost, margin and commission are gated at the render layer, not with CSS.
`Auth.can.viewCost()` is checked before the nodes are built, so in a Sales Rep,
CSR or Installer session those values never enter the DOM. Inspecting the
rendered page in dev tools turns up nothing to unhide.

## Known demo simplifications

- The deposit is recorded as paid at signature. A real build waits on a payment
  webhook from GHL.
- Photos store a label and a filename, no file upload.
- Switch Role in the top bar is a demo affordance and would not ship.
- The top bar avatar shows the signed-in user. In a real GHL embed it would
  show the location/sub-account, the way the GHL frame already does.
