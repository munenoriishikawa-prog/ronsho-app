import fs from 'node:fs';
const source='legacy:ronsho_app_v18.7_with_past_exam_log_v2.html';
const output='dist/ronsho_app_v18.7_complete_backup.html';
let html=fs.readFileSync(source,'utf8');
const injected=`<script>
(()=>{
const PAST_KEY='ronshoPastExamLogsv1';
const normPast=x=>({id:x.id||'',examType:x.examType||'予備試験',subject:x.subject||'',year:x.year||'',round:Number(x.round)||1,date:x.date||'',memo:x.memo||''});
const loadPast=()=>{try{const x=JSON.parse(localStorage.getItem(PAST_KEY)||'[]');return Array.isArray(x)?x.map(normPast):[]}catch(e){return[]}};
const savePast=x=>localStorage.setItem(PAST_KEY,JSON.stringify(x.map(normPast)));
const mergePast=(base,incoming)=>{const out=base.map(normPast);incoming.map(normPast).forEach(x=>{const i=out.findIndex(y=>y.examType===x.examType&&y.subject===x.subject&&y.year===x.year&&y.round===x.round);if(i>=0)out[i]=x;else out.push(x)});return out};
const download=(name,text)=>{const b=new Blob([text],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u)};
function setup(){
 const oldExport=document.getElementById('exportLogBtn'),oldImport=document.getElementById('importLogBtn'),oldInput=document.getElementById('importLogInput');
 if(!oldExport||!oldImport||!oldInput)return;
 const exportBtn=oldExport.cloneNode(true),importBtn=oldImport.cloneNode(true),input=oldInput.cloneNode(true);
 oldExport.replaceWith(exportBtn);oldImport.replaceWith(importBtn);oldInput.replaceWith(input);
 exportBtn.textContent='すべてのデータを書き出す（PC間同期用）';
 importBtn.textContent='すべてのデータを読み込む（PC間同期用）';
 exportBtn.addEventListener('click',()=>download('論証集_完全バックアップ_'+todayStr()+'.json',JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),studyLog:studyLog||{},manualLog:manualLog||{},pastExamLogs:loadPast()},null,2)));
 importBtn.addEventListener('click',()=>input.click());
 input.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d||typeof d!=='object')throw new Error('JSON形式が不正です。');const incomingStudy=d.studyLog||((!d.manualLog&&!d.pastExamLogs)?d:{});studyLog=Object.assign({},studyLog||{},incomingStudy);manualLog=Object.assign({},manualLog||{},d.manualLog||{});saveStudyLog();saveManualLog();savePast(mergePast(loadPast(),d.pastExamLogs||[]));if(typeof renderAll==='function')renderAll();status.textContent='完全バックアップを読み込み、既存データと統合しました。'}catch(err){status.textContent='読み込みに失敗しました: '+err.message}e.target.value=''});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
<\/script>`;
if(!html.includes('id="exportLogBtn"')||!html.includes('id="importLogInput"'))throw new Error('対象の入出力要素を検出できません。');
html=html.replace(/<\/body>/i,injected+'\n</body>');
fs.mkdirSync('dist',{recursive:true});fs.writeFileSync(output,html,'utf8');
console.log(output);