#!/usr/bin/env python3
"""
Restore Dalia CRM database from a Vercel Blob backup JSON file.
Uploads the backup to the server and runs SQL INSERT statements
via the local PostgreSQL container.
"""
import json
import paramiko
import sys
import time

HOST = '156.67.26.104'
USER = 'root'
PASSWORD = 'N8l1q67yIa5LI4V48unaE'
BACKUP_FILE = '/home/z/my-project/download/dalia-backup-latest.json'

# Tables in dependency order (parents first, children last)
# This ensures foreign key constraints are satisfied
TABLE_ORDER = [
    'employee',
    'user',
    'prospect',
    'event',
    'eventProspect',
    'eventEmployee',
    'product',
    'opportunity',
    'operation',
    'task',
    'taskAssignee',
    'interaction',
    'interactionPhoto',
    'afterSale',
    'objective',
    'emailConfig',
    'chatConversation',
    'chatParticipant',
    'chatMessage',
    'notification',
    'calendarDay',
    'document',
    'documentSend',
    'charge',
    'prospectPhoto',
    'leaveRequest',
    'leaveMovement',
    'cashPayment',
    'cashJournalEntry',
    'cashExpense',
    'bankDeposit',
    'cashAuditLog',
    'backupRecord',
]

# Map of table names to their actual DB names (quoted for case sensitivity)
def db_name(table):
    return f'"{table[0].upper()}{table[1:]}"'

# Map of table name (from JSON key) to actual PostgreSQL table name
TABLE_NAME_MAP = {
    'employee': 'Employee',
    'user': 'User',
    'prospect': 'Prospect',
    'event': 'Event',
    'eventProspect': 'EventProspect',
    'eventEmployee': 'EventEmployee',
    'product': 'Product',
    'opportunity': 'Opportunity',
    'operation': 'Operation',
    'task': 'Task',
    'taskAssignee': 'TaskAssignee',
    'interaction': 'Interaction',
    'interactionPhoto': 'InteractionPhoto',
    'afterSale': 'AfterSale',
    'objective': 'Objective',
    'emailConfig': 'EmailConfig',
    'chatConversation': 'ChatConversation',
    'chatParticipant': 'ChatParticipant',
    'chatMessage': 'ChatMessage',
    'notification': 'Notification',
    'calendarDay': 'CalendarDay',
    'document': 'Document',
    'documentSend': 'DocumentSend',
    'charge': 'Charge',
    'prospectPhoto': 'ProspectPhoto',
    'leaveRequest': 'LeaveRequest',
    'leaveMovement': 'LeaveMovement',
    'cashPayment': 'CashPayment',
    'cashJournalEntry': 'CashJournalEntry',
    'cashExpense': 'CashExpense',
    'bankDeposit': 'BankDeposit',
    'cashAuditLog': 'CashAuditLog',
    'backupRecord': 'BackupRecord',
}

def escape_sql_value(val):
    """Escape a value for SQL INSERT."""
    if val is None:
        return 'NULL'
    if isinstance(val, bool):
        return 'TRUE' if val else 'FALSE'
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, str):
        # Escape single quotes and backslashes
        escaped = val.replace("\\", "\\\\").replace("'", "''")
        # Limit string length to prevent huge inserts
        if len(escaped) > 50000:
            escaped = escaped[:50000]
        return f"'{escaped}'"
    # For other types, convert to string
    return f"'{str(val).replace(chr(39), chr(39)+chr(39))}'"

def generate_insert_sql(table_name, records, batch_size=100):
    """Generate SQL INSERT statements in batches."""
    if not records:
        return []
    
    pg_table = TABLE_NAME_MAP.get(table_name, table_name)
    columns = sorted(records[0].keys())
    col_list = ', '.join(f'"{c}"' for c in columns)
    
    sql_batches = []
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        values_list = []
        
        for record in batch:
            values = []
            for col in columns:
                val = record.get(col)
                values.append(escape_sql_value(val))
            values_list.append(f'({", ".join(values)})')
        
        sql = f'INSERT INTO {pg_table} ({col_list}) VALUES\n'
        sql += ',\n'.join(values_list)
        sql += '\nON CONFLICT (id) DO NOTHING;'
        sql_batches.append(sql)
    
    return sql_batches

def ssh_cmd(ssh, cmd, timeout=300):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err

def main():
    # Load backup
    print(">>> Loading backup file...")
    with open(BACKUP_FILE) as f:
        backup = json.load(f)
    
    print(f"  Exported at: {backup.get('exportedAt')}")
    print(f"  Total records: {backup.get('totalRecords')}")
    print(f"  Tables: {backup.get('tables')}")
    
    data = backup.get('data', {})
    
    # Connect to server
    print("\n>>> Connecting to server...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    print("  Connected")
    
    # Step 1: Clear the demo data we seeded earlier
    print("\n>>> Step 1: Clearing demo data...")
    clear_sql = """
    TRUNCATE TABLE "BackupRecord", "CashAuditLog", "BankDeposit", "CashExpense", "CashJournalEntry", "CashPayment",
        "LeaveMovement", "LeaveRequest", "ProspectPhoto", "Charge", "DocumentSend", "Document",
        "CalendarDay", "Notification", "ChatMessage", "ChatParticipant", "ChatConversation",
        "EmailConfig", "Objective", "AfterSale", "InteractionPhoto", "Interaction",
        "TaskAssignee", "Task", "Operation", "Opportunity", "EventEmployee", "EventProspect",
        "Product", "Event", "Prospect", "User", "Employee"
    CASCADE;
    """
    
    # Write the clear SQL to a temp file on the server
    sftp = ssh.open_sftp()
    with sftp.open('/tmp/dalia-restore-clear.sql', 'w') as f:
        f.write(clear_sql)
    sftp.close()
    
    out, err = ssh_cmd(ssh, "docker exec -i m2gr4uesqj3npja5a2exvqql psql -U crm -d dalia < /tmp/dalia-restore-clear.sql 2>&1", timeout=60)
    if 'ERROR' in out.upper():
        print(f"  Warning during truncate: {out[:200]}")
    else:
        print("  Demo data cleared")
    
    # Step 2: Generate and execute INSERT statements for each table
    print("\n>>> Step 2: Restoring production data...")
    
    total_restored = 0
    
    for table_name in TABLE_ORDER:
        records = data.get(table_name, [])
        if not records:
            print(f"  {table_name}: 0 records (skipped)")
            continue
        
        print(f"  {table_name}: {len(records)} records...", end=' ', flush=True)
        
        # Generate SQL
        sql_batches = generate_insert_sql(table_name, records, batch_size=50)
        
        # Write SQL to server
        sql_path = f'/tmp/dalia-restore-{table_name}.sql'
        sftp = ssh.open_sftp()
        with sftp.open(sql_path, 'w') as f:
            for sql in sql_batches:
                f.write(sql + '\n\n')
        sftp.close()
        
        # Execute SQL
        out, err = ssh_cmd(ssh, f"docker exec -i m2gr4uesqj3npja5a2exvqql psql -U crm -d dalia < {sql_path} 2>&1", timeout=120)
        
        # Count inserted
        inserted = out.count('INSERT 0')
        if 'ERROR' in out.upper():
            errors = [l for l in out.split('\n') if 'ERROR' in l.upper()]
            print(f"ERRORS: {len(errors)}")
            for e in errors[:3]:
                print(f"    {e.strip()[:120]}")
        else:
            print(f"OK ({inserted} batches)")
        
        total_restored += len(records)
        
        # Clean up temp file
        ssh.exec_command(f'rm -f {sql_path}')
    
    # Step 3: Verify data
    print(f"\n>>> Step 3: Verifying restored data...")
    verify_sql = """
    SELECT 'Employees' as t, count(*) FROM "Employee"
    UNION ALL SELECT 'Users', count(*) FROM "User"
    UNION ALL SELECT 'Prospects', count(*) FROM "Prospect"
    UNION ALL SELECT 'Events', count(*) FROM "Event"
    UNION ALL SELECT 'Products', count(*) FROM "Product"
    UNION ALL SELECT 'Opportunities', count(*) FROM "Opportunity"
    UNION ALL SELECT 'Operations', count(*) FROM "Operation"
    UNION ALL SELECT 'Tasks', count(*) FROM "Task"
    UNION ALL SELECT 'Interactions', count(*) FROM "Interaction"
    UNION ALL SELECT 'AfterSales', count(*) FROM "AfterSale"
    UNION ALL SELECT 'Documents', count(*) FROM "Document"
    UNION ALL SELECT 'Notifications', count(*) FROM "Notification"
    UNION ALL SELECT 'Chats', count(*) FROM "ChatConversation"
    UNION ALL SELECT 'ChatMessages', count(*) FROM "ChatMessage"
    UNION ALL SELECT 'CalendarDays', count(*) FROM "CalendarDay"
    ORDER BY 1;
    """
    
    out, err = ssh_cmd(ssh, f'docker exec -i m2gr4uesqj3npja5a2exvqql psql -U crm -d dalia -c "{verify_sql}" 2>&1', timeout=30)
    print(out)
    
    # Step 4: Restart Dalia container to ensure clean state
    print(">>> Step 4: Restarting Dalia container...")
    out, err = ssh_cmd(ssh, "docker restart ad4uuhzdhxblr5tweze534d8-081608242864 2>&1", timeout=30)
    print(f"  Container restarted: {out.strip()}")
    
    # Cleanup
    ssh.exec_command('rm -f /tmp/dalia-restore-*.sql /tmp/dalia-restore-clear.sql')
    ssh.close()
    
    print(f"\n>>> Restoration complete! Total records processed: {total_restored}")
    print(">>> The Dalia CRM is now running with production data.")

if __name__ == '__main__':
    main()
