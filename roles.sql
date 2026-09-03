create role frontdeskai_app login password 'CHANGE_THIS_PASSWORD_123';
grant usage on schema frontdeskai to frontdeskai_app;
grant select, insert, update, delete on frontdeskai.customers, frontdeskai.phone_configs, frontdeskai.calls, frontdeskai.appointments, frontdeskai.documents to frontdeskai_app;
grant select on frontdeskai.companies to frontdeskai_app;
grant execute on function frontdeskai.frontdeskai_current_company_id() to frontdeskai_app;
alter role frontdeskai_app nosuperuser nobypassrls nocreatedb nocreaterole;
