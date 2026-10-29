#!/usr/bin/env python3
"""
Tunnel SSH : localhost:5433 -> conteneur PostgreSQL de production (dalia)
Permet d'utiliser prisma db push / db pull / scripts Prisma contre la
VRAIE base de production depuis ce workspace.

La vraie base de production n'est PAS Neon : c'est le conteneur Docker
`postgresql-bwj97q1aao9793pgif71u3ou` sur le VPS (réseau interne Coolify).

Usage:
  nohup python3 scripts/tunnel-prod-db.py > /tmp/tunnel.log 2>&1 &
  # ... puis DATABASE_URL="postgresql://...@localhost:5433/dalia?sslmode=disable" npx prisma ...
  kill %1  (ou pkill -f tunnel-prod-db)
"""
import select
import socket
import threading

import paramiko

from ssh_cmd import HOST, PASSWORD, USER

LOCAL_PORT = 5433
# IP du conteneur Postgres sur le réseau Docker (docker inspect)
REMOTE_HOST = '10.0.1.16'
REMOTE_PORT = 5432


def handle(channel, sock):
    try:
        while True:
            r, _, _ = select.select([channel, sock], [], [], 120)
            if not r:
                break
            if channel in r:
                data = channel.recv(65536)
                if not data:
                    break
                sock.sendall(data)
            if sock in r:
                data = sock.recv(65536)
                if not data:
                    break
                channel.sendall(data)
    finally:
        try:
            channel.close()
        except Exception:
            pass
        try:
            sock.close()
        except Exception:
            pass


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    transport = client.get_transport()
    transport.set_keepalive(30)

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('127.0.0.1', LOCAL_PORT))
    server.listen(16)
    print(f'Tunnel prêt: 127.0.0.1:{LOCAL_PORT} -> {REMOTE_HOST}:{REMOTE_PORT}', flush=True)

    while True:
        conn, _ = server.accept()
        try:
            chan = transport.open_channel('direct-tcpip', (REMOTE_HOST, REMOTE_PORT), conn.getpeername())
        except Exception as e:
            print(f'open_channel error: {e}', flush=True)
            conn.close()
            continue
        if chan is None:
            conn.close()
            continue
        threading.Thread(target=handle, args=(chan, conn), daemon=True).start()


if __name__ == '__main__':
    main()
