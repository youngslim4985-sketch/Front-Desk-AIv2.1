# PostgreSQL Character Encoding Conversion & SQLSTATE 22P05

## Overview

SQLSTATE `22P05` (`ERRCODE_UNTRANSLATABLE_CHARACTER` / `untranslatable_character`) is raised by PostgreSQL's character set conversion engine when a byte sequence in a source encoding cannot be represented in the destination client/server encoding.

This document details the mechanics of encoding validation, error conditions, and their separation from subtransaction creation.

---

## 1. PostgreSQL Encoding Architecture

PostgreSQL handles encoding conversion between:
1. **Server Encoding** (`server_encoding`): The encoding used to store text on disk and process SQL internally (typically `UTF8`).
2. **Client Encoding** (`client_encoding`): The encoding expected by the client interface (e.g., `LATIN1`, `EUC_JP`, `WIN1252`, or `UTF8`).

When `client_encoding != server_encoding`, PostgreSQL automatically invokes conversion routines (`src/backend/utils/mb/mbutils.c`, `src/backend/utils/mb/conversion_procs/`).

```text
Client Application
       | (bytes in client_encoding)
       v
pg_client_to_server()
       |
       +---> Valid character? ---> Convert to server_encoding
       |
       +---> Invalid byte / Untranslatable sequence?
                 |
                 v
           ereport(ERROR,
               (errcode(ERRCODE_UNTRANSLATABLE_CHARACTER),
                errmsg("character with byte sequence ... has no equivalent in encoding ...")));
```

---

## 2. SQLSTATE Codes in the Encoding Subsystem

| SQLSTATE | Error Name | PostgreSQL C Macro | Typical Cause |
|---|---|---|---|
| `22021` | `character_not_in_repertoire` | `ERRCODE_CHARACTER_NOT_IN_REPERTOIRE` | Byte sequence is invalid in the specified encoding (e.g., invalid UTF-8 lead byte). |
| `22P05` | `untranslatable_character` | `ERRCODE_UNTRANSLATABLE_CHARACTER` | Byte sequence is valid in source encoding, but has no mapping in target encoding. |
| `22007` | `invalid_datetime_format` | `ERRCODE_INVALID_DATETIME_FORMAT` | String cannot be parsed into a date/time representation. |

---

## 3. Source Reference (`mbutils.c`)

In `src/backend/utils/mb/mbutils.c`:

```c
/*
 * report_untranslatable_char
 *
 * Helper function to report ERRCODE_UNTRANSLATABLE_CHARACTER
 */
void
report_untranslatable_char(const char *src_encoding_name,
                           const char *dest_encoding_name,
                           const char *c,
                           int len)
{
    char        buf[100];
    char       *p = buf;
    int         i;

    for (i = 0; i < len; i++)
    {
        sprintf(p, "0x%02x", (unsigned char) c[i]);
        p += strlen(p);
        if (i < len - 1)
            *p++ = ' ';
    }
    *p = '\0';

    ereport(ERROR,
            (errcode(ERRCODE_UNTRANSLATABLE_CHARACTER),
             errmsg("character with byte sequence %s in encoding \"%s\" has no equivalent in encoding \"%s\"",
                    buf, src_encoding_name, dest_encoding_name)));
}
```

---

## 4. Interaction with Application Workloads

When an application processes untrusted, mixed-encoding, or malformed data inside a loop:

```sql
DO $$
DECLARE
    r RECORD;
    v_clean TEXT;
BEGIN
    FOR r IN SELECT raw_payload FROM external_feed LOOP
        BEGIN
            -- Attempting conversion or insertion that triggers 22P05 or 22021
            v_clean := convert_from(r.raw_payload, 'UTF8');
            INSERT INTO processed_feed(clean_text) VALUES (v_clean);
        EXCEPTION
            WHEN untranslatable_character OR character_not_in_repertoire THEN
                INSERT INTO feed_errors(raw_payload, err_msg)
                VALUES (r.raw_payload, SQLERRM);
        END;
    END LOOP;
END;
$$;
```

### The Causal Reality
- The string conversion error (`22P05`) is a purely computational, character-level failure.
- The `EXCEPTION` block catching `22P05` creates a subtransaction (`BeginInternalSubTransaction`).
- The subtransaction consumes an XID if a write (e.g., `INSERT INTO feed_errors`) occurs.
- Exceeding 64 error occurrences in one outer transaction overflows `PGPROC->subxids`.

**Crucial Research Boundary**:
`22P05` itself does not cause subtransaction overflow or SLRU pressure. The *application's per-row `EXCEPTION` handling pattern* creates the subtransactions that lead to overflow.
