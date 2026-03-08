<p align="center">
  <h1 align="center">Sarvam Dub</h1>
  <p align="center">Dub videos into 12 Indian languages using Sarvam AI — with voice cloning</p>
</p>

<p align="center">
  <a href="https://github.com/mithun50/sarvam-dub/stargazers"><img src="https://img.shields.io/github/stars/mithun50/sarvam-dub?style=flat-square&color=yellow" alt="Stars"></a>
  <a href="https://github.com/mithun50/sarvam-dub/network/members"><img src="https://img.shields.io/github/forks/mithun50/sarvam-dub?style=flat-square" alt="Forks"></a>
  <a href="https://github.com/mithun50/sarvam-dub/issues"><img src="https://img.shields.io/github/issues/mithun50/sarvam-dub?style=flat-square" alt="Issues"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/mithun50/sarvam-dub?style=flat-square&color=green" alt="License"></a>
  <a href="https://github.com/mithun50/sarvam-dub"><img src="https://img.shields.io/github/repo-size/mithun50/sarvam-dub?style=flat-square" alt="Repo Size"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/languages-12_Indian-blue?style=flat-square" alt="Languages">
  <img src="https://img.shields.io/badge/python-3.8+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/auth-none_required-brightgreen?style=flat-square" alt="No Auth">
  <img src="https://img.shields.io/badge/voice_cloning-enabled-ff6b6b?style=flat-square" alt="Voice Cloning">
  <img src="https://img.shields.io/badge/platform-linux%20%7C%20macos%20%7C%20windows%20%7C%20android-lightgrey?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/dependencies-1_(python)%20%7C%200_(node)-orange?style=flat-square" alt="Deps">
</p>

---

## Features

- **12 Indian Languages** — Assamese, Bengali, English, Gujarati, Hindi, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu
- **Voice Cloning** — Preserves original speaker's voice, tone, and pacing
- **No Authentication** — No API key, no cookies, no signup required
- **CLI + SDK** — Use from terminal or import as a library
- **Python + JavaScript** — Both languages fully supported
- **Zero Dependencies (JS)** — Node.js version uses only built-in modules
- **SRT Subtitle Support** — Upload subtitles for better transcription accuracy
- **Multi-language Dubbing** — Dub to multiple languages in a single job

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [CLI Reference](#cli-reference)
- [SDK Usage](#sdk-usage)
  - [Python SDK](#python-sdk)
  - [JavaScript SDK](#javascript-sdk)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

```bash
# Clone
git clone https://github.com/mithun50/sarvam-dub.git
cd dub

# Python
pip install requests
python dub.py video.mp4 -t Hindi

# Node.js (zero deps)
node dub.js video.mp4 -t Hindi
```

**That's it.** No API keys. No signup. No config.

---

## Installation

### Python

```bash
git clone https://github.com/mithun50/sarvam-dub.git
cd dub
pip install requests
```

### Node.js

```bash
git clone https://github.com/mithun50/sarvam-dub.git
cd dub
# No npm install needed — zero dependencies
```

### Termux (Android)

```bash
pkg install python git
pip install requests
git clone https://github.com/mithun50/sarvam-dub.git
cd dub
python dub.py video.mp4 -t Hindi
```

---

## CLI Reference

```
Usage: python dub.py <video> -t <language> [options]
       node dub.js <video> -t <language> [options]
```

### Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `video` | | *(required)* | Path to video file |
| `--target-lang` | `-t` | *(required)* | Target language(s), comma-separated |
| `--src-lang` | `-s` | `English` | Source language |
| `--speakers` | | `1` | Number of speakers in video |
| `--genre` | `-g` | `podcast` | Content genre |
| `--job-name` | | filename | Custom job name |
| `--output` | `-o` | auto | Output file path |
| `--no-download` | | | Only print the dubbed video URL |
| `--status` | | | Check status of existing job ID |
| `--list` | `-l` | | List all languages and genres |

### Supported Languages

| | | | |
|---|---|---|---|
| Assamese | Bengali | English | Gujarati |
| Hindi | Kannada | Malayalam | Marathi |
| Odia | Punjabi | Tamil | Telugu |

### Supported Genres

| Genre | Best For |
|-------|----------|
| `podcast` | Podcast episodes, interviews, conversations |
| `monologue` | Single speaker narration, vlogs |
| `advertisement` | Ads, promos, commercials |
| `ott_movie_sequence` | Movies, web series, drama clips |
| `edtech` | Educational content, tutorials |
| `academic_lecture_formal` | Formal lectures, presentations, seminars |

---

## SDK Usage

### Python SDK

```python
from sarvam_dub import SarvamDubbing

dub = SarvamDubbing()
```

#### All-in-one (easiest)

```python
result = dub.dub("video.mp4", target_langs=["Hindi"])
print(result.output_path)   # video_Hindi.mp4
print(result.duration)       # 120.5
```

#### With progress tracking

```python
def on_progress(status):
    print(f"[{status.progress:.0f}%] {status.current_step_label}")

result = dub.dub(
    "lecture.mp4",
    target_langs=["Hindi", "Tamil"],
    src_lang="English",
    num_speakers=2,
    genre="edtech",
    on_progress=on_progress,
)
```

#### Step-by-step (full control)

```python
# 1. Create job
job = dub.create_job(
    src_lang="English",
    target_langs=["Bengali"],
    job_name="my_video",
    num_speakers=1,
    genre="podcast",
)

# 2. Upload video
dub.upload(job["upload_url"], "video.mp4")

# 3. Upload subtitles (optional)
dub.upload_srt(job["srt_upload_url"], "subtitles.srt")

# 4. Start processing
dub.start(job["job_id"])

# 5. Wait for completion
status = dub.wait(job["job_id"], on_progress=on_progress)

# 6. Download result
dub.download(status.dubbed_video_url, "output.mp4")
```

#### Python SDK Reference

**`SarvamDubbing(base_url, poll_interval)`**

| Method | Returns | Description |
|--------|---------|-------------|
| `dub(video_path, ...)` | `DubResult` | All-in-one: create, upload, start, wait, download |
| `create_job(...)` | `dict` | Create job, returns `job_id` + `upload_url` |
| `upload(url, path)` | `None` | Upload video to Azure Blob |
| `upload_srt(url, path)` | `None` | Upload SRT subtitles |
| `start(job_id)` | `None` | Start processing |
| `status(job_id)` | `JobStatus` | Get current status |
| `wait(job_id, ...)` | `JobStatus` | Poll until completion |
| `download(url, path)` | `str` | Download dubbed video |

**`JobStatus`**

| Property | Type | Description |
|----------|------|-------------|
| `job_id` | `str` | Job identifier |
| `status` | `str` | `in_progress` / `completed` / `failed` / `partial_failure` |
| `progress` | `float` | 0–100 |
| `current_step_label` | `str` | Human-readable step name |
| `error_message` | `str` | Error details (if failed) |
| `dubbed_video_url` | `str` | Output video URL |
| `duration` | `float` | Video duration in seconds |
| `is_completed` | `bool` | True when done |
| `is_failed` | `bool` | True on failure |
| `is_running` | `bool` | True while processing |

**`DubResult`**

| Property | Type | Description |
|----------|------|-------------|
| `job_id` | `str` | Job identifier |
| `dubbed_url` | `str` | Dubbed video URL |
| `output_path` | `str` | Local file path |
| `duration` | `float` | Duration in seconds |
| `file_size` | `int` | File size in bytes |

**Exceptions:** `SarvamDubbingError`, `JobCreationError`, `UploadError`, `JobStartError`, `JobFailedError`

---

### JavaScript SDK

```javascript
const { SarvamDubbing } = require("./sarvam_dub");

const dub = new SarvamDubbing();
```

#### All-in-one

```javascript
const result = await dub.dub("video.mp4", {
  targetLangs: ["Hindi"],
});
console.log(result.outputPath);
```

#### With progress

```javascript
const result = await dub.dub("video.mp4", {
  targetLangs: ["Hindi", "Tamil"],
  genre: "edtech",
  numSpeakers: 2,
  onProgress: (st) => console.log(`[${st.progress}%] ${st.currentStep}`),
});
```

#### Step-by-step

```javascript
const job = await dub.createJob({
  srcLang: "English",
  targetLangs: ["Bengali"],
  genre: "podcast",
});

await dub.upload(job.upload_url, "video.mp4");
await dub.start(job.job_id);

const status = await dub.wait(job.job_id, {
  onProgress: (st) => console.log(`[${st.progress}%] ${st.currentStep}`),
});

await dub.download(status.dubbedVideoUrl, "output.mp4");
```

#### JavaScript SDK Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `dub(videoPath, opts)` | `Promise<Object>` | All-in-one dubbing |
| `createJob(opts)` | `Promise<Object>` | Create job |
| `upload(url, path)` | `Promise<void>` | Upload video |
| `start(jobId)` | `Promise<void>` | Start processing |
| `status(jobId)` | `Promise<Object>` | Get status |
| `wait(jobId, opts)` | `Promise<Object>` | Poll until done |
| `download(url, path)` | `Promise<string>` | Download result |

---

## API Reference

### Architecture

```
┌──────────┐    ┌───────────────────────────┐    ┌──────────────────┐
│  Client   │───>│  dashboard.sarvam.ai      │───>│  Dubbing Engine  │
│ (CLI/SDK) │    │  /api/dubbing/*           │    │  (Sarvam AI)     │
└──────────┘    └───────────────────────────┘    └──────────────────┘
      │                                                    │
      │         ┌───────────────────────────┐              │
      └────────>│  Azure Blob Storage       │<─────────────┘
                │  (video upload/download)  │
                └───────────────────────────┘
```

### Pipeline

```
Video ──> Create Job ──> Upload ──> Start ──> Poll Status ──> Download
                │                                    │
                └── get upload_url          progress: 8% ──> 25% ──> 50% ──> 75% ──> 95% ──> 100%
                                            step:     Video   Transcribe  Translate  Audio   Export   Done
```

### Endpoints

#### 1. `POST /api/dubbing/jobs` — Create Job

Creates a new dubbing job and returns a presigned upload URL.

<details>
<summary>Request / Response</summary>

**Request:**
```json
{
  "src_lang": "English",
  "target_langs": ["Hindi", "Tamil"],
  "job_name": "my_video",
  "num_speakers": 1,
  "genre": "podcast",
  "editor_flow": false
}
```

**Response `200`:**
```json
{
  "status": "success",
  "message": "Upload job created successfully",
  "data": {
    "job_id": "e95585ed-431e-42c9-b148-fcdc7eb6a45a",
    "upload_url": "https://saasprodstudiopublicsa.blob.core.windows.net/dubbing-storage/...",
    "srt_upload_url": "https://saasprodstudiopublicsa.blob.core.windows.net/dubbing-storage/...",
    "expires_in_hours": 24,
    "youtube_download": false,
    "processing_started": false,
    "voice_cloning": true,
    "voice_id": null,
    "pace_preset": null
  }
}
```

**Error `422`:**
```json
{
  "detail": [{
    "type": "enum",
    "loc": ["body", "src_lang"],
    "msg": "Input should be 'Assamese', 'Bengali', 'English', ..."
  }]
}
```

</details>

#### 2. `PUT <upload_url>` — Upload Video

Upload raw video binary to the presigned Azure Blob URL.

```
Headers:  x-ms-blob-type: BlockBlob
Body:     <raw video bytes>
Response: 201 Created
```

#### 3. `PUT <srt_upload_url>` — Upload SRT *(optional)*

Upload subtitle file for improved transcription.

```
Headers:  x-ms-blob-type: BlockBlob
Body:     <raw SRT bytes>
Response: 201 Created
```

#### 4. `POST /api/dubbing/jobs/{job_id}/start` — Start Processing

Triggers the dubbing pipeline after upload.

#### 5. `GET /api/dubbing/jobs/{job_id}/live-status` — Poll Status

<details>
<summary>Response Schema</summary>

```json
{
  "data": {
    "status": "completed",
    "current_step": "completed",
    "current_step_label": "Completed",
    "progress": 100,
    "error_message": null,
    "job_id": "e95585ed-...",
    "job_name": "my_video",
    "export": {
      "status": "completed",
      "dubbed_video_url": "https://...blob.core.windows.net/...",
      "original_video_url": "https://...blob.core.windows.net/...",
      "duration": 120.5,
      "file_size": 15728640
    }
  }
}
```

</details>

**Status values:** `in_progress` | `completed` | `failed` | `partial_failure`

**Processing steps:**

| Step | Progress | Label |
|------|----------|-------|
| 1 | ~8% | Processing Video |
| 2 | ~25% | Transcribing |
| 3 | ~50% | Translating |
| 4 | ~75% | Generating Audio |
| 5 | ~95% | Exporting Video |
| 6 | 100% | Completed |

#### 6. `GET /api/media-proxy?url=<encoded_url>` — Media Proxy

Proxy for downloading Azure Blob storage URLs.

---

### cURL Examples

```bash
# 1. Create job
curl -X POST https://dashboard.sarvam.ai/api/dubbing/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "src_lang": "English",
    "target_langs": ["Hindi"],
    "job_name": "test",
    "num_speakers": 1,
    "genre": "podcast",
    "editor_flow": false
  }'

# 2. Upload video
curl -X PUT "<upload_url>" \
  -H "x-ms-blob-type: BlockBlob" \
  --data-binary @video.mp4

# 3. Start job
curl -X POST https://dashboard.sarvam.ai/api/dubbing/jobs/<job_id>/start

# 4. Check status
curl https://dashboard.sarvam.ai/api/dubbing/jobs/<job_id>/live-status

# 5. Download result
curl -o dubbed.mp4 "<dubbed_video_url>"
```

---

## Examples

```bash
# Basic — English to Hindi
python dub.py video.mp4 -t Hindi

# Multi-language
python dub.py video.mp4 -t Hindi,Tamil,Telugu,Bengali

# Educational content, 2 speakers
python dub.py lecture.mp4 -t Hindi --speakers 2 --genre edtech

# Movie clip
python dub.py scene.mp4 -t Malayalam --genre ott_movie_sequence

# Advertisement with custom output
python dub.py ad.mp4 -t Gujarati,Marathi --genre advertisement -o ad_dubbed.mp4

# Check existing job
python dub.py --status e95585ed-431e-42c9-b148-fcdc7eb6a45a

# URL only (no download)
python dub.py video.mp4 -t Hindi --no-download

# Node.js — same options
node dub.js video.mp4 -t Hindi --genre podcast
```

---

## Project Structure

```
dub/
├── dub.py              # Python CLI tool
├── dub.js              # Node.js CLI tool
├── sarvam_dub.py       # Python SDK module
├── sarvam_dub.js       # Node.js SDK module
├── requirements.txt    # Python: requests
├── package.json        # Node.js package config
├── LICENSE             # MIT License
├── .gitignore
└── README.md
```

---

## Contributing

1. Fork the repo
2. Create a branch (`git checkout -b feature/amazing`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## Notes

- **No rate limits observed** — be respectful of the service
- **Upload URL expires in 24 hours** — create a new job if expired
- **Voice cloning enabled by default** — preserves original speaker voice
- **SRT upload supported** — improves transcription accuracy
- **Powered by [Sarvam AI](https://www.sarvam.ai)**

---

## License

[MIT](LICENSE) - Mithun Gowda B
