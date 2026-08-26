// GAS(Google Apps Script)側ソースの参照用コピー(2026-08-25 時点、プロジェクト「論証集アプリ同期」の コード.gs)。
// デプロイされている実体は GAS エディタ側にあり、このファイルを変更しても反映されない。
// 同期の仕様: GET は保存済み JSON({revision, updatedAt, data})をそのまま返す。
// POST は revision が一致すれば丸ごと保存して revision+1、
// 一致しなければ {ok:false, reason:'conflict', latest:(現在の全データ)} を返す。
// マージや削除の判断はすべてクライアント側(drive-sync.js)で行う。
const FILE_NAME = 'ronsho-app-sync-data.json';

function getOrCreateFile() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('FILE_ID');
  if (savedId) {
    try {
      return DriveApp.getFileById(savedId);
    } catch (e) {
      // 保存されていたIDが無効な場合は下で作り直す
    }
  }
  const files = DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    const file = files.next();
    props.setProperty('FILE_ID', file.getId());
    return file;
  }
  const initial = JSON.stringify({ revision: 0, updatedAt: new Date().toISOString(), data: {} });
  const file = DriveApp.createFile(FILE_NAME, initial, MimeType.PLAIN_TEXT);
  props.setProperty('FILE_ID', file.getId());
  return file;
}

function doGet() {
  const file = getOrCreateFile();
  const text = file.getBlob().getDataAsString() || '{"revision":0,"data":{}}';
  return jsonResponse(JSON.parse(text));
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const request = JSON.parse(e.postData.contents);
    const file = getOrCreateFile();
    const currentText = file.getBlob().getDataAsString() || '{"revision":0,"data":{}}';
    const current = JSON.parse(currentText);

    if (request.revision !== current.revision) {
      return jsonResponse({ ok: false, reason: 'conflict', latest: current });
    }

    const next = {
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      data: request.data
    };
    file.setContent(JSON.stringify(next));
    return jsonResponse({ ok: true, result: next });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
