#!/usr/bin/env python3
"""
Dictabird desktop processor — local, private transcription (+ optional diarization).

Workflow:
  1. Record on iPhone with Voice Memos
  2. AirDrop / Files / cable → this PC
  3. Run this script (uses YOUR machine only — no cloud STT)
  4. Import the .dictabird.json into Dictabird (or paste the .md)

Requires: Python 3.10+, ffmpeg on PATH (for .m4a from Voice Memos)
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import wave
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1


@dataclass
class Segment:
    speaker: str
    start: float
    end: float
    text: str


def die(msg: str, code: int = 1) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        die(
            "ffmpeg not found on PATH.\n"
            "  Voice Memos use .m4a — ffmpeg is required to decode them.\n"
            "  Install options (Windows):\n"
            "    winget install Gyan.FFmpeg\n"
            "    choco install ffmpeg\n"
            "  Then reopen the terminal and retry."
        )


def ensure_wav(src: Path, work: Path) -> Path:
    """Convert any audio ffmpeg understands to 16 kHz mono WAV."""
    if src.suffix.lower() == ".wav":
        # Still normalize for whisper consistency
        pass
    out = work / f"{src.stem}.16k.wav"
    if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
        return out

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(out),
    ]
    print(f"→ converting to 16 kHz mono WAV via ffmpeg…")
    try:
        subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        die(f"ffmpeg failed:\n{e.stderr or e.stdout or e}")
    return out


def format_ts(seconds: float) -> str:
    s = max(0, int(seconds))
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h:d}:{m:02d}:{sec:02d}"
    return f"{m:d}:{sec:02d}"


def transcribe_faster_whisper(
    wav: Path,
    model_size: str,
    device: str,
    compute_type: str,
    language: str | None,
) -> list[Segment]:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        die(
            "faster-whisper not installed.\n"
            "  cd tools/dictabird-processor\n"
            "  python -m venv .venv\n"
            "  .venv\\Scripts\\activate   # Windows\n"
            "  pip install -r requirements.txt"
        )

    print(f"→ loading Whisper model '{model_size}' ({device}, {compute_type})…")
    model = WhisperModel(model_size, device=device, compute_type=compute_type)

    print("→ transcribing (local)…")
    segments_iter, info = model.transcribe(
        str(wav),
        language=language,
        beam_size=5,
        vad_filter=True,
        word_timestamps=False,
    )
    print(f"  language={info.language!r} probability={info.language_probability:.2f}")

    out: list[Segment] = []
    for seg in segments_iter:
        text = (seg.text or "").strip()
        if not text:
            continue
        out.append(
            Segment(
                speaker="SPEAKER",
                start=float(seg.start or 0),
                end=float(seg.end or 0),
                text=text,
            )
        )
    return out


def try_diarize(
    wav: Path,
    segments: list[Segment],
    hf_token: str | None,
    num_speakers: int | None,
) -> list[Segment]:
    """
    Optional pyannote diarization. Assigns speaker labels to whisper segments
    by majority-overlap. Falls back to original segments on any failure.
    """
    if not hf_token:
        print("→ diarization skipped (set HF_TOKEN or pass --hf-token)")
        return segments

    try:
        import torch
        from pyannote.audio import Pipeline
    except ImportError:
        print(
            "→ diarization skipped (install optional deps):\n"
            "    pip install pyannote.audio torch\n"
            "  Accept model terms at https://huggingface.co/pyannote/speaker-diarization-3.1"
        )
        return segments

    print("→ running pyannote diarization (local)…")
    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )
        if torch.cuda.is_available():
            pipeline.to(torch.device("cuda"))

        kwargs: dict[str, Any] = {}
        if num_speakers is not None:
            kwargs["num_speakers"] = num_speakers

        diarization = pipeline(str(wav), **kwargs)
    except Exception as e:
        print(f"→ diarization failed, keeping unlabeled transcript: {e}")
        return segments

    # Build list of (start, end, speaker)
    turns: list[tuple[float, float, str]] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        turns.append((float(turn.start), float(turn.end), str(speaker)))

    if not turns:
        print("→ diarization produced no turns")
        return segments

    def speaker_for(start: float, end: float) -> str:
        mid = (start + end) / 2
        # Prefer turn covering midpoint; else max overlap
        for a, b, spk in turns:
            if a <= mid <= b:
                return spk
        best_spk = "SPEAKER"
        best_ov = 0.0
        for a, b, spk in turns:
            ov = max(0.0, min(end, b) - max(start, a))
            if ov > best_ov:
                best_ov = ov
                best_spk = spk
        return best_spk

    labeled = [
        Segment(
            speaker=speaker_for(s.start, s.end),
            start=s.start,
            end=s.end,
            text=s.text,
        )
        for s in segments
    ]
    speakers = sorted({s.speaker for s in labeled})
    print(f"  speakers detected: {', '.join(speakers)}")
    return labeled


def to_plain(segments: list[Segment]) -> str:
    return " ".join(s.text for s in segments).strip()


def to_markdown(segments: list[Segment], title: str, source: str) -> str:
    lines = [
        f"# {title}",
        "",
        f"_Source: `{source}` · processed locally by Dictabird processor_",
        "",
    ]
    has_speakers = any(s.speaker not in ("SPEAKER", "") for s in segments)
    if not has_speakers:
        for s in segments:
            lines.append(f"**[{format_ts(s.start)}]** {s.text}")
            lines.append("")
    else:
        for s in segments:
            lines.append(
                f"**[{format_ts(s.start)}–{format_ts(s.end)}] {s.speaker}:** {s.text}"
            )
            lines.append("")
    return "\n".join(lines).strip() + "\n"


def to_dictabird_json(
    segments: list[Segment],
    title: str,
    source: str,
    model: str,
    diarized: bool,
) -> dict[str, Any]:
    plain = to_plain(segments)
    # Human-readable transcript with speakers for the Dictabird transcript field
    if diarized:
        transcript_lines = [
            f"[{format_ts(s.start)}] {s.speaker}: {s.text}" for s in segments
        ]
        transcript = "\n".join(transcript_lines)
    else:
        transcript = plain

    return {
        "schemaVersion": SCHEMA_VERSION,
        "app": "dictabird-processor",
        "title": title,
        "sourceFile": source,
        "processedAt": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "diarized": diarized,
        "transcript": transcript,
        "segments": [
            {
                "speaker": s.speaker,
                "start": round(s.start, 3),
                "end": round(s.end, 3),
                "text": s.text,
            }
            for s in segments
        ],
    }


def audio_duration_sec(wav: Path) -> float:
    try:
        with wave.open(str(wav), "rb") as w:
            return w.getnframes() / float(w.getframerate())
    except Exception:
        return 0.0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Local private transcription for Dictabird (Voice Memos → desktop)."
    )
    parser.add_argument(
        "audio",
        type=Path,
        help="Audio file (.m4a, .mp3, .wav, .webm, …)",
    )
    parser.add_argument(
        "-o",
        "--out-dir",
        type=Path,
        default=None,
        help="Output directory (default: next to the audio file)",
    )
    parser.add_argument(
        "--model",
        default="base",
        help="Whisper model size: tiny, base, small, medium, large-v3 (default: base)",
    )
    parser.add_argument(
        "--device",
        default="cpu",
        choices=["cpu", "cuda", "auto"],
        help="Inference device (default: cpu)",
    )
    parser.add_argument(
        "--compute-type",
        default=None,
        help="faster-whisper compute type (default: int8 on cpu, float16 on cuda)",
    )
    parser.add_argument(
        "--language",
        default=None,
        help="Force language code (e.g. en). Default: auto-detect",
    )
    parser.add_argument(
        "--title",
        default=None,
        help="Meeting title for import JSON",
    )
    parser.add_argument(
        "--diarize",
        action="store_true",
        help="Run local speaker diarization (needs pyannote + HF_TOKEN)",
    )
    parser.add_argument(
        "--hf-token",
        default=None,
        help="Hugging Face token (or set HF_TOKEN env var)",
    )
    parser.add_argument(
        "--num-speakers",
        type=int,
        default=None,
        help="Hint number of speakers for diarization",
    )
    args = parser.parse_args()

    audio: Path = args.audio.expanduser().resolve()
    if not audio.is_file():
        die(f"file not found: {audio}")

    check_ffmpeg()

    out_dir: Path = (args.out_dir or audio.parent).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    work = out_dir / ".dictabird-work"
    work.mkdir(exist_ok=True)

    device = args.device
    if device == "auto":
        try:
            import torch

            device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device = "cpu"

    compute_type = args.compute_type
    if not compute_type:
        compute_type = "float16" if device == "cuda" else "int8"

    import os

    hf_token = args.hf_token or os.environ.get("HF_TOKEN") or os.environ.get(
        "HUGGING_FACE_HUB_TOKEN"
    )

    print(f"Dictabird processor")
    print(f"  input:  {audio}")
    print(f"  output: {out_dir}")
    print()

    wav = ensure_wav(audio, work)
    dur = audio_duration_sec(wav)
    if dur:
        print(f"  duration ≈ {format_ts(dur)}")

    segments = transcribe_faster_whisper(
        wav,
        model_size=args.model,
        device=device,
        compute_type=compute_type,
        language=args.language,
    )
    if not segments:
        die("no speech detected in audio")

    diarized = False
    if args.diarize:
        labeled = try_diarize(wav, segments, hf_token, args.num_speakers)
        diarized = any(s.speaker not in ("SPEAKER", "") for s in labeled)
        segments = labeled

    title = args.title or audio.stem.replace("_", " ").replace("-", " ")
    stem = audio.stem

    payload = to_dictabird_json(
        segments,
        title=title,
        source=audio.name,
        model=args.model,
        diarized=diarized,
    )
    md = to_markdown(segments, title=title, source=audio.name)
    plain = to_plain(segments)

    json_path = out_dir / f"{stem}.dictabird.json"
    md_path = out_dir / f"{stem}.dictabird.md"
    txt_path = out_dir / f"{stem}.dictabird.txt"

    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    md_path.write_text(md, encoding="utf-8")
    txt_path.write_text(plain + "\n", encoding="utf-8")

    print()
    print("✓ done (all processing was local)")
    print(f"  → {json_path.name}   ← import this in Dictabird")
    print(f"  → {md_path.name}")
    print(f"  → {txt_path.name}")
    if not diarized:
        print()
        print("tip: for speaker labels, install pyannote and re-run with:")
        print("  python process.py your.m4a --diarize --hf-token hf_xxx --num-speakers 2")
    print()
    print("In Dictabird: open a meeting → More → Import processed transcript")


if __name__ == "__main__":
    main()
