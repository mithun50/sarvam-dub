/**
 * Sarvam AI Video Dubbing SDK (Node.js)
 *
 * Usage:
 *   const { SarvamDubbing } = require("./sarvam_dub");
 *
 *   const dub = new SarvamDubbing();
 *   const result = await dub.dub("video.mp4", { targetLangs: ["Hindi"] });
 *   console.log(result.dubbedUrl);
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const BASE_URL = "https://dashboard.sarvam.ai";

const LANGUAGES = [
  "Assamese", "Bengali", "English", "Gujarati", "Hindi",
  "Kannada", "Malayalam", "Marathi", "Odia", "Punjabi",
  "Tamil", "Telugu",
];

const GENRES = [
  "podcast", "monologue", "advertisement",
  "ott_movie_sequence", "edtech", "academic_lecture_formal",
];

class SarvamDubbingError extends Error {
  constructor(message) { super(message); this.name = "SarvamDubbingError"; }
}

function _request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const req = mod.request(parsed, {
      method: options.method || "GET",
      headers: options.headers || {},
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString(),
        headers: res.headers,
      }));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function _uploadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === "https:" ? https : http;
    const fileSize = fs.statSync(filePath).size;
    const stream = fs.createReadStream(filePath);
    const req = mod.request(parsed, {
      method: "PUT",
      headers: { "x-ms-blob-type": "BlockBlob", "Content-Length": fileSize },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode }));
    });
    req.on("error", reject);
    stream.pipe(req);
  });
}

function _downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const doDownload = (u) => {
      const p = new URL(u);
      const m = p.protocol === "https:" ? https : http;
      m.get(p, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return doDownload(res.headers.location);
        }
        const file = fs.createWriteStream(outputPath);
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(outputPath); });
      }).on("error", reject);
    };
    doDownload(url);
  });
}

class SarvamDubbing {
  /**
   * @param {Object} options
   * @param {string} [options.baseUrl] - API base URL
   * @param {number} [options.pollInterval] - Poll interval in ms (default: 5000)
   */
  constructor({ baseUrl = BASE_URL, pollInterval = 5000 } = {}) {
    this.baseUrl = baseUrl;
    this.apiUrl = `${baseUrl}/api/dubbing`;
    this.pollInterval = pollInterval;
  }

  /**
   * Create a dubbing job.
   * @param {Object} options
   * @param {string} [options.srcLang="English"]
   * @param {string[]} [options.targetLangs=["Hindi"]]
   * @param {string} [options.jobName="untitled"]
   * @param {number} [options.numSpeakers=1]
   * @param {string} [options.genre="podcast"]
   * @returns {Promise<Object>} Job data with job_id, upload_url, etc.
   */
  async createJob({
    srcLang = "English",
    targetLangs = ["Hindi"],
    jobName = "untitled",
    numSpeakers = 1,
    genre = "podcast",
  } = {}) {
    const resp = await _request(`${this.apiUrl}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        src_lang: srcLang,
        target_langs: targetLangs,
        job_name: jobName,
        num_speakers: numSpeakers,
        genre,
        editor_flow: false,
      }),
    });

    if (resp.status !== 200) {
      throw new SarvamDubbingError(`Job creation failed: ${resp.status} ${resp.body}`);
    }
    return JSON.parse(resp.body).data;
  }

  /**
   * Upload video to presigned URL.
   * @param {string} uploadUrl
   * @param {string} videoPath
   */
  async upload(uploadUrl, videoPath) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`File not found: ${videoPath}`);
    }
    const resp = await _uploadFile(uploadUrl, videoPath);
    if (resp.status !== 200 && resp.status !== 201) {
      throw new SarvamDubbingError(`Upload failed: ${resp.status}`);
    }
  }

  /**
   * Start processing a job.
   * @param {string} jobId
   */
  async start(jobId) {
    const resp = await _request(`${this.apiUrl}/jobs/${jobId}/start`, { method: "POST" });
    if (resp.status !== 200) {
      throw new SarvamDubbingError(`Start failed: ${resp.status} ${resp.body}`);
    }
  }

  /**
   * Get current job status.
   * @param {string} jobId
   * @returns {Promise<Object>} Status object
   */
  async status(jobId) {
    const resp = await _request(`${this.apiUrl}/jobs/${jobId}/live-status`);
    if (resp.status !== 200) return { status: "unknown", jobId };
    const data = JSON.parse(resp.body).data || {};
    const exp = data.export || {};
    return {
      jobId,
      status: data.status || "unknown",
      progress: data.progress || 0,
      currentStep: data.current_step_label || "",
      errorMessage: data.error_message || "",
      dubbedVideoUrl: exp.dubbed_video_url || "",
      originalVideoUrl: exp.original_video_url || "",
      duration: exp.duration || 0,
      fileSize: exp.file_size || 0,
      isCompleted: data.status === "completed" && exp.status === "completed",
      isFailed: ["failed", "partial_failure"].includes(data.status),
      raw: data,
    };
  }

  /**
   * Wait for job completion.
   * @param {string} jobId
   * @param {Object} [options]
   * @param {Function} [options.onProgress] - Callback on each poll
   * @param {number} [options.timeout=600000] - Timeout in ms
   * @returns {Promise<Object>} Final status
   */
  async wait(jobId, { onProgress, timeout = 600000 } = {}) {
    const start = Date.now();
    while (true) {
      if (Date.now() - start > timeout) {
        throw new SarvamDubbingError(`Timeout after ${timeout}ms`);
      }
      const st = await this.status(jobId);
      if (onProgress) onProgress(st);
      if (st.isCompleted) return st;
      if (st.isFailed) throw new SarvamDubbingError(`Job failed: ${st.errorMessage}`);
      await new Promise((r) => setTimeout(r, this.pollInterval));
    }
  }

  /**
   * Download dubbed video.
   * @param {string} dubbedUrl
   * @param {string} outputPath
   * @returns {Promise<string>} Output path
   */
  async download(dubbedUrl, outputPath) {
    let url = dubbedUrl;
    if (dubbedUrl.includes("blob.core.windows.net")) {
      url = `${this.baseUrl}/api/media-proxy?url=${encodeURIComponent(dubbedUrl)}`;
    }
    return _downloadFile(url, outputPath);
  }

  /**
   * All-in-one: create, upload, start, wait, download.
   * @param {string} videoPath
   * @param {Object} [options]
   * @param {string[]} [options.targetLangs=["Hindi"]]
   * @param {string} [options.srcLang="English"]
   * @param {number} [options.numSpeakers=1]
   * @param {string} [options.genre="podcast"]
   * @param {string} [options.outputPath]
   * @param {Function} [options.onProgress]
   * @param {number} [options.timeout=600000]
   * @returns {Promise<Object>} Result with jobId, dubbedUrl, outputPath
   */
  async dub(videoPath, {
    targetLangs = ["Hindi"],
    srcLang = "English",
    numSpeakers = 1,
    genre = "podcast",
    outputPath,
    onProgress,
    timeout = 600000,
  } = {}) {
    const jobName = path.parse(videoPath).name;

    const job = await this.createJob({ srcLang, targetLangs, jobName, numSpeakers, genre });
    await this.upload(job.upload_url, videoPath);
    await this.start(job.job_id);
    const final = await this.wait(job.job_id, { onProgress, timeout });

    if (!outputPath) {
      const ext = path.extname(videoPath);
      outputPath = `${path.parse(videoPath).name}_${targetLangs.join("_")}${ext}`;
    }

    await this.download(final.dubbedVideoUrl, outputPath);

    return {
      jobId: job.job_id,
      dubbedUrl: final.dubbedVideoUrl,
      originalUrl: final.originalVideoUrl,
      duration: final.duration,
      fileSize: final.fileSize,
      outputPath,
    };
  }
}

module.exports = { SarvamDubbing, SarvamDubbingError, LANGUAGES, GENRES };
