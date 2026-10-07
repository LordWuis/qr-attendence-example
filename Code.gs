/**
 * Google Apps Script backend for QR Attendance.
 *
 * Expected sheet columns:
 * A: unique_id
 * B: name
 * C: email
 * D: phone
 * E: designation
 * F: department
 * G: attendance
 *
 * The script finds unique_id in column A and writes "Present" in column G.
 */

const SHEET_NAME = "Sheet1";
const UNIQUE_ID_COLUMN = 1; // A
const ATTENDANCE_COLUMN = 7; // G

function doGet() {
  return jsonResponse_({
    success: true,
    message: "QR Attendance API is running."
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const uniqueId = String(body.unique_id || "").trim().toUpperCase();

    if (!uniqueId) {
      return jsonResponse_({ success: false, message: "unique_id is required." });
    }

    // Use this if the script is BOUND to the attendance spreadsheet.
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // If you create a standalone Apps Script project instead, replace the line above with:
    // const spreadsheet = SpreadsheetApp.openById("YOUR_SPREADSHEET_ID");

    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonResponse_({ success: false, message: `Sheet '${SHEET_NAME}' was not found.` });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse_({ success: false, message: "The sheet has no employee records." });
    }

    const ids = sheet.getRange(2, UNIQUE_ID_COLUMN, lastRow - 1, 1).getDisplayValues();
    let matchedRow = -1;

    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim().toUpperCase() === uniqueId) {
        matchedRow = i + 2;
        break;
      }
    }

    if (matchedRow === -1) {
      return jsonResponse_({ success: false, message: `No record found for ${uniqueId}.` });
    }

    const attendanceCell = sheet.getRange(matchedRow, ATTENDANCE_COLUMN);
    const currentStatus = String(attendanceCell.getDisplayValue()).trim().toLowerCase();

    if (currentStatus !== "present") {
      attendanceCell.setValue("Present");
    }

    // Return useful employee details to the scanner UI.
    const row = sheet.getRange(matchedRow, 1, 1, 6).getDisplayValues()[0];

    return jsonResponse_({
      success: true,
      alreadyPresent: currentStatus === "present",
      message: currentStatus === "present" ? "Attendance was already marked." : "Attendance marked successfully.",
      person: {
        unique_id: row[0],
        name: row[1],
        email: row[2],
        phone: row[3],
        designation: row[4],
        department: row[5]
      }
    });
  } catch (error) {
    return jsonResponse_({ success: false, message: error.message || String(error) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
