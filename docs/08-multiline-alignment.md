# Multiline Cell Alignment & Visual Formatting in psql

## Overview

When table cells contain multiline text (embedded `\n` or `\r\n`), `psql` uses a multi-pass formatting algorithm in `src/bin/psql/print.c` (`printTable()`) to compute column widths, calculate row heights, and align borders.

---

## 1. Table Grid Layout Mechanics

Table rendering proceeds through four distinct passes:

```text
Pass 1: Measure Cell Extents
  For each column j, each row i:
    pg_wcssize(cell[i][j]) -> width[i][j], height[i][j]

Pass 2: Column Width & Row Height Computation
  col_width[j] = MAX_i (width[i][j])
  row_height[i] = MAX_j (height[i][j])

Pass 3: Output Border Header & Column Names

Pass 4: Render Grid Row by Row
  For each row i:
    For sub-line k = 0 to row_height[i] - 1:
      For each col j:
        pg_wcsformat(subline k of cell[i][j]) -> padded to col_width[j]
```

---

## 2. Source Walkthrough: `print.c`

From `src/bin/psql/print.c`:

```c
/*
 * Calculate required dimensions for table rendering
 */
for (i = 0; i < total_rows; i++)
{
    int max_cell_height = 1;
    for (j = 0; j < total_cols; j++)
    {
        int cell_w, cell_h, cell_flags;
        
        pg_wcssize((const unsigned char *) cell_text, strlen(cell_text),
                   encoding, &opt->lineOpt,
                   &cell_w, &cell_h, &cell_flags);

        if (cell_w > col_widths[j])
            col_widths[j] = cell_w;
        if (cell_h > max_cell_height)
            max_cell_height = cell_h;
    }
    row_heights[i] = max_cell_height;
}
```

---

## 3. Formatting Edge Cases

1. **Trailing Newlines**: A string ending with `\n` creates an empty trailing line of width 0, incrementing `row_height`.
2. **Carriage Returns (`\r`)**: Overwrites visual characters in raw terminal mode or is rendered explicitly as `\r` symbol depending on format flags.
3. **Tabs (`\t`)**: Expanded according to standard tab-stop calculation `(col_pos + 8) & ~7`.
4. **ANSI Escape Sequences**: In raw output mode, escape codes can skew column width calculations unless explicitly stripped by client filters.

---

## 4. Operational Boundaries

- Multiline table cell alignment occurs exclusively inside `psql` memory.
- Multiline data fetched over libpq transmits standard text strings (`\n` byte 0x0A) through wire protocol packets.
- Formatting calculations have zero side effects on backend storage, locks, or transaction boundaries.
