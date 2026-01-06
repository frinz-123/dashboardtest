# A4 Print Guide (Clientes Desatendidos)

This project prints the "Clientes Desatendidos" list to A4 using native
browser printing (no PDF library). The approach is portable to any React
app and works with "Print to PDF" from the browser dialog.

## Summary of the implementation

- A hidden print container is injected into `document.body`.
- The print content is rendered into that container via `createPortal`.
- A print button toggles a `print-mode` class on `body` and calls
  `window.print()`.
- `@media print` CSS hides the app UI and shows only the print container.
- The print layout is a table sized for A4 with clean spacing and
  page-break handling.

Files involved:
- `src/app/clientes/page.tsx`
- `src/app/globals.css`

## How it works

### 1) Print container + portal
The `ClientesDesatendidos` component creates a `div.print-root` on mount and
uses `createPortal` to render the print layout into it.

Key idea:
- The print layout is not part of the regular UI tree, so we can hide the UI
  and show only the print layout during printing.

Example (simplified):

```tsx
const [printContainer, setPrintContainer] = useState<HTMLDivElement | null>(null);

useEffect(() => {
  const container = document.createElement("div");
  container.className = "print-root";
  document.body.appendChild(container);
  setPrintContainer(container);
  return () => document.body.removeChild(container);
}, []);

return (
  <>
    {/* normal UI */}
    {printContainer ? createPortal(printContent, printContainer) : null}
  </>
);
```

### 2) Print trigger
The print button adds a class to `body` and calls `window.print()`:

```tsx
const handlePrint = () => {
  document.body.classList.add("print-mode");
  setTimeout(() => window.print(), 0);
};
```

The `afterprint` event removes the class so the UI returns to normal.

### 3) Print-only CSS (A4)
In `src/app/globals.css`:

- `@page` sets the size to A4 and a margin.
- `body.print-mode > *:not(.print-root)` hides the app UI.
- `.print-root` is shown only in print mode.
- Table styles keep spacing consistent and avoid breaking rows.

Example (simplified):

```css
@media print {
  @page { size: A4; margin: 12mm; }

  body.print-mode > *:not(.print-root) { display: none !important; }
  body.print-mode .print-root { display: block; }

  .print-table { width: 100%; border-collapse: collapse; }
  .print-row { break-inside: avoid; page-break-inside: avoid; }
}
```

### 4) Print layout data
The print table uses the same filtered list (`items`) that powers the UI.
It intentionally prints the full filtered dataset (not just the visible
subset) so the PDF has all rows.

The header includes:
- Date range and filters (including Umbral / threshold).
- Generated timestamp and total count.

## How to reuse in other projects

1) Add a print-only component (table or report layout).
2) Create a `print-root` container and render via `createPortal`.
3) Add a print button that toggles `body.print-mode` and calls `window.print()`.
4) Add `@media print` styles to hide the app UI and format the print layout.
5) Make sure your print component receives the full dataset you want to print.

## Notes and tips

- For date inputs, parse with an explicit time (e.g. `YYYY-MM-DDT00:00:00`)
  to avoid timezone shifts.
- Use `tabular-nums` for columns with numbers so digits align cleanly.
- Add `break-inside: avoid` on rows to prevent bad page breaks.
- This approach is dependency-free and relies on browser print to PDF.
