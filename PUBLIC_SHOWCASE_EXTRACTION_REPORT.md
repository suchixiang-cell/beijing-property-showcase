# Public Showcase Extraction Report

## Result

The Beijing property showcase has been extracted into a standalone, public-safe local repository. It has not been connected to GitHub or published.

## Source and extraction method

- Reviewed showcase source commit: `05aa8c1df16a16908626d4dddf456b65361ddc7f`
- Extraction method: explicit allowlist into an empty directory
- Git history: independent repository with a new root history
- Business repository history and Git metadata: not copied

Only the fictional dataset, static entry, read-only display modules, focused tests, and build/audit configuration were selected. Backend, authentication, database, import, address-search, lifecycle, and internal-report source were not extracted.

## Dependencies

- Production dependency: `maplibre-gl` `6.4.1`
- Development dependency: `vite` `7.3.6`
- Fresh lockfile: generated from the minimal manifest
- Fresh install: PASS
- `npm audit`: 0 vulnerabilities

## Data boundary

- Records: 10
- Located synthetic points: 8
- Unlocated records: 2
- District coverage: 6 districts
- Property types: residential, office, commercial, parking, and warehouse
- Property codes: demo-only format
- Names, ownership entities, personnel, addresses, and coordinates: fictional or synthetic
- Real property and personal data: not included

## Static architecture

The application runs without a backend, database, authentication, session, or writable business state. It provides summary metrics, local search, filters, property list, MapLibre map, synthetic markers, unlocated-record handling, read-only details, and mobile map/list behavior.

There is no history router. Details remain in panel state and require no static-host rewrite rules.

## Build and base path

- Local root-path build: PASS
- Future Pages base: `/beijing-property-showcase/`
- Pages-base production build: PASS
- JavaScript/CSS asset resolution: PASS
- MapLibre Worker resolution: PASS
- Sourcemaps: disabled

## Validation

- Focused showcase tests: 15/15 PASS
- Browser assertions: 30/30 PASS
- Viewports: 375×812, 389×812, 400×608, 1366×768, 1440×1000 PASS
- Horizontal overflow: none detected
- Search, filters, map/list, located/unlocated handling, and read-only detail: PASS
- Writable/admin controls: absent
- Approved public wording: present

## Security and network audit

- Source-tree allowlist and sensitive-value scan: PASS
- Complete `dist/` scan: PASS
- Backend or `/api` requests: 0
- Search V2 requests: 0
- TianDiTu requests without a showcase key: 0
- Other external requests in keyless validation: 0
- Fallback map presentation: PASS
- Unapproved external hosts: none requested

MapLibre's compiled library contains inert project/documentation URL strings; the browser network audit confirmed that they did not generate requests.

## TianDiTu publication contract

No live TianDiTu key is configured or included. A future public deployment may use only a separately issued browser showcase key through `VITE_TIANDITU_SHOWCASE_KEY`, restricted to `<github-account>.github.io` and limited to the required vector-map and annotation services. Search V2 remains disabled.

## Publication status

- Git remote: none
- GitHub repository: not created
- GitHub Pages workflow: not created
- GitHub Pages: not enabled
- Deployment: not performed
- License: not yet specified

Publication remains subject to a separate approval gate.
