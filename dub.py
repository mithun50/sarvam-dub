#!/usr/bin/env python3
"""
Sarvam AI Video Dubbing CLI Tool
No authentication required!

Usage:
    python dub.py video.mp4 -t Hindi
    python dub.py video.mp4 --src-lang English --target-lang Hindi,Tamil
    python dub.py video.mp4 -t Telugu --speakers 2 --genre podcast
"""

import argparse
import os
import sys
import time
from pathlib import Path

import requests

BASE_URL = "https://dashboard.sarvam.ai"
API_DUBBING = f"{BASE_URL}/api/dubbing"

SUPPORTED_LANGUAGES = [
    "Assamese", "Bengali", "English", "Gujarati", "Hindi",
    "Kannada", "Malayalam", "Marathi", "Odia", "Punjabi",
    "Tamil", "Telugu",
]

SUPPORTED_GENRES = [
    "podcast", "monologue", "advertisement",
    "ott_movie_sequence", "edtech", "academic_lecture_formal",
]

POLL_INTERVAL = 5


def create_job(src_lang, target_langs, job_name, num_speakers, genre):
    """Create a dubbing job and get upload URL."""
    payload = {
        "src_lang": src_lang,
        "target_langs": target_langs,
        "job_name": job_name,
        "num_speakers": num_speakers,
        "genre": genre,
        "editor_flow": False,
    }

    print(f"\nCreating dubbing job...")
    print(f"  Source:   {src_lang}")
    print(f"  Target:   {', '.join(target_langs)}")
    print(f"  Speakers: {num_speakers}")
    print(f"  Genre:    {genre}")

    resp = requests.post(f"{API_DUBBING}/jobs", json=payload)
    if resp.status_code != 200:
        print(f"Error creating job: {resp.status_code}")
        print(resp.text)
        sys.exit(1)

    data = resp.json()["data"]
    print(f"  Job ID:   {data['job_id']}")
    return data


def upload_video(upload_url, video_path):
    """Upload video to Azure Blob Storage."""
    file_size = os.path.getsize(video_path)
    print(f"\nUploading: {video_path} ({file_size / 1024 / 1024:.1f} MB)")

    with open(video_path, "rb") as f:
        resp = requests.put(
            upload_url,
            data=f,
            headers={"x-ms-blob-type": "BlockBlob"},
        )

    if resp.status_code in (200, 201):
        print("  Upload complete!")
    else:
        print(f"Error uploading: {resp.status_code}")
        print(resp.text[:500])
        sys.exit(1)


def start_job(job_id):
    """Start processing the uploaded video."""
    print(f"\nStarting job...")
    resp = requests.post(f"{API_DUBBING}/jobs/{job_id}/start")
    if resp.status_code != 200:
        print(f"Error starting job: {resp.status_code}")
        print(resp.text)
        sys.exit(1)
    print("  Processing started!")


def poll_status(job_id):
    """Poll job status until completion."""
    print(f"\nWaiting for dubbing to complete...")
    last_step = ""

    while True:
        resp = requests.get(f"{API_DUBBING}/jobs/{job_id}/live-status")
        if resp.status_code != 200:
            print(f"  Status check failed: {resp.status_code}")
            time.sleep(POLL_INTERVAL)
            continue

        data = resp.json().get("data", {})
        status = data.get("status", "unknown")
        progress = data.get("progress", 0)
        step_label = data.get("current_step_label", "")

        if step_label and step_label != last_step:
            print(f"  [{progress:3.0f}%] {step_label}")
            last_step = step_label

        if status == "completed":
            export_data = data.get("export", {})
            if export_data.get("status") == "completed":
                print(f"\n  Dubbing completed!")
                return data
            elif export_data.get("status") == "failed":
                print(f"\n  Export failed: {data.get('error_message', 'Unknown')}")
                sys.exit(1)

        if status == "failed":
            print(f"\n  Failed: {data.get('error_message', 'Unknown')}")
            sys.exit(1)

        if status == "partial_failure":
            print(f"\n  Partial failure: {data.get('error_message', 'Unknown')}")
            sys.exit(1)

        time.sleep(POLL_INTERVAL)


def download_video(dubbed_url, output_path):
    """Download the dubbed video."""
    print(f"\nDownloading dubbed video...")

    if "blob.core.windows.net" in dubbed_url:
        url = f"{BASE_URL}/api/media-proxy?url={requests.utils.quote(dubbed_url, safe='')}"
    else:
        url = dubbed_url

    resp = requests.get(url, stream=True)
    if resp.status_code != 200:
        resp = requests.get(dubbed_url, stream=True)
        if resp.status_code != 200:
            print(f"Download failed. URL: {dubbed_url}")
            return

    total = int(resp.headers.get("content-length", 0))
    downloaded = 0

    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                print(f"\r  {downloaded / total * 100:.1f}%", end="")

    print(f"\n  Saved: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Sarvam AI Video Dubbing - No auth required!",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Languages: {', '.join(SUPPORTED_LANGUAGES)}
Genres:    {', '.join(SUPPORTED_GENRES)}

Examples:
  python dub.py video.mp4 -t Hindi
  python dub.py video.mp4 -t Hindi,Tamil,Telugu --genre podcast
  python dub.py video.mp4 -t Bengali --speakers 2
  python dub.py --status JOB_ID
        """,
    )
    parser.add_argument("video", nargs="?", help="Path to video file")
    parser.add_argument("--src-lang", "-s", default="English", help="Source language (default: English)")
    parser.add_argument("--target-lang", "-t", help="Target language(s), comma-separated")
    parser.add_argument("--speakers", type=int, default=1, help="Number of speakers (default: 1)")
    parser.add_argument("--genre", "-g", default="podcast", choices=SUPPORTED_GENRES, help="Video genre (default: podcast)")
    parser.add_argument("--job-name", help="Custom job name")
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument("--no-download", action="store_true", help="Just print the URL")
    parser.add_argument("--status", help="Check status of existing job ID")
    parser.add_argument("--list", "-l", action="store_true", help="List languages & genres")

    args = parser.parse_args()

    if args.list:
        print("\nLanguages:", ", ".join(SUPPORTED_LANGUAGES))
        print("Genres:   ", ", ".join(SUPPORTED_GENRES))
        return

    if args.status:
        result = poll_status(args.status)
        export_data = result.get("export", {})
        url = export_data.get("dubbed_video_url", "")
        if url:
            print(f"  URL: {url}")
            if not args.no_download:
                download_video(url, args.output or f"dubbed_{args.status}.mp4")
        return

    if not args.video:
        parser.print_help()
        sys.exit(1)

    if not args.target_lang:
        print("Error: --target-lang / -t is required")
        print(f"Options: {', '.join(SUPPORTED_LANGUAGES)}")
        sys.exit(1)

    if not os.path.exists(args.video):
        print(f"Error: File not found: {args.video}")
        sys.exit(1)

    # Parse & validate languages
    target_langs = [l.strip() for l in args.target_lang.split(",")]
    for lang in target_langs + [args.src_lang]:
        if lang not in SUPPORTED_LANGUAGES:
            print(f"Error: '{lang}' is not valid.")
            print(f"Valid: {', '.join(SUPPORTED_LANGUAGES)}")
            sys.exit(1)

    job_name = args.job_name or Path(args.video).stem

    # 1. Create job
    job_data = create_job(args.src_lang, target_langs, job_name, args.speakers, args.genre)
    job_id = job_data["job_id"]
    upload_url = job_data["upload_url"]

    # 2. Upload video
    upload_video(upload_url, args.video)

    # 3. Start processing
    start_job(job_id)

    # 4. Wait for completion
    result = poll_status(job_id)

    # 5. Download result
    export_data = result.get("export", {})
    dubbed_url = export_data.get("dubbed_video_url", "")

    if dubbed_url:
        if args.no_download:
            print(f"\nURL: {dubbed_url}")
        else:
            if args.output:
                output_path = args.output
            else:
                stem = Path(args.video).stem
                ext = Path(args.video).suffix
                output_path = f"{stem}_{'_'.join(target_langs)}{ext}"
            download_video(dubbed_url, output_path)

        duration = export_data.get("duration", 0)
        print(f"\nDone! Job ID: {job_id}")
        if duration:
            print(f"Duration: {duration:.1f}s")
    else:
        print(f"\nNo output URL. Check: python dub.py --status {job_id}")


if __name__ == "__main__":
    main()
