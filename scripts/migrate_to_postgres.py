#!/usr/bin/env python3
"""
AI Samrat Private Limited - Project Dashboard
SQLite to PostgreSQL Seamless Migration Script

This script migrates the complete database schema and all record data:
1. Connects to and verifies target PostgreSQL database (auto-creates if missing).
2. Cleanly dumps all application data from SQLite (excluding content types and auth permissions to prevent duplicates).
3. Applies all Django migrations on PostgreSQL.
4. Loads all data records into PostgreSQL.
5. Resets PostgreSQL primary key sequences (sqlsequencereset) to prevent ID conflict on new inserts.
6. Verifies record counts across Users, Projects, Memberships, Activity Logs, and Diary Entries.
7. Offers to automatically update .env for seamless live operation.
"""

import os
import sys
import json
import argparse
import subprocess
from pathlib import Path

# Setup paths
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
BACKEND_DIR = ROOT_DIR / 'backend'
DATABASE_DIR = ROOT_DIR / 'database'
MANAGE_PY = BACKEND_DIR / 'manage.py'
DEFAULT_DUMP_FILE = DATABASE_DIR / 'sqlite_dump.json'
if not DEFAULT_DUMP_FILE.exists():
    fallback_dump = ROOT_DIR / 'demo_data' / 'sqlite_dump.json'
    if fallback_dump.exists():
        DEFAULT_DUMP_FILE = fallback_dump
PYTHON_EXE = sys.executable

# Ensure backend is on sys.path
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def load_env_file():
    """Load variables from root .env file if available."""
    env_path = ROOT_DIR / '.env'
    env_vars = {}
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars


def parse_database_url(url: str):
    """Parse postgresql://user:password@host:port/dbname URL."""
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    return {
        'host': parsed.hostname or 'localhost',
        'port': str(parsed.port or 5432),
        'name': parsed.path.lstrip('/') or 'project_dashboard',
        'user': parsed.username or 'postgres',
        'password': parsed.password or '',
    }


def test_postgres_connection(db_config):
    """Test connection using psycopg2. If target DB doesn't exist, try creating it via default 'postgres' db."""
    try:
        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    except ImportError:
        print("[ERROR] psycopg2-binary is not installed. Run: pip install psycopg2-binary")
        return False

    name = db_config['name']
    user = db_config['user']
    password = db_config['password']
    host = db_config['host']
    port = db_config['port']

    print(f"\n[*] Testing PostgreSQL connection to {host}:{port} as user '{user}'...")
    try:
        conn = psycopg2.connect(
            dbname=name,
            user=user,
            password=password,
            host=host,
            port=port,
            connect_timeout=10,
        )
        conn.close()
        print(f"[OK] Successfully connected to target database '{name}'.")
        return True
    except psycopg2.OperationalError as e:
        err_msg = str(e)
        if f'database "{name}" does not exist' in err_msg or 'does not exist' in err_msg:
            print(f"[*] Target database '{name}' does not exist yet. Attempting to create it...")
            try:
                # Connect to maintenance database 'postgres' to create target db
                admin_conn = psycopg2.connect(
                    dbname='postgres',
                    user=user,
                    password=password,
                    host=host,
                    port=port,
                    connect_timeout=10,
                )
                admin_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                cursor = admin_conn.cursor()
                cursor.execute(f'CREATE DATABASE "{name}"')
                cursor.close()
                admin_conn.close()
                print(f"[OK] Database '{name}' created successfully!")
                return True
            except Exception as create_err:
                print(f"[ERROR] Could not auto-create database '{name}': {create_err}")
                print(f"Please create the database manually: CREATE DATABASE {name};")
                return False
        else:
            print(f"[ERROR] Failed to connect to PostgreSQL: {err_msg}")
            return False


def dump_sqlite_data(dump_path: Path):
    """Dump existing data from SQLite excluding permissions and content types."""
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[*] Dumping clean data from SQLite to {dump_path}...")
    
    # Run dumpdata with SQLite configuration
    cmd = [
        PYTHON_EXE,
        str(MANAGE_PY),
        'dumpdata',
        '--natural-foreign',
        '--natural-primary',
        '-e', 'contenttypes',
        '-e', 'auth.Permission',
        '--indent', '2',
        '-o', str(dump_path),
    ]
    env = os.environ.copy()
    env['USE_POSTGRES'] = 'False'
    
    result = subprocess.run(cmd, env=env, cwd=str(ROOT_DIR), capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ERROR] Failed to dump data from SQLite:\n{result.stderr}")
        return False
        
    print(f"[OK] Data exported successfully ({dump_path.stat().st_size} bytes).")
    return True


def run_postgres_migrations(db_config):
    """Run Django migrate against PostgreSQL database."""
    print("\n[*] Applying Django migrations on PostgreSQL...")
    cmd = [
        PYTHON_EXE,
        str(MANAGE_PY),
        'migrate',
        '--noinput',
    ]
    env = os.environ.copy()
    env['USE_POSTGRES'] = 'True'
    env['DB_NAME'] = db_config['name']
    env['DB_USER'] = db_config['user']
    env['DB_PASSWORD'] = db_config['password']
    env['DB_HOST'] = db_config['host']
    env['DB_PORT'] = str(db_config['port'])

    result = subprocess.run(cmd, env=env, cwd=str(ROOT_DIR), capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ERROR] Failed applying migrations on PostgreSQL:\n{result.stderr}")
        return False
    print("[OK] Migrations applied successfully on PostgreSQL.")
    return True


def load_data_to_postgres(dump_path: Path, db_config):
    """Load JSON dumpdata into PostgreSQL."""
    print(f"\n[*] Loading records into PostgreSQL from {dump_path}...")
    cmd = [
        PYTHON_EXE,
        str(MANAGE_PY),
        'loaddata',
        str(dump_path),
    ]
    env = os.environ.copy()
    env['USE_POSTGRES'] = 'True'
    env['DB_NAME'] = db_config['name']
    env['DB_USER'] = db_config['user']
    env['DB_PASSWORD'] = db_config['password']
    env['DB_HOST'] = db_config['host']
    env['DB_PORT'] = str(db_config['port'])

    result = subprocess.run(cmd, env=env, cwd=str(ROOT_DIR), capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ERROR] Failed loading data into PostgreSQL:\n{result.stderr}")
        return False
    print(f"[OK] {result.stdout.strip()}")
    return True


def reset_postgres_sequences(db_config):
    """Reset PostgreSQL primary key sequences for all apps so new auto-increment rows start at MAX(id)+1."""
    print("\n[*] Resetting PostgreSQL primary key sequences...")
    apps = ['accounts', 'projects', 'documents', 'admin', 'auth']
    
    cmd = [
        PYTHON_EXE,
        str(MANAGE_PY),
        'sqlsequencereset',
    ] + apps
    env = os.environ.copy()
    env['USE_POSTGRES'] = 'True'
    env['DB_NAME'] = db_config['name']
    env['DB_USER'] = db_config['user']
    env['DB_PASSWORD'] = db_config['password']
    env['DB_HOST'] = db_config['host']
    env['DB_PORT'] = str(db_config['port'])

    result = subprocess.run(cmd, env=env, cwd=str(ROOT_DIR), capture_output=True, text=True)
    if result.returncode != 0 or not result.stdout.strip():
        print(f"[WARN] sqlsequencereset returned: {result.stderr or 'No sequences found'}")
        return True

    sql_statements = result.stdout
    try:
        import psycopg2
        conn = psycopg2.connect(
            dbname=db_config['name'],
            user=db_config['user'],
            password=db_config['password'],
            host=db_config['host'],
            port=db_config['port'],
        )
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute(sql_statements)
        conn.close()
        print("[OK] All PostgreSQL primary key sequences reset successfully.")
        return True
    except Exception as e:
        print(f"[WARN] Could not automatically execute sequence reset SQL: {e}")
        return True


def verify_migration(db_config):
    """Compare record counts between SQLite and PostgreSQL."""
    print("\n[*] Verifying data fidelity between SQLite and PostgreSQL...")
    code = """
import sys
sys.path.insert(0, 'backend')
import os, django
django.setup()

from accounts.models import User
from projects.models import Project, ProjectMembership, DiaryEntry, ActivityLog

print(f"{User.objects.count()},{Project.objects.count()},{ProjectMembership.objects.count()},{DiaryEntry.objects.count()},{ActivityLog.objects.count()}")
"""

    # Fetch SQLite counts
    env_sqlite = os.environ.copy()
    env_sqlite['USE_POSTGRES'] = 'False'
    res_sqlite = subprocess.run([PYTHON_EXE, '-c', code], env=env_sqlite, cwd=str(ROOT_DIR), capture_output=True, text=True)

    # Fetch PostgreSQL counts
    env_pg = os.environ.copy()
    env_pg['USE_POSTGRES'] = 'True'
    env_pg['DB_NAME'] = db_config['name']
    env_pg['DB_USER'] = db_config['user']
    env_pg['DB_PASSWORD'] = db_config['password']
    env_pg['DB_HOST'] = db_config['host']
    env_pg['DB_PORT'] = str(db_config['port'])
    res_pg = subprocess.run([PYTHON_EXE, '-c', code], env=env_pg, cwd=str(ROOT_DIR), capture_output=True, text=True)

    if res_sqlite.returncode == 0 and res_pg.returncode == 0:
        c_sqlite = [int(x) for x in res_sqlite.stdout.strip().split(',')]
        c_pg = [int(x) for x in res_pg.stdout.strip().split(',')]
        entities = ['Users', 'Projects', 'Memberships', 'Diary Entries', 'Activity Logs']

        print("\n" + "=" * 55)
        print(f"{'Entity':<18} | {'SQLite':<12} | {'PostgreSQL':<12} | {'Status'}")
        print("-" * 55)
        all_match = True
        for name, s_cnt, p_cnt in zip(entities, c_sqlite, c_pg):
            status = "[MATCH]" if s_cnt == p_cnt else "[MISMATCH]"
            if s_cnt != p_cnt:
                all_match = False
            print(f"{name:<18} | {s_cnt:<12} | {p_cnt:<12} | {status}")
        print("=" * 55)
        return all_match
    else:
        print("[WARN] Could not retrieve comparative counts:")
        if res_sqlite.returncode != 0:
            print("SQLite check error:", res_sqlite.stderr)
        if res_pg.returncode != 0:
            print("PostgreSQL check error:", res_pg.stderr)
        return False


def update_env_file(db_config):
    """Update root .env file with PostgreSQL connection parameters."""
    env_path = ROOT_DIR / '.env'
    content = ""
    if env_path.exists():
        content = env_path.read_text(encoding='utf-8')

    lines = content.splitlines()
    keys_to_replace = {'USE_POSTGRES', 'DB_ENGINE', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT'}
    filtered_lines = [l for l in lines if not any(l.strip().startswith(k + '=') for k in keys_to_replace)]

    pg_block = [
        "",
        "# PostgreSQL Database Configuration",
        "USE_POSTGRES=True",
        "DB_ENGINE=django.db.backends.postgresql",
        f"DB_NAME={db_config['name']}",
        f"DB_USER={db_config['user']}",
        f"DB_PASSWORD={db_config['password']}",
        f"DB_HOST={db_config['host']}",
        f"DB_PORT={db_config['port']}",
    ]

    new_content = "\n".join(filtered_lines + pg_block) + "\n"
    env_path.write_text(new_content, encoding='utf-8')
    print(f"[OK] Updated {env_path} with PostgreSQL settings.")


def main():
    parser = argparse.ArgumentParser(description="Migrate AI Samrat Project Dashboard from SQLite to PostgreSQL")
    parser.add_argument('--url', help="PostgreSQL connection string (e.g. postgresql://user:pass@host:5432/dbname)")
    parser.add_argument('--host', help="PostgreSQL host (default: localhost)")
    parser.add_argument('--port', help="PostgreSQL port (default: 5432)")
    parser.add_argument('--name', help="Target database name (default: project_dashboard)")
    parser.add_argument('--user', help="PostgreSQL username (default: postgres)")
    parser.add_argument('--password', help="PostgreSQL password")
    parser.add_argument('--dump-path', default=str(DEFAULT_DUMP_FILE), help="Path for JSON data dump")
    parser.add_argument('--skip-dump', action='store_true', help="Skip SQLite dump and use existing dump file")
    parser.add_argument('--dump-only', action='store_true', help="Only dump SQLite data and exit")
    parser.add_argument('--update-env', action='store_true', help="Auto-update .env with PostgreSQL credentials on success")
    parser.add_argument('--non-interactive', action='store_true', help="Do not prompt for input")
    args = parser.parse_args()

    dump_path = Path(args.dump_path)

    # 1. Handle dump only
    if args.dump_only:
        if dump_sqlite_data(dump_path):
            print("\n[SUCCESS] SQLite data dumped successfully. Exiting.")
            sys.exit(0)
        else:
            sys.exit(1)

    # 2. Resolve PostgreSQL config from CLI, then .env, then defaults
    env_vars = load_env_file()
    
    if args.url:
        db_config = parse_database_url(args.url)
    elif env_vars.get('DATABASE_URL'):
        db_config = parse_database_url(env_vars['DATABASE_URL'])
    else:
        db_config = {
            'host': args.host or env_vars.get('DB_HOST') or 'localhost',
            'port': args.port or env_vars.get('DB_PORT') or '5432',
            'name': args.name or env_vars.get('DB_NAME') or 'project_dashboard',
            'user': args.user or env_vars.get('DB_USER') or 'postgres',
            'password': args.password if args.password is not None else (env_vars.get('DB_PASSWORD') or ''),
        }

    # Prompt interactively if password is not provided and non-interactive is not set
    if not args.non-interactive and not db_config['password'] and not args.url:
        print("\n=== AI Samrat Project Dashboard - PostgreSQL Migration ===")
        print(f"Current Target Config:")
        print(f"  Host: {db_config['host']}")
        print(f"  Port: {db_config['port']}")
        print(f"  Database Name: {db_config['name']}")
        print(f"  Username: {db_config['user']}")
        pw_input = input(f"Enter PostgreSQL password for '{db_config['user']}' (leave blank if none): ").strip()
        if pw_input:
            db_config['password'] = pw_input

    # 3. Test PostgreSQL Connection
    if not test_postgres_connection(db_config):
        print("\n[ABORTED] Could not connect to PostgreSQL. Please check your credentials and make sure PostgreSQL is running.")
        sys.exit(1)

    # 4. Dump SQLite Data (unless --skip-dump and dump file exists)
    if not (args.skip_dump and dump_path.exists()):
        if not dump_sqlite_data(dump_path):
            print("\n[ABORTED] Could not dump SQLite data.")
            sys.exit(1)
    else:
        print(f"\n[*] Using existing dump file at {dump_path}")

    # 5. Apply Migrations on PostgreSQL
    if not run_postgres_migrations(db_config):
        print("\n[ABORTED] Django migrations failed on PostgreSQL.")
        sys.exit(1)

    # 6. Load Data into PostgreSQL
    if not load_data_to_postgres(dump_path, db_config):
        print("\n[ABORTED] Loading data into PostgreSQL failed.")
        sys.exit(1)

    # 7. Reset Primary Key Sequences
    reset_postgres_sequences(db_config)

    # 8. Verify Data Fidelity
    verified = verify_migration(db_config)

    # 9. Optionally update .env
    should_update_env = args.update_env
    if not should_update_env and not args.non-interactive:
        choice = input("\nUpdate .env to activate PostgreSQL permanently? [Y/n]: ").strip().lower()
        should_update_env = choice in ('', 'y', 'yes')

    if should_update_env:
        update_env_file(db_config)

    print("\n" + "=" * 60)
    print("  MIGRATION COMPLETE! YOUR APP IS READY FOR POSTGRESQL")
    print("=" * 60)
    print("  To run your backend:")
    print("    python app.py")
    print("  To revert to SQLite at any time, in .env set:")
    print("    USE_POSTGRES=False")
    print("=" * 60)


if __name__ == '__main__':
    main()

