# This tool can be used to explore QR codes and the things that make them up.
## It's not pretty, but it can help you understand QR codes.

The decoder works step, by step, and shows each step on screen. You can recover data from a QR code even if it has been purposely corrupted, however you may need to provide some information manually.

The encoder allows you to edit the information stored in the QR code at the binary level.
It also allows you to do some interesting things with the Physical layout of the modules, and the size/shape of the modules.

I use this tool to explore the QR code standard, and to learn about the things that make QR codes work.
It has lots of features, and some may be of questionable value, but I probably just wanted to see if I could do something.

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

