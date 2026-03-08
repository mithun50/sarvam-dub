#!/usr/bin/env python3
"""Local dev server for Sarvam Dub web demo.

Serves the HTML and proxies API requests to dashboard.sarvam.ai,
avoiding all CORS issues.

Usage:
    python serve.py
    # Open http://localhost:8000
"""

import http.server
import urllib.request
import urllib.error
import json
import sys
import os

PORT = int(os.environ.get("PORT", 8000))
API_HOST = "https://dashboard.sarvam.ai"
DEMO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo")


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DEMO_DIR, **kwargs)

    def do_request(self, method):
        if not self.path.startswith("/api/"):
            if method == "GET":
                super().do_GET()
            else:
                self.send_error(405)
            return

        url = API_HOST + self.path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        headers = {}
        if self.headers.get("Content-Type"):
            headers["Content-Type"] = self.headers["Content-Type"]

        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() not in ("transfer-encoding", "connection", "content-encoding"):
                        self.send_header(key, val)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        self.do_request("GET")

    def do_POST(self):
        self.do_request("POST")

    def do_PUT(self):
        # PUT for Azure blob upload — proxy directly
        url = self.path
        if url.startswith("/upload-proxy/"):
            # Decode the target URL from the path
            target = urllib.parse.unquote(url[len("/upload-proxy/"):])
        else:
            target = API_HOST + self.path

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        headers = {"x-ms-blob-type": "BlockBlob"}
        if self.headers.get("Content-Type"):
            headers["Content-Type"] = self.headers["Content-Type"]

        try:
            req = urllib.request.Request(target, data=body, headers=headers, method="PUT")
            with urllib.request.urlopen(req) as resp:
                self.send_response(resp.status)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(resp.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, x-ms-blob-type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def log_message(self, format, *args):
        path = args[0].split()[1] if args else ""
        if path.startswith("/api/"):
            sys.stderr.write(f"  \033[36mproxy\033[0m {args[0]}\n")
        else:
            super().log_message(format, *args)


if __name__ == "__main__":
    import urllib.parse

    server = http.server.HTTPServer(("0.0.0.0", PORT), ProxyHandler)
    print(f"\n  \033[1mSarvam Dub Demo\033[0m")
    print(f"  \033[32mhttp://localhost:{PORT}\033[0m\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
        server.server_close()
