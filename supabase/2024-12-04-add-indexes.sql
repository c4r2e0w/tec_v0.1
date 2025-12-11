-- Индексы для ускорения фильтров и календаря
create index if not exists idx_positions_type on public.positions (type);
create index if not exists idx_positions_devision on public.positions (devision_name);
create index if not exists idx_positions_sort_weight on public.positions (sort_weight);

create index if not exists idx_employees_position_id on public.employees (position_id);

create index if not exists idx_schedule_employee_date on public.schedule (employee_id, date);
create index if not exists idx_schedule_overrides_employee_date on public.schedule_overrides (employee_id, date);
