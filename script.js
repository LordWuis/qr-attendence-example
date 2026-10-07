// Replace this with the /exec URL from your deployed Google Apps Script Web App.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzoYu4HfbGHPfK3sliIvEorcvrK9xhkkHtLl8I6Fy9GWyGk184MnygkAIFYtdaj3Pcx9Q/exec";

const SCANNER_ID = "reader";
const SCAN_COOLDOWN_MS = 3000;
let scanner;
let isSubmitting = false;
let lastScannedId = "";
let lastScanTime = 0;

const statusBox = document.getElementById("status");
const statusTitle = document.getElementById("status-title");
const statusMessage = document.getElementById("status-message");
const restartBtn = document.getElementById("restart-btn");
const manualForm = document.getElementById("manual-form");
const manualId = document.getElementById("manual-id");

function setStatus(type, title, message) {
  statusBox.className = `status status-${type}`;
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

function normalizeId(value) {
  return String(value || "").trim().toUpperCase();
}

async function submitAttendance(rawId) {
  const uniqueId = normalizeId(rawId);
  if (!uniqueId || isSubmitting) return;

  const now = Date.now();
  if (uniqueId === lastScannedId && now - lastScanTime < SCAN_COOLDOWN_MS) return;
  lastScannedId = uniqueId;
  lastScanTime = now;
  isSubmitting = true;

  setStatus("loading", "Checking ID…", `Sending ${uniqueId} to the attendance sheet.`);

  try {
    if (!APPS_SCRIPT_URL.startsWith("https://script.google.com/")) {
      throw new Error("Add your Apps Script /exec URL in script.js first.");
    }

    // Using text/plain avoids an unnecessary CORS preflight for a simple request.
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ unique_id: uniqueId })
    });

    if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`);
    const result = await response.json();

    if (!result.success) throw new Error(result.message || "Could not mark attendance.");

    const person = result.person || {};
    setStatus(
      "success",
      "Attendance marked",
      [person.name, person.designation, person.department, uniqueId].filter(Boolean).join(" • ")
    );
    restartBtn.hidden = false;
  } catch (error) {
    setStatus("error", "Attendance not marked", error.message);
    restartBtn.hidden = false;
  } finally {
    isSubmitting = false;
  }
}

async function onScanSuccess(decodedText) {
  if (isSubmitting) return;
  try { await scanner.pause(true); } catch (_) {}
  await submitAttendance(decodedText);
}

function onScanFailure() {
  // Normal while the camera is searching for a QR code; no UI error needed.
}

function startScanner() {
  restartBtn.hidden = true;
  setStatus("neutral", "Ready to scan", "Point the camera at an employee QR code.");

  if (!scanner) {
    scanner = new Html5QrcodeScanner(
      SCANNER_ID,
      {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      },
      false
    );
    scanner.render(onScanSuccess, onScanFailure);
  } else {
    try { scanner.resume(); } catch (_) {}
  }
}

restartBtn.addEventListener("click", () => {
  lastScannedId = "";
  startScanner();
});

manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = manualId.value;
  if (!id.trim()) return;
  await submitAttendance(id);
  manualId.value = "";
});

window.addEventListener("DOMContentLoaded", startScanner);
