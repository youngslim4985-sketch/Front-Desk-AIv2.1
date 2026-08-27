# psql Width Calculation Functions & Display Engine

## Overview

The terminal client `psql` renders tabular query results using character measurement and cell formatting routines defined in `src/bin/psql/mbprint.c` and `src/bin/psql/print.c`.

This document details the responsibilities, signatures, and execution flow of psql's display-width subsystem.

---

## 1. Subsystem Architecture

The psql display engine ensures that columns align correctly in fixed-width terminal fonts regardless of:
- Multibyte UTF-8 characters (e.g., CJK ideographs taking 2 character cells);
- Zero-width non-spacing characters (e.g., combining accents, zero-width joiners);
- Control characters (newlines `\n`, carriage returns `\r`, tabs `\t`);
- Non-printable control characters rendered in octal/hex escape notation.

```text
Table Data Cell (char *)
        |
        v
pg_wcssize()  ---> Scans line breaks, tabs, control chars; returns (lines, max_width)
        |
        v
pg_wcsformat() ---> Formats into multi-line printable output buffer
        |
        v
Output to stdout / pager
```

---

## 2. Core Function Signatures (`mbprint.h` / `mbprint.c`)

### `ucs_wcwidth()`
```c
int ucs_wcwidth(pg_wchar ucs);
```
- Determines column width (0, 1, or 2) of a single Unicode character `ucs` (based on Markus Kuhn's standard UTF-8 wcwidth implementation).
- Returns `-1` if `ucs` is a non-printable or control character.

### `pg_wcswidth()`
```c
int pg_wcswidth(const char *pwcs, size_t len, int encoding);
```
- Computes total visible display width in terminal cells for a string `pwcs` of length `len` bytes in `encoding`.
- Ignores newlines or stops at the first newline depending on caller flags.

### `pg_wcssize()`
```c
void pg_wcssize(const unsigned char *pwcs, size_t len, int encoding,
                struct printTextLineFormat *fmt,
                int *width, int *height, int *format);
```
- Traverses a cell string to determine:
  - Total vertical line count (`height`) required after breaking at `\n` or wrapping.
  - Maximum horizontal display width (`width`) across all rendered lines.
  - Required format flags (`format`), indicating presence of newlines, tabs, or carriage returns.

### `pg_wcsformat()`
```c
void pg_wcsformat(const unsigned char *pwcs, size_t len, int encoding,
                  struct printTextLineFormat *fmt,
                  unsigned char *dst, size_t dst_len);
```
- Transforms raw cell contents into formatted terminal output, expanding control characters and padding lines to column boundaries.

---

## 3. Control Character Expansion

In `src/bin/psql/mbprint.c`, non-printable characters (< 0x20) are expanded according to format flags:
- `\n`: Increments line count; resets current column width counter.
- `\r`: Handled as carriage return (or visual indicator `\r`).
- `\t`: Expanded to standard tab stop columns (e.g., 8 character cells).
- Unprintable control bytes: Expanded to `\ooo` (octal) or `\xHH` (hexadecimal), each taking multiple display cells.

---

## 4. Separation from PostgreSQL Server Engine

| Property | `psql` Width Subsystem | Backend Transaction Subsystem |
|---|---|---|
| **Binary Location** | `src/bin/psql/mbprint.c` | `src/backend/access/transam/` |
| **Process Space** | Client-side (user machine / terminal) | Server-side (backend daemon / worker) |
| **Memory Region** | Client process heap | Postgres Shared Memory & Backend Private Mem |
| **XID Generation** | None (0 XIDs) | Transaction engine (`GetNewTransactionId`) |
| **SLRU Interaction** | None | Reads/Writes to `pg_subtrans`, `pg_multixact` |

**Conclusion**: The psql width calculation subsystem is purely a client-side display formatting facility. It has zero interaction with server-side locks, transactions, or SLRU buffers.
