# Unicode Character Width Determination: pg_wcswidth & ucs_wcwidth

## Overview

Display-width calculations for Unicode character sequences in PostgreSQL client utilities are implemented in `src/bin/psql/mbprint.c`.

This document explains character classification, interval binary searches, zero-width combiners, wide East Asian characters, and boundary constraints.

---

## 1. Character Width Classes in Unicode

Under Unicode standard Annex #11 (East Asian Width):
- **Narrow / Halfwidth / Neutral (Width = 1)**: Standard Latin, digits, punctuation, and halfwidth katakana.
- **Wide / Fullwidth (Width = 2)**: CJK Unified Ideographs, Hangul syllables, fullwidth ASCII, emojis.
- **Zero-Width (Width = 0)**: Non-spacing combining marks (diacritics, accents), Zero-Width Joiner (ZWJ, `U+200D`), Zero-Width Non-Joiner (ZWNJ, `U+200C`), soft hyphens.
- **Control Characters (Width = -1)**: `U+0000..U+001F`, `U+007F..U+009F`.

---

## 2. Source Implementation: `ucs_wcwidth()`

`ucs_wcwidth()` in `src/bin/psql/mbprint.c` uses binary search intervals over sorted lookup tables:

```c
struct interval
{
    pg_wchar    first;
    pg_wchar    last;
};

/* Binary search helper */
static int
bisearch(pg_wchar ucs, const struct interval *table, int max)
{
    int min = 0;
    int mid;

    if (ucs < table[0].first || ucs > table[max].last)
        return 0;
    while (max >= min)
    {
        mid = (min + max) / 2;
        if (ucs > table[mid].last)
            min = mid + 1;
        else if (ucs < table[mid].first)
            max = mid - 1;
        else
            return 1;
    }
    return 0;
}

int
ucs_wcwidth(pg_wchar ucs)
{
    /* Sorted tables of combining and wide characters */
    static const struct interval combining[] = {
        { 0x0300, 0x036F }, /* Combining Diacritical Marks */
        { 0x0483, 0x0489 },
        /* ... */
    };

    static const struct interval wide[] = {
        { 0x1100, 0x115F }, /* Hangul Jamo */
        { 0x2E80, 0xA4CF }, /* CJK Radicals, Kangxi, Ideographs */
        { 0xAC00, 0xD7A3 }, /* Hangul Syllables */
        { 0xF900, 0xFAFF }, /* CJK Compatibility Ideographs */
        { 0xFE10, 0xFE19 }, /* Vertical forms */
        { 0x20000, 0x2FFFD }, /* CJK Supplementary */
        { 0x30000, 0x3FFFD }
    };

    /* Test for 7-bit ASCII */
    if (ucs == 0)
        return 0;
    if (ucs < 32 || (ucs >= 0x7f && ucs < 0xa0))
        return -1;

    /* Binary search in table of non-spacing characters */
    if (bisearch(ucs, combining, sizeof(combining) / sizeof(struct interval) - 1))
        return 0;

    /* Binary search in table of wide characters */
    if (bisearch(ucs, wide, sizeof(wide) / sizeof(struct interval) - 1))
        return 2;

    return 1;
}
```

---

## 3. String Traversal: `pg_wcswidth()`

`pg_wcswidth()` decodes UTF-8 multibyte sequences using `pg_utf_mblen()` and aggregates character widths:

```c
int
pg_wcswidth(const char *pwcs, size_t len, int encoding)
{
    int width = 0;
    while (len > 0)
    {
        int ch_len;
        pg_wchar ucs;

        if (encoding == PG_UTF8)
        {
            ch_len = pg_utf_mblen((const unsigned char *) pwcs);
            if (ch_len > len)
                return -1; /* Incomplete multibyte sequence */
            ucs = utf8_to_unicode((const unsigned char *) pwcs);
        }
        else
        {
            ch_len = 1;
            ucs = (unsigned char) *pwcs;
        }

        int w = ucs_wcwidth(ucs);
        if (w < 0)
            return -1; /* Unprintable control character encountered */
        
        width += w;
        pwcs += ch_len;
        len -= ch_len;
    }
    return width;
}
```

---

## 4. Complex Graphemes and Limitations

- **Emoji Sequences & ZWJ**: Modern multi-codepoint sequences (e.g. `👨‍👩‍👧‍👦` family emoji using ZWJ `U+200D`) are evaluated character-by-character rather than by full Unicode 15+ grapheme cluster segmentation rules.
- **Flag Sequences**: Regional indicator pairs (e.g., `🇺🇸`) are treated as two width-1 or width-2 symbols depending on table entries.
- **Terminal Alignment**: Discrepancies between `psql`'s internal table and modern terminal emulator rendering engines (which use full libgrapheme/Unicode 15.1) can cause 1-2 cell alignment shifts in psql output.

**Independent Mechanism Reminder**: These display-width calculations take place in client memory during terminal output formatting, with no connection to server-side transaction logging or SLRU subsystems.
