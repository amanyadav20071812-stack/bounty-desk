import subprocess
import sys
import time
import webbrowser

backend = subprocess.Popen([sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"])
frontend = subprocess.Popen(["cmd.exe", "/c", "npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"])

time.sleep(3)
webbrowser.open("http://localhost:5173")

try:
    while True:
        time.sleep(1)
        if backend.poll() is not None or frontend.poll() is not None:
            break
except KeyboardInterrupt:
    pass
finally:
    backend.terminate()
    frontend.terminate()
