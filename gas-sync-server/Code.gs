// 論証集アプリ同期サーバー v1
// Google Apps Script で実行し、更新トークンを安全に保管して完全自動同期を実現

const FILE_NAME = 'ronsho-app-sync-v1.json';
const TOKEN_PROP = 'driveRefreshToken';
const FILE_ID_PROP = 'driveFileId';

/**
 * Web アプリのエントリーポイント
 * GET ?action=get  → Drive からデータ取得
 * POST ?action=push → Drive へデータ保存
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'get') {
    return getData();
  }
  return jsonResponse({ error: 'action=get が必要です' }, 400);
}

function doPost(e) {
  const action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'push') {
    const body = parseJsonBody(e);
    return pushData(body);
  }
  return jsonResponse({ error: 'action=push が必要です' }, 400);
}

/**
 * Drive から同期ファイルを取得（初回は自動作成）
 */
function getData() {
  try {
    const fileId = getFileId();
    if (!fileId) {
      // 初回：空のデータでファイル作成
      const initial = { schemaVersion: 3, updatedAt: new Date().toISOString(), entries: [], studyLog: {}, manualLog: {}, pastExamLogs: [] };
      return pushData(initial);
    }
    const file = DriveApp.getFileById(fileId);
    const data = JSON.parse(file.getBlob().getDataAsString());
    return jsonResponse({ success: true, data });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * Drive へ同期ファイルを保存
 */
function pushData(data) {
  try {
    const props = PropertiesService.getUserProperties();
    let fileId = props.getProperty(FILE_ID_PROP);
    data.updatedAt = new Date().toISOString();
    const blob = Utilities.newBlob(JSON.stringify(data), 'application/json', FILE_NAME);
    if (fileId) {
      const file = DriveApp.getFileById(fileId);
      file.setContent(blob.getBytes());
    } else {
      const file = DriveApp.createFile(blob);
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      fileId = file.getId();
      props.setProperty(FILE_ID_PROP, fileId);
    }
    return jsonResponse({ success: true, fileId });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/**
 * ファイル ID を取得（ PropertiesService から）
 */
function getFileId() {
  return PropertiesService.getUserProperties().getProperty(FILE_ID_PROP);
}

/**
 * JSON レスポンスを返す
 */
function jsonResponse(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST ボディをパース
 */
function parseJsonBody(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

/**
 * 初回セットアップ用（任意：手動で実行）
 */
function setup() {
  const initial = { schemaVersion: 3, updatedAt: new Date().toISOString(), entries: [], studyLog: {}, manualLog: {}, pastExamLogs: [] };
  pushData(initial);
  Logger.log('初期ファイルを作成しました');
}
