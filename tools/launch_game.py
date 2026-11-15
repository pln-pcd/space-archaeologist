"""Run Homeward in a dedicated desktop game window, using installed Chrome/Edge."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, ctypes, json, os, shutil, subprocess, sys, threading, urllib.request
ROOT=Path(__file__).resolve().parents[1]
PORT=8391
class GameFiles(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path=='/__homeward_launcher__':
            body=b'{"game":"homeward","ready":true}'
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body);return
        if not (ROOT/'dist'/self.path.split('?')[0].lstrip('/')).is_file() and not self.path.startswith(('/assets/','/generated/','/stories/')):self.path='/index.html'
        if self.headers.get('Range','').startswith('bytes=') and self.send_range():return
        super().do_GET()
    def send_range(self):
        # Storybook films stream and seek with HTTP byte ranges.
        path=Path(self.translate_path(self.path))
        if not path.is_file():return False
        size=path.stat().st_size
        try:
            first,last=self.headers['Range'][6:].split(',')[0].split('-')
            start=int(first) if first else max(0,size-int(last))
            end=min(int(last),size-1) if first and last else size-1
        except ValueError:return False
        if start>=size or start>end:
            self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return True
        self.send_response(206);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(end-start+1));self.end_headers()
        with open(path,'rb') as f:
            f.seek(start);left=end-start+1
            while left>0:
                chunk=f.read(min(1<<16,left))
                if not chunk:break
                try:self.wfile.write(chunk)
                except (BrokenPipeError,ConnectionResetError):break
                left-=len(chunk)
        return True
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        if self.path.startswith('/stories/'):self.send_header('Accept-Ranges','bytes')
        super().end_headers()
def browser_path():
    for base,relative in [('PROGRAMFILES','Google/Chrome/Application/chrome.exe'),('PROGRAMFILES(X86)','Microsoft/Edge/Application/msedge.exe'),('PROGRAMFILES','Microsoft/Edge/Application/msedge.exe'),('LOCALAPPDATA','Google/Chrome/Application/chrome.exe')]:
        candidate=Path(os.environ.get(base,''))/relative
        if candidate.is_file():return str(candidate)
    return shutil.which('chrome') or shutil.which('msedge')
def profile_in_use(profile):
    if os.name!='nt':return False
    marker=str(profile).replace("'","''")
    cmd=f"@(Get-CimInstance Win32_Process -Filter \"name='chrome.exe' or name='msedge.exe'\" | Where-Object {{ $_.CommandLine -like '*{marker}*' }}).Count"
    try:
        out=subprocess.run(['powershell','-NoProfile','-Command',cmd],capture_output=True,text=True,timeout=15,creationflags=subprocess.CREATE_NO_WINDOW).stdout.strip()
        return int(out or 0)>0
    except Exception:return False
def message(text):
    if os.name=='nt':ctypes.windll.user32.MessageBoxW(None,text,'Homeward',0x40)
    else:print(text)
def run(check=False):
    if not (ROOT/'dist/index.html').is_file():
        if check:raise RuntimeError('Build the game first: npm run build')
        npm=shutil.which('npm.cmd') or shutil.which('npm')
        if not npm:raise RuntimeError('Homeward needs its first build. Install Node.js, then run npm install and npm run build in the homeward folder.')
        subprocess.run([npm,'run','build'],cwd=ROOT,check=True,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    try:server=ThreadingHTTPServer(('127.0.0.1',0 if check else PORT),partial(GameFiles,directory=str(ROOT/'dist')))
    except OSError:raise RuntimeError('Homeward is already running. Switch back to its game window, or close that window before starting again.')
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    url=f'http://127.0.0.1:{server.server_port}'
    try:
        if check:
            with urllib.request.urlopen(url+'/__homeward_launcher__') as response:assert json.load(response)['ready']
            with urllib.request.urlopen(url+'/') as response:
                body = response.read().decode()
                assert '<div id="root">' in body or 'Starship' in body
            print('Desktop game launcher: build and local game service verified. No browser window opened.');return
        browser=browser_path()
        if not browser:raise RuntimeError('Install Google Chrome or Microsoft Edge to open the Homeward game window.')
        profile=Path(os.environ.get('LOCALAPPDATA',str(Path.home()/'.local/share')))/'Homeward'/'GameProfile'
        profile.mkdir(parents=True,exist_ok=True)
        process=subprocess.Popen([browser,f'--app={url}',f'--user-data-dir={profile}','--no-first-run','--no-default-browser-check','--disable-background-mode','--window-size=1440,960'])
        process.wait()
        # Chrome/Edge often hand the window to a child process and exit at once, so keep the game
        # service running while any browser process still uses the Homeward profile.
        import time
        time.sleep(3)
        while profile_in_use(profile):time.sleep(2)
    finally:server.shutdown();server.server_close()
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');options=parser.parse_args()
    try:run(options.check)
    except Exception as error:
        if options.check:raise
        message(str(error));sys.exit(1)
