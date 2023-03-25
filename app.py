import os
from threading import Thread
from socket import gethostbyname, gethostname
from urllib.request import urlopen
from urllib.error import URLError
from flask import Flask, send_file, abort
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = "69"*420
socketio = SocketIO(app, engineio_logger=False)

@app.route("/")
def main():
    return static_path("index.html")
@app.route("/<path:path>")
def static_path(path):
    if os.path.isfile(path): return send_file(path)
    abort(404)

@socketio.on("connect")
def connect():
    print("CONNECT")
@socketio.on("disconnect")
def disconnect():
    print("DISCONNECT")

@socketio.on("ping")
def ping(data):
    print("ping")
    return "pong"

def print_public_ip():
    try: print("Public IP:", urlopen("https://v4.ident.me").read().decode("utf-8")) # or api.ipify.org
    except URLError: print("Failed to fetch public IP")

if __name__ == "__main__":
    print("Local IP:", gethostbyname(gethostname()))
    Thread(target=print_public_ip).start()
    socketio.run(app, host="0.0.0.0", port=80)
