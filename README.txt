FIRST IMAGE STUDIO ERP - COMPLETE INSTALLATION & SETUP GUIDE
================================================================

1. EXTRACT THE FINAL ZIP PACKAGE
----------------------------------------------------------------
Extract 'First_Image_Studio_ERP_Final_Complete.zip' into a folder on your PC,
for example:
  C:\Users\rooba\Downloads\First_Image_Studio_ERP_Final_Bundle

Inside this folder you will find:
  - server.js                  (Node.js + Express backend server)
  - db.js                      (Database layer with SQLite / JSON store)
  - package.json               (Dependencies & npm scripts)
  - .env.example               (Optional environment variables template)
  - public/index.html          (Connected First Image Studio ERP web app)
  - First_Image_Studio_ERP_v70.html (Standalone HTML copy)
  - whatsapp_webhook/Code.gs   (Google Apps Script webhook for WhatsApp OTP)

2. INSTALL DEPENDENCIES (RUN ONCE)
----------------------------------------------------------------
Open Command Prompt in your extracted folder and run:
  cd C:\Users\rooba\Downloads\First_Image_Studio_ERP_Final_Bundle
  npm install

Note: This package uses a zero-native-build database setup so it runs cleanly
without requiring C++ build tools compilation.

3. START THE BACKEND & DATABASE SERVER
----------------------------------------------------------------
Run:
  node server.js

Keep this Command Prompt window OPEN while using the ERP.
You will see:
  First Image Studio Backend + DB running on http://localhost:4580
  Database file: ...\data\first_image_studio.sqlite

4. OPEN IN GOOGLE CHROME (LOCAL PC)
----------------------------------------------------------------
Open Google Chrome and go to:
  http://localhost:4580

5. CONNECT FROM OTHER SYSTEMS / DEVICES ON THE SAME LAN / WI-FI
----------------------------------------------------------------
1) Open a second Command Prompt and run:
     ipconfig
2) Note the server PC's IPv4 Address (for example: 192.168.1.25).
3) On another computer or mobile browser on the same network, open:
     http://192.168.1.25:4580

6. ADMIN-ONLY OTP / PIN RECOVERY & MANDATORY NEW PASSWORD
----------------------------------------------------------------
- Forgot Username / Password recovery is restricted to Admin accounts.
- Default Recovery PIN is 1999 (can be updated in Settings).
- Setting a New Admin Password is mandatory during recovery/reset.
- Configure Registered WhatsApp number and optional Webhook URL in
  Settings -> Themes & Media.
