create schema if not exists frontdeskai;

create table frontdeskai.companies (
      id uuid primary key default gen_random_uuid(),
        name text not null,
          api_key_hash text not null unique,
            created_at timestamptz not null default now()
);

create table frontdeskai.customers (
      id uuid primary key default gen_random_uuid(),
        company_id uuid not null references frontdeskai.companies(id),
          name text,
            phone text,
              email text,
                created_at timestamptz not null default now()
);

create table frontdeskai.phone_configs (
      id uuid primary key default gen_random_uuid(),
        company_id uuid not null references frontdeskai.companies(id),
          phone_number text not null,
            voice_id text,
              greeting_script text,
                created_at timestamptz not null default now()
);

create table frontdeskai.calls (
      id uuid primary key default gen_random_uuid(),
        company_id uuid not null references frontdeskai.companies(id),
          customer_id uuid references frontdeskai.customers(id),
            transcript text,
              sentiment text,
                duration_seconds int,
                  created_at timestamptz not null default now()
);

create table frontdeskai.appointments (
      id uuid primary key default gen_random_uuid(),
        company_id uuid not null references frontdeskai.companies(id),
          customer_id uuid references frontdeskai.customers(id),
            scheduled_at timestamptz,
              status text,
               service_name text,
duration_minutes int,
booked_by text,
notes text,
created_at timestamptz not null default now()
);

create table frontdeskai.documents (
      id uuid primary key default gen_random_uuid(),
        company_id uuid not null references frontdeskai.companies(id),
          filename text,
            summary text,
              created_at timestamptz not null default now()
);

alter table frontdeskai.customers
  add constraint customers_company_unique unique (id, company_id);

  alter table frontdeskai.calls
    add constraint calls_customer_company_fk
      foreign key (customer_id, company_id)
        references frontdeskai.customers(id, company_id);

        alter table frontdeskai.appointments
          add constraint appointments_customer_company_fk
            foreign key (customer_id, company_id)
              references frontdeskai.customers(id, company_id);

              create or replace function frontdeskai.frontdeskai_current_company_id()
              returns uuid
              language sql
              stable
              security invoker
              set search_path = pg_catalog, pg_temp
              as $func$
                select nullif(current_setting('app.current_company_id', true), '')::uuid;
                $func$;

                alter table frontdeskai.customers      enable row level security;
                alter table frontdeskai.customers      force row level security;
                alter table frontdeskai.phone_configs  enable row level security;
                alter table frontdeskai.phone_configs  force row level security;
                alter table frontdeskai.calls          enable row level security;
                alter table frontdeskai.calls          force row level security;
                alter table frontdeskai.appointments   enable row level security;
                alter table frontdeskai.appointments   force row level security;
                alter table frontdeskai.documents      enable row level security;
                alter table frontdeskai.documents      force row level security;
                alter table frontdeskai.companies      enable row level security;
                alter table frontdeskai.companies      force row level security;

                create policy tenant_isolation on frontdeskai.customers
                  for all
                    using (company_id = frontdeskai.frontdeskai_current_company_id())
                      with check (company_id = frontdeskai.frontdeskai_current_company_id());

                      create policy tenant_isolation on frontdeskai.phone_configs
                        for all
                          using (company_id = frontdeskai.frontdeskai_current_company_id())
                            with check (company_id = frontdeskai.frontdeskai_current_company_id());

                            create policy tenant_isolation on frontdeskai.calls
                              for all
                                using (company_id = frontdeskai.frontdeskai_current_company_id())
                                  with check (company_id = frontdeskai.frontdeskai_current_company_id());

                                  create policy tenant_isolation on frontdeskai.appointments
                                    for all
                                      using (company_id = frontdeskai.frontdeskai_current_company_id())
                                        with check (company_id = frontdeskai.frontdeskai_current_company_id());

                                        create policy tenant_isolation on frontdeskai.documents
                                          for all
                                            using (company_id = frontdeskai.frontdeskai_current_company_id())
                                              with check (company_id = frontdeskai.frontdeskai_current_company_id());

                                              create policy self_only on frontdeskai.companies
                                                for select
                                                  using (id = frontdeskai.frontdeskai_current_company_id());
