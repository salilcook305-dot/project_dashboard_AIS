import os
import zipfile
import shutil

EXCLUDE_DIRS = {'node_modules', '__pycache__', '.git', '.cache'}
EXCLUDE_EXTS = {'.pyc', '.pyo', '.zip', '.sqlite3', '.log'}

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
zip_name = 'project_dashboard.zip'
zip_root_path = os.path.join(root_dir, zip_name)
static_dir = os.path.join(root_dir, 'static')
zip_static_path = os.path.join(static_dir, zip_name)

print(f"Creating zip from: {root_dir}")

file_count = 0
with zipfile.ZipFile(zip_root_path, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
    for foldername, subfolders, filenames in os.walk(root_dir):
        # Filter excluded directories in-place
        subfolders[:] = [d for d in subfolders if d not in EXCLUDE_DIRS]
        
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in EXCLUDE_EXTS:
                continue
            if filename == zip_name:
                continue
            
            filepath = os.path.join(foldername, filename)
            arcname = os.path.relpath(filepath, root_dir)
            archive_target = os.path.join('project_dashboard', arcname)
            zipf.write(filepath, archive_target)
            file_count += 1

size_mb = os.path.getsize(zip_root_path) / (1024 * 1024)
print(f"Successfully packaged {file_count} files into {zip_root_path} ({size_mb:.2f} MB)")

os.makedirs(static_dir, exist_ok=True)
shutil.copy2(zip_root_path, zip_static_path)
print(f"Copied to browser download static folder: {zip_static_path}")
