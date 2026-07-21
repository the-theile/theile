# Dictabird desktop processor

Local, private transcription for meeting audio (Voice Memos → your PC).  
**Audio never leaves your machine.** No server GPU required.

## Your plan (correct)

1. **iPhone:** Record with **Voice Memos** only (don’t also run Dictabird Transcribe — only one app can use the mic).
2. **During the call (optional):** Use Dictabird for **typed notes only**.
3. **After:** AirDrop / Files / cable the `.m4a` to this PC.
4. **Desktop:** Run this processor → get `.dictabird.json`.
5. **Dictabird:** Open meeting → **More → Import processed transcript** → **Enhance**.

## Requirements

| Tool | Why |
| --- | --- |
| **Python 3.10–3.12** (recommended) | Runtime (`python --version`) |
| **ffmpeg** | Decode Voice Memo `.m4a` |
| **Disk + time** | First run downloads a Whisper model |

### Install ffmpeg (Windows)

```powershell
winget install Gyan.FFmpeg
```

Close and reopen the terminal, then check: `ffmpeg -version`.

### Install the processor

```powershell
cd path\to\theile\tools\dictabird-processor
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## GUI (recommended for routine use)

Double-click:

```
Launch Dictabird Processor.bat
```

Or:

```powershell
cd tools\dictabird-processor
.\.venv\Scripts\activate
python gui.py
```

The app walks you through:

1. **Choose recording** (Voice Memo `.m4a`)
2. **Name & quality** (Recommended / Faster / Highest + optional speaker labels)
3. **Create transcript** (runs only on your PC)
4. **Import** the `.dictabird.json` in Dictabird → **More → Import processed transcript** → Enhance

Tips are built into the window. Expand “Show technical log” only if something fails.

## CLI

```powershell
# Activate venv first
.\.venv\Scripts\activate

# Basic (good default)
python process.py "C:\Users\you\Downloads\Meeting.m4a"

# Better accuracy (slower, larger download)
python process.py ".\Meeting.m4a" --model small

# NVIDIA GPU if you have CUDA torch set up
python process.py ".\Meeting.m4a" --device cuda --model medium

# Optional speaker diarization (see below)
python process.py ".\Meeting.m4a" --diarize --hf-token hf_... --num-speakers 2
```

Outputs (next to the audio, or `-o DIR`):

| File | Use |
| --- | --- |
| `*.dictabird.json` | **Import into Dictabird** |
| `*.dictabird.md` | Readable labeled transcript |
| `*.dictabird.txt` | Plain text |

## Models (Whisper)

| `--model` | Speed | Quality | Notes |
| --- | --- | --- | --- |
| `tiny` / `base` | Fast | OK | Default `base` is fine to start |
| `small` | Medium | Good | Nice upgrade for client calls |
| `medium` / `large-v3` | Slow on CPU | Best | Prefer GPU |

## Optional: speaker diarization (who spoke)

1. Create a free token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Accept terms for [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
3. Install extras:

```powershell
pip install pyannote.audio torch
```

4. Run with `--diarize --hf-token hf_...` (or set env `HF_TOKEN`).

Without diarization you still get a full transcript—just one continuous speaker stream.

## Privacy

- Transcription runs **only on this computer**.
- No audio upload to Dictabird’s web server or third-party STT.
- Dictabird **Enhance** still sends *text* (notes + transcript) to your configured LLM (Groq/Gemini/xAI).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `ffmpeg not found` | Install ffmpeg, new terminal |
| `faster-whisper not installed` | Activate venv + `pip install -r requirements.txt` |
| Slow on first run | Model download; later runs are faster |
| Python 3.14 install errors | Use 3.11/3.12 venv |
| Diarization model gated | Accept HF model terms + valid token |
