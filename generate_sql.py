import pandas as pd
import re

file_path = "Classeur SQE BU PACA.xlsx"
# Start from row 3 (header descriptors are at row 2)
data = pd.read_excel(file_path, skiprows=3)

# Columns based on inspection:
# 0: En service
# 1: vgp status
# 2: vgp obs
# 3: periodicity
# 4: family
# 5: name/brand/serial
# 6: machine_id
# 7: assigned_to
# 8: location
# 9: control_type
# 11: last_maint_date
# 12: next_maint_date

data.columns = [
    'status_raw', 'vgp_status_raw', 'vgp_obs', 'periodicity', 'family',
    'details_raw', 'machine_id', 'assigned_to', 'location', 'control_type',
    'date_ms', 'last_maint_date', 'next_maint_date', 'expiry_date', 'comments', 'r2', 'r3'
]

# Filter rows where periodicity is not null
filtered = data[data['periodicity'].notnull()].copy()

sql_statements = []

def parse_periodicity(p):
    p = str(p).lower().strip()
    if 'mois' in p:
        nums = re.findall(r'\d+', p)
        if nums: return int(nums[0])
    if 'an' in p:
        nums = re.findall(r'\d+', p)
        if nums: return int(nums[0]) * 12
        return 12
    try:
        return int(float(p))
    except:
        return 0

for idx, row in filtered.iterrows():
    m_id = str(row['machine_id']).strip()
    if not m_id or m_id == 'nan': continue
    
    name = str(row['details_raw']).strip()
    periodicity = parse_periodicity(row['periodicity'])
    
    status_active = True if str(row['status_raw']).lower() == 'pr\u00e9sent' or str(row['status_raw']).lower().startswith('oui') else False
    
    vgp_status = 'OK' if str(row['vgp_status_raw']).lower() == 'oui' else ('KO' if str(row['vgp_status_raw']).lower() == 'non' else None)
    
    # Dates
    def parse_date(d):
        if pd.isnull(d): return 'NULL'
        try:
            dt = pd.to_datetime(d)
            if pd.isnull(dt): return 'NULL'
            return f"'{dt.date().isoformat()}'"
        except:
            return 'NULL'

    next_date = parse_date(row['next_maint_date'])
    last_date = parse_date(row['last_maint_date'])
    
    # Build SQL
    sql = f"""INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('{m_id.replace("'", "''")}', '{name.replace("'", "''")}', '{str(row['family']).replace("'", "''")}', {periodicity}, '{str(row['assigned_to']).replace("'", "''")}', {str(status_active).lower()}, {'NULL' if vgp_status is None else f"'{vgp_status}'"}, '{str(row['vgp_obs']).replace("'", "''")}', {next_date}, {last_date})
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;"""
    
    sql_statements.append(sql)

with open('import_machines.sql', 'w', encoding='utf-8') as f:
    f.write("\n".join(sql_statements))

print(f"Generated {len(sql_statements)} SQL statements in import_machines.sql")
print("Unique periodicity values parsed:", filtered['periodicity'].unique())
