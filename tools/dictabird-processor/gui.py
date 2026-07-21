#!/usr/bin/env python3
"""
Dictabird Processor — friendly desktop UI for Voice Memo → transcript.

Double-click "Launch Dictabird Processor.bat" or:  .venv\\Scripts\\python gui.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path
from tkinter import (
    BooleanVar,
    Canvas,
    StringVar,
    Tk,
    filedialog,
    messagebox,
    ttk,
)
from tkinter.scrolledtext import ScrolledText

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from process import ProcessError, run_job  # noqa: E402

SETTINGS_PATH = ROOT / ".gui-settings.json"
DICTABIRD_URL = os.environ.get("DICTABIRD_URL", "https://theile.me/dictabird")

# Brand palette (site / Flintstones-adjacent)
BG = "#0B2545"
BG2 = "#12345F"
BG3 = "#0E2E52"
FG = "#F5F8FB"
MUTED = "#9FB3C8"
AMBER = "#E8A33D"
LINE = "#7FA8C9"
OK = "#7DCEA0"
CARD_BORDER = "#1a4a72"

# Friendly quality → Whisper model
QUALITY_MAP = {
    "Faster — good for short notes": "base",
    "Recommended — best for most meetings": "small",
    "Highest quality — slower, better for important calls": "medium",
}
QUALITY_REVERSE = {v: k for k, v in QUALITY_MAP.items()}


def draw_dictabird_logo(canvas: Canvas, x: int = 32, y: int = 32, scale: float = 1.0) -> None:
    """Simple branded prehistoric parrot mark on a Canvas."""
    s = scale

    def o(dx: float, dy: float) -> tuple[float, float]:
        return x + dx * s, y + dy * s

    # Badge disc
    canvas.create_oval(
        x - 30 * s, y - 30 * s, x + 30 * s, y + 30 * s,
        fill=BG3, outline=AMBER, width=2,
    )
    # Tail
    canvas.create_polygon(
        *o(-22, 4), *o(-8, 2), *o(-18, 14),
        fill="#C45C26", outline="",
    )
    canvas.create_polygon(
        *o(-20, 8), *o(-6, 8), *o(-16, 16),
        fill=AMBER, outline="",
    )
    # Body
    canvas.create_oval(
        *o(-16, -2), *o(8, 22),
        fill="#3D8BC4", outline="",
    )
    # Wing accent
    canvas.create_oval(
        *o(-14, 2), *o(0, 16),
        fill="#1E4F75", outline="",
    )
    # Head
    canvas.create_oval(
        *o(0, -16), *o(22, 6),
        fill="#3D8BC4", outline="",
    )
    # Crest spikes
    for pts in (
        (o(2, -12), o(6, -28), o(10, -10)),
        (o(8, -14), o(14, -30), o(16, -12)),
        (o(14, -12), o(22, -26), o(20, -10)),
    ):
        canvas.create_polygon(*pts[0], *pts[1], *pts[2], fill=AMBER, outline="")
    # Beak
    canvas.create_polygon(
        *o(18, -2), *o(34, 2), *o(18, 6),
        fill=AMBER, outline="",
    )
    canvas.create_polygon(
        *o(18, 4), *o(30, 8), *o(18, 8),
        fill="#C45C26", outline="",
    )
    # Eye
    canvas.create_oval(*o(8, -8), *o(16, 0), fill=FG, outline="")
    canvas.create_oval(*o(11, -6), *o(15, -2), fill=BG, outline="")
    canvas.create_oval(*o(12.5, -5.5), *o(14, -4), fill=FG, outline="")


class ProcessorApp:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("Dictabird — Meeting processor")
        self.root.minsize(640, 760)
        self.root.geometry("700x820")
        self.root.configure(bg=BG)

        self.audio = StringVar()
        self.out_dir = StringVar()
        self.title_var = StringVar()
        self.quality = StringVar(value="Recommended — best for most meetings")
        self.device = StringVar(value="This computer (CPU)")
        self.diarize = BooleanVar(value=False)
        self.hf_token = StringVar(value=os.environ.get("HF_TOKEN", ""))
        self.num_speakers = StringVar(value="2")
        self.status = StringVar(
            value="Start with Step 1 — choose a Voice Memo from your phone"
        )
        self.busy = False
        self.details_open = BooleanVar(value=False)
        self.last_json: Path | None = None
        self.last_result_title = ""

        self._load_settings()
        self._build_style()
        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── style ──────────────────────────────────────────────
    def _build_style(self) -> None:
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure(".", background=BG, foreground=FG, fieldbackground=BG3)
        style.configure("TFrame", background=BG)
        style.configure("Card.TFrame", background=BG2)
        style.configure("TLabel", background=BG, foreground=FG, font=("Segoe UI", 10))
        style.configure(
            "Muted.TLabel", background=BG, foreground=MUTED, font=("Segoe UI", 9)
        )
        style.configure(
            "Card.TLabel", background=BG2, foreground=FG, font=("Segoe UI", 10)
        )
        style.configure(
            "CardMuted.TLabel",
            background=BG2,
            foreground=MUTED,
            font=("Segoe UI", 9),
        )
        style.configure(
            "Step.TLabel",
            background=BG2,
            foreground=AMBER,
            font=("Segoe UI Semibold", 9),
        )
        style.configure(
            "StepTitle.TLabel",
            background=BG2,
            foreground=FG,
            font=("Segoe UI Semibold", 12),
        )
        style.configure(
            "Title.TLabel",
            background=BG,
            foreground=FG,
            font=("Segoe UI Semibold", 18),
        )
        style.configure(
            "Tagline.TLabel",
            background=BG,
            foreground=AMBER,
            font=("Segoe UI", 10),
        )
        style.configure("TButton", font=("Segoe UI", 10), padding=8)
        style.configure(
            "Accent.TButton", font=("Segoe UI Semibold", 12), padding=(16, 12)
        )
        style.configure(
            "TCheckbutton", background=BG2, foreground=FG, font=("Segoe UI", 10)
        )
        style.configure(
            "Root.TCheckbutton", background=BG, foreground=FG, font=("Segoe UI", 10)
        )
        style.configure(
            "TEntry", fieldbackground=BG3, foreground=FG, insertcolor=FG
        )
        style.configure("TCombobox", fieldbackground=BG3, foreground=FG)
        style.map("TCombobox", fieldbackground=[("readonly", BG3)])
        style.configure(
            "Horizontal.TProgressbar", troughcolor=BG3, background=AMBER
        )
        style.configure(
            "Success.TLabel",
            background=BG2,
            foreground=OK,
            font=("Segoe UI Semibold", 11),
        )

    def _card(self, parent: ttk.Frame, **pack) -> ttk.Frame:
        wrap = ttk.Frame(parent, style="TFrame")
        wrap.pack(fill="x", **pack)
        # Outer accent bar via padding frame
        card = ttk.Frame(wrap, style="Card.TFrame", padding=14)
        card.pack(fill="x")
        return card

    def _build_ui(self) -> None:
        outer = ttk.Frame(self.root, style="TFrame")
        outer.pack(fill="both", expand=True, padx=18, pady=14)

        # ── Brand header ──
        head = ttk.Frame(outer, style="TFrame")
        head.pack(fill="x", pady=(0, 12))
        logo = Canvas(
            head, width=64, height=64, bg=BG, highlightthickness=0, bd=0
        )
        logo.pack(side="left", padx=(0, 12))
        draw_dictabird_logo(logo, 32, 32, 1.0)

        titles = ttk.Frame(head, style="TFrame")
        titles.pack(side="left", fill="x", expand=True)
        ttk.Label(titles, text="Dictabird", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            titles,
            text="A prehistoric parrot for modern meetings",
            style="Tagline.TLabel",
        ).pack(anchor="w")
        ttk.Label(
            titles,
            text="Turn a Voice Memo into a transcript you can import — private, on this PC only.",
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(4, 0))

        # ── How it works strip ──
        tips = self._card(outer, pady=(0, 10))
        ttk.Label(tips, text="HOW TO USE (ROUTINE)", style="Step.TLabel").pack(
            anchor="w"
        )
        ttk.Label(
            tips,
            text=(
                "1. On your phone: record with Voice Memos only (don’t also open live Transcribe — "
                "only one app can use the mic).\n"
                "2. Optional: type sparse notes in Dictabird during the call.\n"
                "3. AirDrop / cable the .m4a here → process below.\n"
                "4. In Dictabird: open the meeting → More → Import processed transcript → Enhance."
            ),
            style="CardMuted.TLabel",
            justify="left",
            wraplength=620,
        ).pack(anchor="w", pady=(6, 0))

        # ── Step 1 ──
        s1 = self._card(outer, pady=(0, 8))
        ttk.Label(s1, text="STEP 1", style="Step.TLabel").pack(anchor="w")
        ttk.Label(s1, text="Choose your recording", style="StepTitle.TLabel").pack(
            anchor="w", pady=(2, 6)
        )
        ttk.Label(
            s1,
            text="Usually a Voice Memo (.m4a) from your iPhone Downloads or AirDrop folder.",
            style="CardMuted.TLabel",
            wraplength=620,
        ).pack(anchor="w")

        row = ttk.Frame(s1, style="Card.TFrame")
        row.pack(fill="x", pady=(10, 0))
        row.columnconfigure(0, weight=1)
        self.audio_entry = ttk.Entry(row, textvariable=self.audio)
        self.audio_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        ttk.Button(row, text="Choose file…", command=self._pick_audio).grid(
            row=0, column=1
        )
        self.file_hint = ttk.Label(s1, text="", style="CardMuted.TLabel")
        self.file_hint.pack(anchor="w", pady=(6, 0))

        # ── Step 2 ──
        s2 = self._card(outer, pady=(0, 8))
        ttk.Label(s2, text="STEP 2", style="Step.TLabel").pack(anchor="w")
        ttk.Label(
            s2, text="Name & quality (optional tweaks)", style="StepTitle.TLabel"
        ).pack(anchor="w", pady=(2, 6))

        ttk.Label(s2, text="Meeting name", style="Card.TLabel").pack(anchor="w")
        ttk.Entry(s2, textvariable=self.title_var).pack(fill="x", pady=(2, 8))

        grid = ttk.Frame(s2, style="Card.TFrame")
        grid.pack(fill="x")
        grid.columnconfigure(0, weight=1)
        grid.columnconfigure(1, weight=1)

        left = ttk.Frame(grid, style="Card.TFrame")
        left.grid(row=0, column=0, sticky="ew", padx=(0, 10))
        ttk.Label(left, text="Accuracy", style="Card.TLabel").pack(anchor="w")
        ttk.Combobox(
            left,
            textvariable=self.quality,
            values=list(QUALITY_MAP.keys()),
            state="readonly",
        ).pack(fill="x", pady=(2, 4))
        ttk.Label(
            left,
            text="First run downloads a model (once). “Recommended” is the sweet spot.",
            style="CardMuted.TLabel",
            wraplength=280,
        ).pack(anchor="w")

        right = ttk.Frame(grid, style="Card.TFrame")
        right.grid(row=0, column=1, sticky="ew")
        ttk.Label(right, text="Run on", style="Card.TLabel").pack(anchor="w")
        ttk.Combobox(
            right,
            textvariable=self.device,
            values=[
                "This computer (CPU)",
                "NVIDIA GPU (if set up)",
                "Auto-detect",
            ],
            state="readonly",
        ).pack(fill="x", pady=(2, 4))
        ttk.Label(
            right,
            text="CPU is fine. GPU is faster if you already installed CUDA Torch.",
            style="CardMuted.TLabel",
            wraplength=280,
        ).pack(anchor="w")

        ttk.Label(s2, text="Save results to (optional)", style="Card.TLabel").pack(
            anchor="w", pady=(10, 0)
        )
        out_row = ttk.Frame(s2, style="Card.TFrame")
        out_row.pack(fill="x", pady=(2, 0))
        out_row.columnconfigure(0, weight=1)
        ttk.Entry(out_row, textvariable=self.out_dir).grid(
            row=0, column=0, sticky="ew", padx=(0, 8)
        )
        ttk.Button(out_row, text="Folder…", command=self._pick_out).grid(
            row=0, column=1
        )
        ttk.Label(
            s2,
            text="Leave blank to save next to the audio file. You’ll get a .dictabird.json for import.",
            style="CardMuted.TLabel",
            wraplength=620,
        ).pack(anchor="w", pady=(4, 0))

        # Speakers
        sp = ttk.Frame(s2, style="Card.TFrame")
        sp.pack(fill="x", pady=(12, 0))
        ttk.Checkbutton(
            sp,
            text="Label who spoke (Speaker 1 / Speaker 2) — optional, a bit slower",
            variable=self.diarize,
            command=self._toggle_diarize,
        ).pack(anchor="w")
        ttk.Label(
            sp,
            text="Great for client calls. Needs the free Hugging Face setup you already did (pyannote).",
            style="CardMuted.TLabel",
            wraplength=620,
        ).pack(anchor="w", pady=(2, 0))

        self.diarize_frame = ttk.Frame(s2, style="Card.TFrame")
        dgrid = ttk.Frame(self.diarize_frame, style="Card.TFrame")
        dgrid.pack(fill="x", pady=(8, 0))
        dgrid.columnconfigure(0, weight=1)
        ttk.Label(
            dgrid, text="Hugging Face token (kept on this PC only)", style="Card.TLabel"
        ).grid(row=0, column=0, sticky="w")
        ttk.Label(dgrid, text="How many people?", style="Card.TLabel").grid(
            row=0, column=1, sticky="w", padx=(12, 0)
        )
        ttk.Entry(dgrid, textvariable=self.hf_token, show="•").grid(
            row=1, column=0, sticky="ew", padx=(0, 12), pady=(2, 0)
        )
        ttk.Combobox(
            dgrid,
            textvariable=self.num_speakers,
            values=["2", "3", "4", "5"],
            width=6,
            state="readonly",
        ).grid(row=1, column=1, sticky="w", pady=(2, 0))
        ttk.Label(
            self.diarize_frame,
            text="Tip: for you + one client, leave “2”. Labels are SPEAKER_00 / SPEAKER_01 — rename them mentally or in the transcript.",
            style="CardMuted.TLabel",
            wraplength=620,
        ).pack(anchor="w", pady=(6, 0))
        self._toggle_diarize()

        # ── Step 3 ──
        s3 = self._card(outer, pady=(0, 8))
        ttk.Label(s3, text="STEP 3", style="Step.TLabel").pack(anchor="w")
        ttk.Label(s3, text="Process on this computer", style="StepTitle.TLabel").pack(
            anchor="w", pady=(2, 6)
        )
        ttk.Label(
            s3,
            text="A 30–60 minute memo can take a few minutes on CPU. Keep this window open. "
            "Nothing is uploaded — transcription runs only on your machine.",
            style="CardMuted.TLabel",
            wraplength=620,
        ).pack(anchor="w")

        actions = ttk.Frame(s3, style="Card.TFrame")
        actions.pack(fill="x", pady=(12, 0))
        self.run_btn = ttk.Button(
            actions,
            text="Create transcript",
            style="Accent.TButton",
            command=self._start,
        )
        self.run_btn.pack(side="left")
        ttk.Button(actions, text="Open results folder", command=self._open_out).pack(
            side="left", padx=8
        )
        ttk.Button(actions, text="Open Dictabird", command=self._open_dictabird).pack(
            side="left"
        )

        self.progress = ttk.Progressbar(s3, mode="indeterminate")
        self.progress.pack(fill="x", pady=(12, 4))
        ttk.Label(s3, textvariable=self.status, style="CardMuted.TLabel").pack(
            anchor="w"
        )

        # ── Step 4 / success panel ──
        self.success = self._card(outer, pady=(0, 8))
        ttk.Label(self.success, text="STEP 4", style="Step.TLabel").pack(anchor="w")
        self.success_title = ttk.Label(
            self.success,
            text="Import into Dictabird when ready",
            style="StepTitle.TLabel",
        )
        self.success_title.pack(anchor="w", pady=(2, 6))
        self.success_body = ttk.Label(
            self.success,
            text=(
                "After processing finishes, import the file ending in .dictabird.json:\n"
                "Dictabird → open (or start) the meeting → More → Import processed transcript → Enhance.\n\n"
                "Your typed notes + this transcript give the best summary."
            ),
            style="CardMuted.TLabel",
            wraplength=620,
            justify="left",
        )
        self.success_body.pack(anchor="w")
        self.success_actions = ttk.Frame(self.success, style="Card.TFrame")
        self.success_actions.pack(fill="x", pady=(10, 0))
        ttk.Button(
            self.success_actions,
            text="Copy path to import file",
            command=self._copy_json_path,
        ).pack(side="left")
        ttk.Button(
            self.success_actions,
            text="Open Dictabird to import",
            command=self._open_dictabird,
        ).pack(side="left", padx=8)

        # Details (technical log, collapsed by default)
        det = ttk.Frame(outer, style="TFrame")
        det.pack(fill="both", expand=True, pady=(4, 0))
        ttk.Checkbutton(
            det,
            text="Show technical log (if something fails)",
            variable=self.details_open,
            command=self._toggle_details,
            style="Root.TCheckbutton",
        ).pack(anchor="w")

        self.log_frame = ttk.Frame(det, style="TFrame")
        self.log = ScrolledText(
            self.log_frame,
            height=10,
            bg="#071A30",
            fg=FG,
            insertbackground=FG,
            font=("Cascadia Mono", 9),
            relief="flat",
            borderwidth=0,
        )
        self.log.pack(fill="both", expand=True, pady=(6, 0))
        self.log.configure(state="disabled")
        self._toggle_details()

        ttk.Label(
            outer,
            text="Dictabird · local processor · audio never leaves this PC",
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(8, 0))

    def _toggle_diarize(self) -> None:
        if self.diarize.get():
            self.diarize_frame.pack(fill="x", pady=(4, 0))
        else:
            self.diarize_frame.pack_forget()

    def _toggle_details(self) -> None:
        if self.details_open.get():
            self.log_frame.pack(fill="both", expand=True)
        else:
            self.log_frame.pack_forget()

    def _pick_audio(self) -> None:
        path = filedialog.askopenfilename(
            title="Choose your Voice Memo or meeting recording",
            filetypes=[
                ("Voice Memos & audio", "*.m4a *.mp3 *.wav *.webm *.ogg *.flac *.aac"),
                ("All files", "*.*"),
            ],
        )
        if not path:
            return
        self.audio.set(path)
        p = Path(path)
        if not self.out_dir.get():
            self.out_dir.set(str(p.parent))
        if not self.title_var.get().strip():
            self.title_var.set(p.stem.replace("_", " ").replace("-", " "))
        size_mb = p.stat().st_size / (1024 * 1024)
        self.file_hint.configure(
            text=f"Selected: {p.name}  ·  {size_mb:.1f} MB  ·  ready for Step 3"
        )
        self.status.set("File ready — adjust Step 2 if you want, then Create transcript")

    def _pick_out(self) -> None:
        path = filedialog.askdirectory(title="Where should we save the transcript?")
        if path:
            self.out_dir.set(path)

    def _device_code(self) -> str:
        d = self.device.get()
        if "GPU" in d:
            return "cuda"
        if "Auto" in d:
            return "auto"
        return "cpu"

    def _model_code(self) -> str:
        return QUALITY_MAP.get(self.quality.get(), "small")

    def _append_log(self, msg: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", msg + ("\n" if not msg.endswith("\n") else ""))
        self.log.see("end")
        self.log.configure(state="disabled")

    def _ui_log(self, msg: str) -> None:
        self.root.after(0, lambda m=msg: self._append_log(m))

    def _start(self) -> None:
        if self.busy:
            return
        audio = self.audio.get().strip()
        if not audio:
            messagebox.showinfo(
                "Almost there",
                "Step 1: choose your Voice Memo (.m4a) first.\n\n"
                "Tip: after AirDrop, check Downloads or the folder Finder/Files shows.",
            )
            return
        if not Path(audio).is_file():
            messagebox.showerror(
                "File not found",
                f"Can’t find that recording:\n{audio}\n\nPick the file again with Choose file…",
            )
            return
        if self.diarize.get() and not self.hf_token.get().strip():
            if not messagebox.askyesno(
                "Speaker labels",
                "You turned on “Label who spoke” but no Hugging Face token is filled in.\n\n"
                "Continue without speaker labels?\n\n"
                "(You can paste your HF token under Step 2 and try again.)",
            ):
                return
            # continue but turn off diarize for this run
            use_diarize = False
        else:
            use_diarize = self.diarize.get()

        self.busy = True
        self.run_btn.configure(state="disabled", text="Working…")
        self.progress.start(12)
        self.status.set(
            "Transcribing on this PC… first time may download a model (one-time)."
        )
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")
        if use_diarize or True:
            # Always allow opening log if user wants
            pass
        self._save_settings()

        num_spk = None
        ns = self.num_speakers.get().strip()
        if ns.isdigit():
            num_spk = int(ns)

        kwargs = dict(
            audio=audio,
            out_dir=self.out_dir.get().strip() or None,
            model=self._model_code(),
            device=self._device_code(),
            language=None,
            title=self.title_var.get().strip() or None,
            diarize=use_diarize,
            hf_token=self.hf_token.get().strip() or None,
            num_speakers=num_spk,
            log=self._ui_log,
        )

        def worker() -> None:
            try:
                result = run_job(**kwargs)
                self.last_json = result.json_path
                self.last_result_title = result.title

                def done() -> None:
                    self.busy = False
                    self.run_btn.configure(state="normal", text="Create transcript")
                    self.progress.stop()
                    speakers = (
                        " · speakers labeled"
                        if result.diarized
                        else " · single transcript stream"
                    )
                    self.status.set(
                        f"Done — {result.segment_count} segments{speakers}"
                    )
                    self.success_title.configure(
                        text="You’re ready for Dictabird ✓",
                        style="Success.TLabel",
                    )
                    self.success_body.configure(
                        text=(
                            f"Import this file into Dictabird:\n"
                            f"{result.json_path}\n\n"
                            f"1. Open Dictabird and sign in\n"
                            f"2. Open the meeting (or start one — “{result.title}” works)\n"
                            f"3. More → Import processed transcript → pick the .dictabird.json\n"
                            f"4. Enhance — notes + transcript become clean actions\n\n"
                            f"Tip: only one mic at a time on iPhone — next call, record with "
                            f"Voice Memos and type notes only in Dictabird."
                        )
                    )
                    if messagebox.askyesno(
                        "Transcript ready",
                        f"All done — processing stayed on this PC.\n\n"
                        f"Import file:\n{result.json_path.name}\n\n"
                        f"Open the results folder now?",
                    ):
                        self._open_path(result.json_path.parent)

                self.root.after(0, done)
            except ProcessError as e:
                self.root.after(0, lambda: self._fail(str(e)))
            except Exception as e:
                self.root.after(
                    0, lambda: self._fail(f"Something went wrong: {e}")
                )

        threading.Thread(target=worker, daemon=True).start()

    def _fail(self, msg: str) -> None:
        self.busy = False
        self.run_btn.configure(state="normal", text="Create transcript")
        self.progress.stop()
        self.status.set("Couldn’t finish — see tips below")
        self.details_open.set(True)
        self._toggle_details()
        self._append_log("")
        self._append_log("ERROR: " + msg)

        friendly = msg
        if "ffmpeg" in msg.lower():
            friendly = (
                "ffmpeg is missing or not on PATH.\n\n"
                "Voice Memos need ffmpeg to open .m4a files.\n"
                "In PowerShell run:\n  winget install Gyan.FFmpeg\n"
                "Then close and reopen this app."
            )
        elif "faster-whisper" in msg.lower():
            friendly = (
                "Python packages aren’t installed in the app’s environment.\n\n"
                "Double-click Launch Dictabird Processor.bat again, or run:\n"
                "  pip install -r requirements.txt\n"
                "inside the .venv."
            )
        elif "speech" in msg.lower():
            friendly = (
                "No speech was detected.\n\n"
                "Check that the memo isn’t empty or corrupted. "
                "Try playing it in a media player first."
            )
        messagebox.showerror("Couldn’t process recording", friendly)

    def _copy_json_path(self) -> None:
        if not self.last_json:
            messagebox.showinfo(
                "Not yet",
                "Process a recording first — then you can copy the import file path.",
            )
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(str(self.last_json.resolve()))
        self.status.set("Copied import file path — paste is ready")

    def _open_out(self) -> None:
        if self.last_json and self.last_json.parent.is_dir():
            self._open_path(self.last_json.parent)
            return
        out = self.out_dir.get().strip()
        if out and Path(out).is_dir():
            self._open_path(Path(out))
            return
        audio = self.audio.get().strip()
        if audio and Path(audio).is_file():
            self._open_path(Path(audio).parent)
            return
        messagebox.showinfo(
            "Results folder",
            "Process a file first, or set a folder in Step 2.",
        )

    def _open_dictabird(self) -> None:
        webbrowser.open(DICTABIRD_URL)

    @staticmethod
    def _open_path(path: Path) -> None:
        path = path.resolve()
        if sys.platform == "win32":
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)], check=False)
        else:
            subprocess.run(["xdg-open", str(path)], check=False)

    def _load_settings(self) -> None:
        if not SETTINGS_PATH.is_file():
            return
        try:
            data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
            model = data.get("model", "small")
            self.quality.set(
                QUALITY_REVERSE.get(model, "Recommended — best for most meetings")
            )
            dev = data.get("device", "cpu")
            self.device.set(
                {
                    "cpu": "This computer (CPU)",
                    "cuda": "NVIDIA GPU (if set up)",
                    "auto": "Auto-detect",
                }.get(dev, "This computer (CPU)")
            )
            self.diarize.set(bool(data.get("diarize", False)))
            self.out_dir.set(data.get("out_dir", ""))
            self.num_speakers.set(str(data.get("num_speakers", "2")))
            if data.get("remember_token") and data.get("hf_token"):
                self.hf_token.set(data["hf_token"])
            # Prefer env HF_TOKEN if present
            if os.environ.get("HF_TOKEN"):
                self.hf_token.set(os.environ["HF_TOKEN"])
        except Exception:
            pass

    def _save_settings(self) -> None:
        data = {
            "model": self._model_code(),
            "device": self._device_code(),
            "diarize": self.diarize.get(),
            "out_dir": self.out_dir.get(),
            "num_speakers": self.num_speakers.get(),
            "remember_token": False,
        }
        try:
            SETTINGS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception:
            pass

    def _on_close(self) -> None:
        self._save_settings()
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    os.chdir(ROOT)
    ProcessorApp().run()


if __name__ == "__main__":
    main()
