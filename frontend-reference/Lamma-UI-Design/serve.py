"""Local preview server for Lamma.

python -m http.server truncates files over ~64 KB on this machine (OneDrive folder),
so this server reads each file fully into memory and sends it in one write, with no-cache headers.
Run from this folder:  python serve.py
"""
import http.server, os, socketserver

PORT = 5180
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def copyfile(self, source, outputfile):
        data = source.read()
        view, sent = memoryview(data), 0
        while sent < len(data):  # small chunks: big single sends get reset on this machine
            self.connection.sendall(view[sent:sent + 16384]); sent += 16384

    def finish(self):
        try:
            super().finish()
            self.connection.shutdown(1)  # graceful close so the browser gets every byte
        except OSError:
            pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Lamma: http://127.0.0.1:{PORT}/app/index.html")
        httpd.serve_forever()
