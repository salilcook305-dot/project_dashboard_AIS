"""
AI Samrat Private Limited - Project Dashboard
Full Django Backend Application Launcher
High-performance pure Django server and REST API platform.
"""

import os
import sys
import subprocess

if __name__ == '__main__':
    port = '8000'
    if len(sys.argv) > 1:
        try:
            port = str(int(sys.argv[1]))
        except ValueError:
            pass
    elif 'PORT' in os.environ:
        port = str(os.environ['PORT'])

    base_dir = os.path.dirname(os.path.abspath(__file__))
    manage_py = os.path.join(base_dir, 'backend', 'manage.py')

    print("=" * 70)
    print("  AI SAMRAT PRIVATE LIMITED - PROJECT DASHBOARD PLATFORM")
    print("  Backend Engine: Pure Django Web Framework & REST API")
    print(f"  Live Server: http://127.0.0.1:{port}/")
    print("=" * 70)

    cmd = [sys.executable, manage_py, 'runserver', f'0.0.0.0:{port}']
    try:
        sys.exit(subprocess.call(cmd))
    except KeyboardInterrupt:
        print("\n[OK] Server stopped.")
        sys.exit(0)
