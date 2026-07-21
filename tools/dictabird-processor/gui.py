#!/usr/bin/env python3
"""
Dictabird Processor — desktop GUI for routine Voice Memo → transcript jobs.

Double-click "Launch Dictabird Processor.bat" or run:
  .venv\\Scripts\\python gui.py
"""

from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path
from tkinter import (
    BooleanVar,
    StringVar,
    Tk,
    filedialog,
    messagebox,
    ttk,
)
from tkinter.scrolledtext import ScrolledText

# Ensure we import sibling process.py
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from process import ProcessError, run_job  # noqa: E402

SETTINGS_PATH = ROOT / ".gui-settings.json"
DICTABIRD_URL = os.environ.get("DICTABIRD_URL", "https://theile.me/dictabird")

# Flintstones-adjacent palette (matches site blues / amber)
BG = "#0B2545"
BG2 = "#12345F"
FG = "#F5F8FB"
MUTED = "#9FB3C8"
AMBER = "#E8A33D"
LINE = "#7FA8C9"


class ProcessorApp:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("Dictabird Processor")
        self.root.minsize(560, 620)
        self.root.geometry("640x720")
        self.root.configure(bg=BG)

        self.audio = StringVar()
        self.out_dir = StringVar()
        self.title_var = StringVar()
        self.model = StringVar(value="base")
        self.device = StringVar(value="cpu")
        self.language = StringVar(value="")
        self.diarize = BooleanVar(value=False)
        self.hf_token = StringVar(value=os.environ.get("HF_TOKEN", ""))
        self.num_speakers = StringVar(value="2")
        self.status = StringVar(value="Ready — pick a Voice Memo (.m4a) and click Process")
        self.busy = False
        self.last_json: Path | None = None

        self._load_settings()
        self._build_style()
        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        # Drag-and-drop is OS-specific; file dialog is the reliable default.
        self.root.after(200, self._focus_audio)

    def _build_style(self) -> None:
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure(".", background=BG, foreground=FG, fieldbackground=BG2)
        style.configure("TFrame", background=BG)
        style.configure("Card.TFrame", background=BG2)
        style.configure("TLabel", background=BG, foreground=FG, font=("Segoe UI", 10))
        style.configure("Muted.TLabel", background=BG, foreground=MUTED, font=("Segoe UI", 9))
        style.configure("Card.TLabel", background=BG2, foreground=FG, font=("Segoe UI", 10))
        style.configure("Title.TLabel", background=BG, foreground=FG, font=("Segoe UI Semibold", 16))
        style.configure("Sub.TLabel", background=BG, foreground=AMBER, font=("Segoe UI", 9))
        style.configure("TButton", font=("Segoe UI", 10), padding=8)
        style.configure("Accent.TButton", font=("Segoe UI Semibold", 11), padding=10)
        style.configure("TCheckbutton", background=BG, foreground=FG, font=("Segoe UI", 10))
        style.configure("TEntry", fieldbackground="#0E2E52", foreground=FG, insertcolor=FG)
        style.configure("TCombobox", fieldbackground="#0E2E52", foreground=FG)
        style.map("TCombobox", fieldbackground=[("readonly", "#0E2E52")])
        style.configure("Horizontal.TProgressbar", troughcolor=BG2, background=AMBER)

    def _build_ui(self) -> None:
        pad = {"padx": 16, "pady": 6}
        outer = ttk.Frame(self.root, style="TFrame")
        outer.pack(fill="both", expand=True)

        header = ttk.Frame(outer, style="TFrame")
        header.pack(fill="x", **pad)
        ttk.Label(header, text="Dictabird Processor", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            header,
            text="Voice Memo → local transcript (private) → import into Dictabird",
            style="Sub.TLabel",
        ).pack(anchor="w", pady=(2, 0))

        # Audio file
        card = ttk.Frame(outer, style="Card.TFrame", padding=12)
        card.pack(fill="x", padx=16, pady=8)

        ttk.Label(card, text="Audio file", style="Card.TLabel").grid(row=0, column=0, sticky="w")
        row1 = ttk.Frame(card, style="Card.TFrame")
        row1.grid(row=1, column=0, sticky="ew", pady=(4, 8))
        card.columnconfigure(0, weight=1)
        row1.columnconfigure(0, weight=1)
        e = ttk.Entry(row1, textvariable=self.audio)
        e.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        ttk.Button(row1, text="Browse…", command=self._pick_audio).grid(row=0, column=1)

        ttk.Label(card, text="Output folder (optional)", style="Card.TLabel").grid(
            row=2, column=0, sticky="w"
        )
        row2 = ttk.Frame(card, style="Card.TFrame")
        row2.grid(row=3, column=0, sticky="ew", pady=(4, 8))
        row2.columnconfigure(0, weight=1)
        ttk.Entry(row2, textvariable=self.out_dir).grid(row=0, column=0, sticky="ew", padx=(0, 8))
        ttk.Button(row2, text="Browse…", command=self._pick_out).grid(row=0, column=1)

        ttk.Label(card, text="Meeting title (optional)", style="Card.TLabel").grid(
            row=4, column=0, sticky="w"
        )
        ttk.Entry(card, textvariable=self.title_var).grid(
            row=5, column=0, sticky="ew", pady=(4, 0)
        )

        # Options
        opts = ttk.Frame(outer, style="TFrame")
        opts.pack(fill="x", padx=16, pady=4)

        left = ttk.Frame(opts, style="TFrame")
        left.pack(side="left", fill="x", expand=True, padx=(0, 8))
        right = ttk.Frame(opts, style="TFrame")
        right.pack(side="left", fill="x", expand=True)

        ttk.Label(left, text="Whisper model").pack(anchor="w")
        ttk.Combobox(
            left,
            textvariable=self.model,
            values=["tiny", "base", "small", "medium", "large-v3"],
            state="readonly",
            width=14,
        ).pack(anchor="w", pady=(2, 8))

        ttk.Label(left, text="Device").pack(anchor="w")
        ttk.Combobox(
            left,
            textvariable=self.device,
            values=["cpu", "cuda", "auto"],
            state="readonly",
            width=14,
        ).pack(anchor="w", pady=(2, 8))

        ttk.Label(right, text="Language (blank = auto)").pack(anchor="w")
        ttk.Entry(right, textvariable=self.language, width=16).pack(anchor="w", pady=(2, 8))

        ttk.Checkbutton(
            right,
            text="Diarize speakers (local pyannote)",
            variable=self.diarize,
            command=self._toggle_diarize,
        ).pack(anchor="w", pady=(12, 4))

        self.diarize_frame = ttk.Frame(outer, style="TFrame")
        self.diarize_frame.pack(fill="x", padx=16, pady=2)
        ttk.Label(self.diarize_frame, text="HF token", style="Muted.TLabel").grid(
            row=0, column=0, sticky="w"
        )
        ttk.Entry(self.diarize_frame, textvariable=self.hf_token, show="•", width=40).grid(
            row=1, column=0, sticky="ew", padx=(0, 12)
        )
        ttk.Label(self.diarize_frame, text="# speakers", style="Muted.TLabel").grid(
            row=0, column=1, sticky="w"
        )
        ttk.Entry(self.diarize_frame, textvariable=self.num_speakers, width=6).grid(
            row=1, column=1, sticky="w"
        )
        self.diarize_frame.columnconfigure(0, weight=1)
        self._toggle_diarize()

        # Actions
        actions = ttk.Frame(outer, style="TFrame")
        actions.pack(fill="x", padx=16, pady=10)
        self.run_btn = ttk.Button(
            actions, text="Process audio", style="Accent.TButton", command=self._start
        )
        self.run_btn.pack(side="left")
        ttk.Button(actions, text="Open output folder", command=self._open_out).pack(
            side="left", padx=8
        )
        ttk.Button(actions, text="Open Dictabird", command=self._open_dictabird).pack(
            side="left"
        )

        self.progress = ttk.Progressbar(outer, mode="indeterminate")
        self.progress.pack(fill="x", padx=16, pady=(0, 6))

        ttk.Label(outer, textvariable=self.status, style="Muted.TLabel").pack(
            anchor="w", padx=16
        )

        # Log
        ttk.Label(outer, text="Log", style="Muted.TLabel").pack(anchor="w", padx=16, pady=(8, 0))
        self.log = ScrolledText(
            outer,
            height=16,
            bg="#071A30",
            fg=FG,
            insertbackground=FG,
            font=("Cascadia Mono", 9),
            relief="flat",
            borderwidth=0,
        )
        self.log.pack(fill="both", expand=True, padx=16, pady=(4, 16))
        self.log.configure(state="disabled")

        footer = ttk.Label(
            outer,
            text="Audio stays on this PC · Import the .dictabird.json in Dictabird → More",
            style="Muted.TLabel",
        )
        footer.pack(anchor="w", padx=16, pady=(0, 12))

    def _toggle_diarize(self) -> None:
        if self.diarize.get():
            self.diarize_frame.pack(fill="x", padx=16, pady=2)
        else:
            self.diarize_frame.pack_forget()

    def _focus_audio(self) -> None:
        pass

    def _pick_audio(self) -> None:
        path = filedialog.askopenfilename(
            title="Select Voice Memo / meeting audio",
            filetypes=[
                ("Audio", "*.m4a *.mp3 *.wav *.webm *.ogg *.flac *.aac *.mp4"),
                ("All files", "*.*"),
            ],
        )
        if path:
            self.audio.set(path)
            if not self.out_dir.get():
                self.out_dir.set(str(Path(path).parent))
            if not self.title_var.get():
                self.title_var.set(Path(path).stem.replace("_", " ").replace("-", " "))

    def _pick_out(self) -> None:
        path = filedialog.askdirectory(title="Output folder")
        if path:
            self.out_dir.set(path)

    def _append_log(self, msg: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", msg + ("\n" if not msg.endswith("\n") else ""))
        self.log.see("end")
        self.log.configure(state="disabled")

    def _ui_log(self, msg: str) -> None:
        self.root.after(0, lambda m=msg: self._append_log(m))

    def _set_status(self, msg: str) -> None:
        self.root.after(0, lambda: self.status.set(msg))

    def _start(self) -> None:
        if self.busy:
            return
        audio = self.audio.get().strip()
        if not audio:
            messagebox.showwarning("Missing file", "Choose an audio file first.")
            return
        if not Path(audio).is_file():
            messagebox.showerror("Not found", f"File does not exist:\n{audio}")
            return

        self.busy = True
        self.run_btn.configure(state="disabled")
        self.progress.start(12)
        self.status.set("Processing… first run may download a Whisper model")
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")
        self._save_settings()

        num_spk = None
        ns = self.num_speakers.get().strip()
        if ns.isdigit():
            num_spk = int(ns)

        kwargs = dict(
            audio=audio,
            out_dir=self.out_dir.get().strip() or None,
            model=self.model.get(),
            device=self.device.get(),
            language=self.language.get().strip() or None,
            title=self.title_var.get().strip() or None,
            diarize=self.diarize.get(),
            hf_token=self.hf_token.get().strip() or None,
            num_speakers=num_spk,
            log=self._ui_log,
        )

        def worker() -> None:
            try:
                result = run_job(**kwargs)
                self.last_json = result.json_path

                def done() -> None:
                    self.busy = False
                    self.run_btn.configure(state="normal")
                    self.progress.stop()
                    self.status.set(
                        f"Done · {result.segment_count} segments"
                        + (" · speakers labeled" if result.diarized else "")
                    )
                    if messagebox.askyesno(
                        "Processing complete",
                        f"Transcript ready.\n\n"
                        f"Import file:\n{result.json_path}\n\n"
                        f"Open output folder?",
                    ):
                        self._open_path(result.json_path.parent)

                self.root.after(0, done)
            except ProcessError as e:
                self.root.after(0, lambda: self._fail(str(e)))
            except Exception as e:
                self.root.after(0, lambda: self._fail(f"Unexpected error: {e}"))

        threading.Thread(target=worker, daemon=True).start()

    def _fail(self, msg: str) -> None:
        self.busy = False
        self.run_btn.configure(state="normal")
        self.progress.stop()
        self.status.set("Failed")
        self._append_log("")
        self._append_log("ERROR: " + msg)
        messagebox.showerror("Processing failed", msg)

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
        messagebox.showinfo("Output", "Process a file first, or set an output folder.")

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
            self.model.set(data.get("model", "base"))
            self.device.set(data.get("device", "cpu"))
            self.language.set(data.get("language", ""))
            self.diarize.set(bool(data.get("diarize", False)))
            self.out_dir.set(data.get("out_dir", ""))
            # Don't reload HF token from disk by default for safety — optional
            if data.get("remember_token") and data.get("hf_token"):
                self.hf_token.set(data["hf_token"])
            self.num_speakers.set(str(data.get("num_speakers", "2")))
        except Exception:
            pass

    def _save_settings(self) -> None:
        data = {
            "model": self.model.get(),
            "device": self.device.get(),
            "language": self.language.get(),
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
    # Prefer running from package dir so relative paths work
    os.chdir(ROOT)
    app = ProcessorApp()
    app.run()


if __name__ == "__main__":
    main()
