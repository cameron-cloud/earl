# Earl v2 spike (M0.4) - W0 measurement checklist

This is a throwaway test build of Earl, not the real v2 app. It exists to answer
two questions before any v2 code is written:

- **D13:** can Earl live in one invisible window that covers the whole screen,
  or does that hurt videos and games (and cost too much GPU)? If it does, v2
  uses a smaller window along the bottom of the screen instead.
- **D14:** which way of drawing Earl is cheaper: **layers** (a small picture of
  Earl slid around the screen) or **canvas** (one screen-sized drawing surface
  that is partly redrawn every frame)?

You do not need to understand the code. Follow the steps, write down what you
see in the results table at the bottom, and send the table back. Plan on about
an hour. Any test you cannot do, write "skipped" and move on.

---

## 1. Download and start it

1. Open the latest green run of the **Spike overlay (M0.4)** workflow on the
   `spike/overlay` branch (GitHub > cameron-cloud/earl > Actions). At the
   bottom of the run page, under **Artifacts**, download
   **earl-spike-windows** (a zip).
2. Unzip it anywhere, for example `Downloads\earl-spike`. Inside:
   - `earl-spike.exe` - the app. Just double-click it; no install needed.
   - `Earl Spike_0.0.1_x64-setup.exe` - optional installer (per-user). You
     only need this if the plain exe will not start.
   - `SPIKE_W0.md` - this checklist.
3. **Quit the normal Earl first** (right-click his tray icon > Quit) so only
   one duck is on screen.
4. Double-click `earl-spike.exe`. The build is unsigned, so Windows may show
   "Windows protected your PC": click **More info** > **Run anyway**.

**What you should see:**
- Earl walking left and right along the top edge of the taskbar.
- A dark stats panel in the top-left corner of the screen.
- A new tray icon (it may be hidden under the **^** arrow near the clock).
  Left- or right-click it for the spike menu:
  - **Renderer: layers** / **Renderer: canvas** - switch drawing mode (the
    overlay reloads in under a second).
  - **Walk / stand still** - freeze Earl in place (nothing animates).
  - **Show / hide stats panel.**
  - **Hide / show Earl** - hides the whole overlay window.
  - **Open focus test page** - a small window with a typing box.
  - **Quit Earl spike.**

**Playing with him:** hovering over Earl makes him stop and wait. Click him to
turn him around. Drag him anywhere and let go: he drops back to the ground.
Right-click him: he hops.

**If Earl does not show up at all:** quit it (tray > Quit, or end
`earl-spike.exe` in Task Manager), then start it from a terminal with the
fallback flag and write down that you needed it:

```
cd $HOME\Downloads\earl-spike
.\earl-spike.exe --layered-alpha
```

**Starting options** (only needed for the fallback above; the tray menu covers
everything else): `--mode=canvas` starts in canvas mode, `--still` starts
standing still, `--no-hud` starts with the stats panel hidden, `--keylog` opens
the focus test page at startup.

---

## 2. Before you measure: write down your setup

Fill in the "Setup" rows of the table: Windows version (press Win+R, type
`winver`), graphics card (Task Manager > Performance > GPU, name at the top
right), screen resolution, scale (Settings > System > Display > Scale), refresh
rate (Settings > System > Display > Advanced display), and the WebView2
version (Settings > Apps > Installed apps, search "WebView2").

The stats panel also shows two numbers worth copying: **DPR** and **scale**
(they should match each other and your display scale, for example 1.25 for
125%).

---

## 3. The tests

### T1 - Idle CPU and GPU (do it in BOTH modes)

Earl must be nearly free when he is just walking around. Target from the plan:
under 1% CPU in total.

1. Close heavy apps (games, video, big browser tabs). Wait a minute for the
   PC to settle.
2. Tray > **Show / hide stats panel** to hide the panel (it updates every
   second and would skew the numbers).
3. Open Task Manager (Ctrl+Shift+Esc) > **Processes** tab. Find
   **Earl Spike** under Apps. If you do not see a **GPU** column, right-click
   any column header and tick **GPU**.
4. Watch the **CPU** and **GPU** values on the Earl Spike row for 60 seconds
   and write down the typical value (ignore one-off spikes). Do this for:
   - **walking** (the default),
   - **standing still** (tray > Walk / stand still),
   - **hidden** (tray > Hide / show Earl). This is the baseline.
5. Also note the whole-PC GPU usage: Task Manager > **Performance** > **GPU**,
   the "3D" graph, walking vs quit completely.
6. **WebView2 detail (optional but useful):** tray > **Open focus test page**,
   click inside that window and press **Shift+Esc**. A small "Browser task
   manager" lists Earl's WebView2 processes (GPU process, the overlay page,
   the focus page). Write down the CPU of the **GPU Process** and of the
   **Earl spike overlay** row while he walks. If Shift+Esc does nothing,
   write "n/a".
7. Tray > **Renderer: canvas** and repeat steps 2 to 6.

### T2 - Hover flicker

1. Stats panel back on (tray). Earl walking.
2. Slowly move the mouse onto Earl and off again, about 20 times, from
   different sides. Then sweep quickly across him a few times.
3. Watch for any flicker: of Earl himself, the taskbar, the windows behind,
   the whole screen going dark or blinking, or the mouse cursor changing
   shape. Record: none / occasional / every time.
4. Click the desktop (or a desktop icon) right next to Earl, just outside
   him. The click must reach the desktop. Record yes or no.
5. Repeat in the other mode.

### T3 - Focus while typing

Clicking Earl must never steal your typing from another app.

1. Open **Notepad** and click into it.
2. Type continuously (a long sentence, or hold down a letter key). While you
   type, use the mouse to: hover Earl, click him, drag him around and drop
   him, right-click him.
3. Record: did any letters go missing, did Notepad's title bar turn grey
   (inactive), did the taskbar hide or flash?
4. Now tray > **Open focus test page**, click into its typing box and do the
   same. This page counts problems for you. Write down after 1 minute:
   **focus losses**, **Earl overlay activations**, **Earl overlay became
   foreground**. All three should stay 0.
5. **Fast flick test:** press on Earl and fling the mouse away fast. He should
   stay attached to the cursor (not get dropped halfway) until you let go.
   Record yes or no.
6. Repeat in the other mode.

### T4 (W3b) - Other apps keep playing behind Earl

Some browsers slow down or pause video when they think a big window covers
them. Earl's window covers the whole screen (invisibly), so check this.

1. Open **Chrome**, maximised, and play a YouTube video (not fullscreen).
2. Press F12 to open DevTools, click **Console**. Paste the snippet below and
   press Enter. (If Chrome says pasting is blocked, type `allow pasting`,
   press Enter, then paste again.) A small green box appears in the top-left
   corner of the page.

   ```js
   (() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;z-index:2147483647;top:8px;left:8px;background:#000c;color:#0f0;font:14px monospace;padding:6px;pointer-events:none"; document.documentElement.appendChild(d); let n = 0, t = performance.now(), hid = 0; document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "visible") hid++; console.log("visibility", document.visibilityState, new Date().toLocaleTimeString()); }); (function f(now) { n++; if (now - t >= 1000) { d.textContent = "fps " + n + " | " + document.visibilityState + " | hidden events " + hid; n = 0; t = now; } requestAnimationFrame(f); })(t); })();
   ```

3. Close DevTools (F12). For 30 seconds, hover Earl, drag him over the
   video, drop him, hover again.
4. Record: did the video stutter or pause? Did the green box stay around your
   refresh rate (for example 60) and say **visible**, with **hidden events 0**?
5. If you have Teams handy: start a "Meet now" call with your camera on and
   do the same hover and drag. Record whether your own video preview kept
   moving.
6. The focus test page also shows **this page rAF frames/s**: it should stay
   near your refresh rate while Earl walks over it.
7. Repeat in the other mode.

### T5 - Fullscreen video: "Independent Flip" or "Composed" (PresentMon)

This is the most important test for D13. When a video or game is fullscreen,
Windows can hand it straight to the screen ("Independent Flip", fastest). A big
always-on-top window like Earl's might force Windows to blend everything
together instead ("Composed"), which costs power and adds lag.

1. Download PresentMon from
   https://github.com/GameTechDev/PresentMon/releases - the file named like
   `PresentMon-2.x.x-x64.exe` (the console tool, no install).
2. Start a YouTube video in Chrome and press **F** for fullscreen. Earl
   should still be visible walking on top.
3. Open **Terminal as Administrator** (right-click Start > Terminal (Admin)),
   go to the download folder and run (use your real file name):

   ```
   cd $HOME\Downloads
   .\PresentMon-2.3.1-x64.exe --process_name chrome.exe --output_file earl_layers.csv --timed 20 --terminate_after_timed
   ```

   Then click back on the video so it stays fullscreen for the 20 seconds.
4. Open the CSV in Excel, find the **PresentMode** column and write down the
   value that appears most often. Typical values:
   - `Hardware: Independent Flip` or `Hardware Composed: Independent Flip` -
     good.
   - `Composed: Flip` or `Composed: Copy with GPU GDI` - Windows is blending
     (bad for D13).
5. Repeat with a different output file name for each case:
   - Earl **quit completely** (the baseline: what Chrome gets without Earl),
   - Earl in **layers** mode, walking,
   - Earl in **canvas** mode, walking,
   - Earl **hidden** from the tray.
6. If you have a game that runs in "borderless windowed" or "fullscreen
   windowed" mode, repeat the baseline and the layers case with
   `--process_name <game>.exe` (the name from Task Manager > Details).

If the command-line options are rejected, run the tool with `--help` and
look for the "process name", "output file" and "timed" options, or use the
PresentMon app (the installer version), which shows "Present Mode" in its
on-screen overlay.

### T6 - Layers vs canvas, side by side

T1 to T5 in both modes already give this. Also copy these numbers from the
stats panel while Earl walks, in each mode: **rAF frames/s**, **canvas
repaints/s**, **region IPC/s**. (Expected: layers repaints only when his
walking picture changes, about 7 times a second; canvas repaints on every
move.)

### T7 - Ground (quick look)

Earl's feet should rest exactly on the top edge of the taskbar, not floating
and not sinking. If you use taskbar auto-hide, he should walk along the very
bottom of the screen instead. Record: exact / floating / sinking (a screenshot
helps).

---

## 4. Results table

Copy this table into a reply (or a text file) and fill it in.

| Item | Layers | Canvas | Notes |
|---|---|---|---|
| Setup: Windows version (winver) |  |  |  |
| Setup: GPU |  |  |  |
| Setup: resolution, scale %, refresh Hz |  |  |  |
| Setup: WebView2 runtime version |  |  |  |
| Needed `--layered-alpha` to see Earl? (yes/no) |  |  |  |
| Stats panel: DPR / scale / dpi scale |  |  |  |
| T1 CPU %, walking |  |  |  |
| T1 GPU %, walking |  |  |  |
| T1 CPU %, standing still |  |  |  |
| T1 GPU %, standing still |  |  |  |
| T1 CPU % / GPU %, hidden (baseline) |  |  |  |
| T1 whole-PC GPU 3D %, walking vs Earl quit |  |  |  |
| T1 Shift+Esc: GPU Process CPU / overlay page CPU |  |  |  |
| T2 flicker on hover (none / occasional / always) |  |  |  |
| T2 click next to Earl reaches the desktop (yes/no) |  |  |  |
| T3 Notepad: letters lost / title went grey / taskbar changed |  |  |  |
| T3 focus page: focus losses / activations / became foreground |  |  |  |
| T3 fast flick keeps Earl attached (yes/no) |  |  |  |
| T4 YouTube in Chrome: stutter? fps / visible / hidden events |  |  |  |
| T4 Teams preview kept moving (yes/no/skipped) |  |  |  |
| T4 focus page rAF frames/s under Earl |  |  |  |
| T5 PresentMode, Earl quit (baseline) | (same for both) |  |  |
| T5 PresentMode, Earl walking |  |  |  |
| T5 PresentMode, Earl hidden from tray |  |  |  |
| T5 game (optional): baseline / Earl walking |  |  |  |
| T6 stats panel: rAF fps / repaints/s / region IPC/s |  |  |  |
| T7 feet on the taskbar (exact / floating / sinking) |  |  |  |
| Anything else odd (crashes, black screen, cursor issues) |  |  |  |

---

## 5. How the results are used

- **D13 (window size):** if T5 shows `Independent Flip` with Earl visible
  (same as the baseline) and T1 idle cost is small, v2 keeps the single
  full-screen overlay. If Earl turns fullscreen video into `Composed`, or
  idle GPU is clearly higher than the baseline, v2 switches to a
  bottom-band or Earl-sized window (at least while something is fullscreen).
- **D14 (drawing mode):** whichever mode is cheaper in T1 and T6 without
  new problems in T2 to T5 is the only one built. Layers is expected to win.
- T2, T3 and T4 problems are bugs to design around in M1, not reasons to
  change D13 or D14 on their own; note them anyway.

When done, quit the spike from the tray and delete the folder. It installs
nothing unless you used the setup exe (then uninstall "Earl Spike" from
Settings > Apps).
