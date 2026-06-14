# DeeBee — Distance Buddy

A small cat-shaped device that clips on top of your monitor, watches how close you sit, and reacts with paw movement, sound, and an on-screen overlay. Includes a notes panel, pomodoro timer with mood-aware reactions, and cursor-tracking paws.

Built with Arduino C++ (firmware) and Electron (desktop overlay). Cross-platform: works on **Windows** and **Mac**.

---

## Running it — zero thinking required

You can run the desktop app by itself, even without the hardware sensor.

### Step 1 — Install Node.js (one-time, ~3 minutes)

This is the only thing you have to install.

1. Open this link in your browser: **https://nodejs.org/en/download**
2. The page detects your operating system automatically. Click the big green **"LTS"** download button (LTS = Long Term Support).
3. Open the downloaded installer:
   - **Windows:** `node-v22.x.x-x64.msi` in your Downloads folder.
   - **Mac:** `node-v22.x.x.pkg` in your Downloads folder.
4. Run the installer. Click **Next / Continue** through every screen. The default settings are correct — you do not need to change anything.
5. When it finishes, close the installer. You're done.

You can now ignore Node.js forever — it just needs to exist on your computer for the launcher to work.

### Step 2 — Place the DeeBee folder anywhere

This folder (the one containing this README) can live anywhere on your computer. Desktop, Documents, anywhere. **Do not move files around inside it.**

### Step 3 — Run DeeBee

Double-click the launcher for your OS:

- **Windows:** `Start DeeBee (Windows).bat`
- **Mac:** `Start DeeBee (Mac).command`

**The first time** you run it, a terminal window opens and says "First-time setup. Installing dependencies (1-2 minutes)..." This downloads the libraries DeeBee needs. Wait for it to finish — the DeeBee window then appears.

**Every time after that,** the terminal flashes for ~2 seconds and DeeBee opens immediately.

That's it.

---

## Mac users: two one-time clicks you'll see

### Gatekeeper warning the first time

macOS may block the launcher with *"`.command` cannot be opened because it is from an unidentified developer."*

**Fix (only needed once):** Right-click the `Start DeeBee (Mac).command` file → click **Open** → click **Open** again in the warning dialog. After that, it runs normally on double-click forever.

### Screen Recording permission

The first time DeeBee tries to read which app is in your foreground (for the mood-aware meows), macOS asks for **Screen Recording** permission.

**Fix:** Click **Allow** in the popup, OR open System Settings → Privacy & Security → Screen Recording → toggle DeeBee on.

If you skip this, DeeBee still works — you just won't get mood-aware reactions.

---

## What you'll see

A small **HUD** in the bottom-right corner showing distance, state, and active-app mood.

Move your cursor to the very top-center of the screen:
- **Right of center** opens the notes panel (the fish).
- **Left of center** opens the pomodoro panel (the cat-food can).

The HUD has three small buttons:
- 🔊 — mute / unmute all meows
- `–` — hide the HUD (a small `DB` badge replaces it; click that badge to bring it back)
- ✕ — quit DeeBee

You can also quit anytime with **Ctrl+Shift+Q** (Windows) or **Cmd+Shift+Q** (Mac).

---

## Connecting the hardware (optional)

If you have the physical DeeBee device:

1. Plug the ESP32-C3 into a USB port. DeeBee auto-detects it.
2. The cat-paw movement and ultrasonic distance detection turn on automatically.

Need to flash firmware? Open `firmware/deebee_firmware/deebee_firmware.ino` in the Arduino IDE, select the **XIAO_ESP32C3** board, and upload.

---

## Troubleshooting

**The launcher window opens then closes immediately.**
You don't have Node.js installed yet. Go back to Step 1.

**"npm is not recognized" or similar error.**
Close the launcher window. Restart your computer once after installing Node.js — Windows needs a restart to find the new programs. Then try the launcher again.

**The DeeBee window doesn't appear after the launcher runs.**
Look behind your other windows — DeeBee is transparent and may be hidden behind a maximized browser. Click the DeeBee icon in your taskbar (Windows) or Dock (Mac) to focus it.

**Hardware paws don't move.**
Make sure the ESP32 is plugged in *before* you launch DeeBee. If it was plugged in mid-session, close DeeBee (Ctrl+Shift+Q) and re-launch.

---

## Updating to a newer version

When you get a newer DeeBee folder, **delete the old one entirely** and replace it with the new one. The first launcher run will reinstall dependencies fresh.

---

## Quitting cleanly

Press **Ctrl+Shift+Q** (Windows) / **Cmd+Shift+Q** (Mac), or click the pink **✕** on the HUD. Both fully close DeeBee and disconnect from the hardware.
