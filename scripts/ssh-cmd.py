#!/usr/bin/env python3
"""Run a command on the VPS via SSH using paramiko."""
import sys
import paramiko

HOST = '156.67.26.104'
USER = 'root'
PASSWORD = 'N8l1q67yIa5LI4V48unaE'

def run(cmd: str, timeout: int = 60) -> str:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, username=USER, password=PASSWORD, timeout=15)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        if err:
            sys.stderr.write(err)
        return out
    finally:
        client.close()

if __name__ == '__main__':
    cmd = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else 'uptime'
    print(run(cmd, timeout=120), end='')
