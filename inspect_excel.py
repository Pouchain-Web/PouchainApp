import pandas as pd
import json

file_path = "Classeur SQE BU PACA.xlsx"
df = pd.read_excel(file_path)

# Print columns to see the exact names
print("Columns:", df.columns.tolist())

# Print first 5 rows to understand the data
print("\nFirst 5 rows:")
print(df.head().to_json(orient='records', indent=2))

# Filter rows where periodicity is not null
# Periodicité column name needs verification from the print above
