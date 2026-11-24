#!/usr/bin/env python3
"""
AcousticSpace - Dedicated Frontend Development Server
Runs the frontend web application in a separate terminal window on Port 3000
B.Tech Final-Year Capstone Project | AI & Data Science
"""

import http.server
import socketserver
import os
import sys
import mimetypes

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

class FrontendDevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/favicon.ico":
            svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M2 12h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2v-6zm20 0h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v-6zM6 8v8m4-11v14m4-11v14m4-8v8"/></svg>'
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(svg)))
            self.end_headers()
            self.wfile.write(svg)
            return
        return super().do_GET()

    def end_headers(self):
        # Enable CORS and disable aggressive caching for live development
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

def run_frontend(port=PORT):
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")

    for p in [port, 5173, 8080, 8088]:
        try:
            with socketserver.TCPServer(("", p), FrontendDevHandler) as httpd:
                print("=" * 68)
                print(" 🌐 AcousticSpace: Frontend Development Server Active")
                print(" 🎓 B.Tech Final-Year Capstone Project | AI & Data Science")
                print("=" * 68)
                print(f" • Frontend UI   : http://localhost:{p}")
                print(f" • Directory     : {FRONTEND_DIR}")
                print(" • Backend API   : http://localhost:8000 (run in Terminal 1)")
                print("=" * 68)
                print(" Press Ctrl+C in this terminal to stop the frontend.")
                httpd.serve_forever()
                break
        except OSError:
            print(f"Port {p} is in use, trying next port...")

if __name__ == "__main__":
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_frontend(port_arg)
