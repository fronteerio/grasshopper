alter table "Configs" add "termsAndConditionsText" text default ''::text;
alter table "Configs" add "termsAndConditionsEnabled" boolean default false;
alter table "Configs" add "termsAndConditionsLastUpdate" timestamp with time zone;