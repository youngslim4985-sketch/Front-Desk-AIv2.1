# SECURITY DEFINER Checklist

For every SECURITY DEFINER function:

- [ ] Correct owner
- [ ] Explicit search_path
- [ ] pg_catalog first
- [ ] pg_temp last
- [ ] Security-sensitive names fully qualified
- [ ] No unnecessary PUBLIC EXECUTE
- [ ] EXECUTE granted only to required roles
- [ ] No unsafe writable schema ahead of pg_catalog
- [ ] No tenant identity derived from current_user
- [ ] No tenant identity derived from session_user
- [ ] Privileged function separately tested
- [ ] Actual database inventory completed
