# This tool can be used to explore QR codes and the things that make them up.
## It's not pretty, but it can help you understand QR codes.

The decoder works step, by step, and shows each step on screen. 

The encoder allows you to edit the information stored in the QR code at the binary level.
It also allows you do some interesting things with the Physical layout of the modules, and the size/shape of the modules.

Try it out here https://odyhibit.github.io/QR_workbench/

Quick start (local):
1) Clone the repo and enter it:
   git clone <repo-url>
   cd QR_workbench

2) Start a local server:
   python3 -m http.server 8000

3) Open in your browser:
   http://localhost:8000
   Then click Encoder or Decoder.

Optional fallback:
You can also open `index.html` directly in a browser, but some browsers are picky about local file access.
