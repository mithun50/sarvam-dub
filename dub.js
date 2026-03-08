#!/usr/bin/env node

/**
 * Sarvam AI Video Dubbing CLI Tool (Node.js)
 * No authentication required!
 *
 * Usage:
 *   node dub.js video.mp4 -t Hindi
 *   node dub.js video.mp4 -t Hindi,Tamil --genre podcast
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const BASE_URL = "https://dashboard.sarvam.ai";
const API_DUBBING = `${BASE_URL}/api/dubbing`;
const POLL_INTERVAL = 5000;

const LANGUAGES = [
  "Assamese", "Bengali", "English", "Gujarati", "Hindi",
  "Kannada", "Malayalam", "Marathi", "Odia", "Punjabi",
  "Tamil", "Telugu",
];

const GENRES = [
  "podcast", "monologue", "advertisement",
  "ott_movie_sequence", "edtech", "academic_lecture_formal",
];

// --- HTTP helpers ---

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(parsed, {
      method: options.method || "GET",
      headers: options.headers || {},
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function uploadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const fileSize = fs.statSync(filePath).size;
    const stream = fs.createReadStream(filePath);

    const req = mod.request(parsed, {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Length": fileSize,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode }));
    });
    req.on("error", reject);
    stream.pipe(req);
  });
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;

    const doDownload = (downloadUrl) => {
      const p = new URL(downloadUrl);
      const m = p.protocol === "https:" ? https : http;
      m.get(p, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return doDownload(res.headers.location);
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        const file = fs.createWriteStream(outputPath);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (total) {
            process.stdout.write(`\r  ${((downloaded / total) * 100).toFixed(1)}%`);
          }
        });
        res.on("end", () => {
          file.end();
          console.log(`\n  Saved: ${outputPath}`);
          resolve(outputPath);
        });
        res.on("error", reject);
      }).on("error", reject);
    };

    doDownload(url);
  });
}

// --- API functions ---

async function createJob(srcLang, targetLangs, jobName, numSpeakers, genre) {
  const payload = {
    src_lang: srcLang,
    target_langs: targetLangs,
    job_name: jobName,
    num_speakers: numSpeakers,
    genre: genre,
    editor_flow: false,
  };

  console.log(`\nCreating dubbing job...`);
  console.log(`  Source:   ${srcLang}`);
  console.log(`  Target:   ${targetLangs.join(", ")}`);
  console.log(`  Speakers: ${numSpeakers}`);
  console.log(`  Genre:    ${genre}`);

  const resp = await request(`${API_DUBBING}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (resp.status !== 200) {
    console.error(`Error creating job: ${resp.status}`);
    console.error(resp.body);
    process.exit(1);
  }

  const data = JSON.parse(resp.body).data;
  console.log(`  Job ID:   ${data.job_id}`);
  return data;
}

async function upload(uploadUrl, videoPath) {
  const size = fs.statSync(videoPath).size;
  console.log(`\nUploading: ${videoPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);

  const resp = await uploadFile(uploadUrl, videoPath);
  if (resp.status !== 200 && resp.status !== 201) {
    console.error(`Error uploading: ${resp.status}`);
    process.exit(1);
  }
  console.log("  Upload complete!");
}

async function startJob(jobId) {
  console.log(`\nStarting job...`);
  const resp = await request(`${API_DUBBING}/jobs/${jobId}/start`, { method: "POST" });
  if (resp.status !== 200) {
    console.error(`Error starting job: ${resp.status}`);
    console.error(resp.body);
    process.exit(1);
  }
  console.log("  Processing started!");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollStatus(jobId) {
  console.log(`\nWaiting for dubbing to complete...`);
  let lastStep = "";

  while (true) {
    const resp = await request(`${API_DUBBING}/jobs/${jobId}/live-status`);
    if (resp.status !== 200) {
      console.log(`  Status check failed: ${resp.status}`);
      await sleep(POLL_INTERVAL);
      continue;
    }

    const data = JSON.parse(resp.body).data || {};
    const status = data.status || "unknown";
    const progress = data.progress || 0;
    const stepLabel = data.current_step_label || "";

    if (stepLabel && stepLabel !== lastStep) {
      console.log(`  [${String(Math.round(progress)).padStart(3)}%] ${stepLabel}`);
      lastStep = stepLabel;
    }

    if (status === "completed") {
      const exp = data.export || {};
      if (exp.status === "completed") {
        console.log(`\n  Dubbing completed!`);
        return data;
      }
      if (exp.status === "failed") {
        console.error(`\n  Export failed: ${data.error_message || "Unknown"}`);
        process.exit(1);
      }
    }

    if (status === "failed") {
      console.error(`\n  Failed: ${data.error_message || "Unknown"}`);
      process.exit(1);
    }

    if (status === "partial_failure") {
      console.error(`\n  Partial failure: ${data.error_message || "Unknown"}`);
      process.exit(1);
    }

    await sleep(POLL_INTERVAL);
  }
}

// --- Arg parser ---

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    video: null,
    srcLang: "English",
    targetLang: null,
    speakers: 1,
    genre: "podcast",
    jobName: null,
    output: null,
    noDownload: false,
    status: null,
    list: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "-t": case "--target-lang":
        opts.targetLang = args[++i]; break;
      case "-s": case "--src-lang":
        opts.srcLang = args[++i]; break;
      case "--speakers":
        opts.speakers = parseInt(args[++i], 10); break;
      case "-g": case "--genre":
        opts.genre = args[++i]; break;
      case "--job-name":
        opts.jobName = args[++i]; break;
      case "-o": case "--output":
        opts.output = args[++i]; break;
      case "--no-download":
        opts.noDownload = true; break;
      case "--status":
        opts.status = args[++i]; break;
      case "-l": case "--list":
        opts.list = true; break;
      case "-h": case "--help":
        printHelp(); process.exit(0);
      default:
        if (!arg.startsWith("-")) opts.video = arg;
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
Sarvam AI Video Dubbing CLI (Node.js)

Usage: node dub.js <video> -t <language> [options]

Arguments:
  video                    Path to video file

Options:
  -t, --target-lang LANG   Target language(s), comma-separated (required)
  -s, --src-lang LANG      Source language (default: English)
  --speakers N             Number of speakers (default: 1)
  -g, --genre GENRE        Video genre (default: podcast)
  --job-name NAME          Custom job name
  -o, --output PATH        Output file path
  --no-download            Just print the URL
  --status JOB_ID          Check status of existing job
  -l, --list               List languages & genres
  -h, --help               Show this help

Languages: ${LANGUAGES.join(", ")}
Genres:    ${GENRES.join(", ")}

Examples:
  node dub.js video.mp4 -t Hindi
  node dub.js video.mp4 -t Hindi,Tamil,Telugu --genre edtech
  node dub.js video.mp4 -t Bengali --speakers 2
  node dub.js --status JOB_ID
  `);
}

// --- Main ---

async function main() {
  const opts = parseArgs();

  if (opts.list) {
    console.log(`\nLanguages: ${LANGUAGES.join(", ")}`);
    console.log(`Genres:    ${GENRES.join(", ")}`);
    return;
  }

  if (opts.status) {
    const result = await pollStatus(opts.status);
    const exp = result.export || {};
    const url = exp.dubbed_video_url || "";
    if (url) {
      console.log(`  URL: ${url}`);
      if (!opts.noDownload) {
        await downloadFile(url, opts.output || `dubbed_${opts.status}.mp4`);
      }
    }
    return;
  }

  if (!opts.video) { printHelp(); process.exit(1); }
  if (!opts.targetLang) {
    console.error("Error: --target-lang / -t is required");
    process.exit(1);
  }
  if (!fs.existsSync(opts.video)) {
    console.error(`Error: File not found: ${opts.video}`);
    process.exit(1);
  }

  const targetLangs = opts.targetLang.split(",").map((l) => l.trim());
  for (const lang of [...targetLangs, opts.srcLang]) {
    if (!LANGUAGES.includes(lang)) {
      console.error(`Error: '${lang}' is not valid.`);
      console.error(`Valid: ${LANGUAGES.join(", ")}`);
      process.exit(1);
    }
  }

  const jobName = opts.jobName || path.parse(opts.video).name;

  // 1. Create
  const jobData = await createJob(opts.srcLang, targetLangs, jobName, opts.speakers, opts.genre);

  // 2. Upload
  await upload(jobData.upload_url, opts.video);

  // 3. Start
  await startJob(jobData.job_id);

  // 4. Wait
  const result = await pollStatus(jobData.job_id);

  // 5. Download
  const exp = result.export || {};
  const dubbedUrl = exp.dubbed_video_url || "";

  if (dubbedUrl) {
    if (opts.noDownload) {
      console.log(`\nURL: ${dubbedUrl}`);
    } else {
      const outputPath = opts.output ||
        `${path.parse(opts.video).name}_${targetLangs.join("_")}${path.extname(opts.video)}`;
      await downloadFile(dubbedUrl, outputPath);
    }
    console.log(`\nDone! Job ID: ${jobData.job_id}`);
    if (exp.duration) console.log(`Duration: ${exp.duration.toFixed(1)}s`);
  } else {
    console.log(`\nNo output URL. Check: node dub.js --status ${jobData.job_id}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
