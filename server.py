from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent / "cordial" / "backend"
sys.path.insert(0, str(backend_dir))

from app.main import app
