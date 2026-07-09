/* ======================================================
   ESTADO GLOBAL
====================================================== */
let operador="";
let driverAtual="";
let drivers={};
let zipGlobal=null;
let selecionados=[];
const LIMITE_UI = 200
const BLOCO = 5

/* =========================
PERSISTÊNCIA
========================= */

function salvarEstado(){

localStorage.setItem("amazon_state",JSON.stringify({
operador,
driverAtual,
drivers
}));

}

function carregarEstado(){

const raw=localStorage.getItem("amazon_state");

if(!raw) return;

const data=JSON.parse(raw);

operador=data.operador||"";
driverAtual=data.driverAtual||"";
drivers=data.drivers||{};

if(operador && driverAtual){

document.getElementById("setup").style.display="none";

document.getElementById("scanner").style.display="block";

document.getElementById("opName").innerText=operador;

document.getElementById("driverName").innerText=driverAtual;

atualizarLista();
atualizarContadores();

}

}


/* =========================
START
========================= */

function startScan(){

operador=document.getElementById("operador").value.trim().toUpperCase();

driverAtual=document.getElementById("driver").value.trim().toUpperCase();

if(!operador||!driverAtual){

alert("Informe operador e driver");

return;

}

if(!drivers[driverAtual]){

drivers[driverAtual]={codigos:[],mapa:{},registros:[]};

}

document.getElementById("setup").style.display="none";

document.getElementById("scanner").style.display="block";

document.getElementById("opName").innerText=operador;

document.getElementById("driverName").innerText=driverAtual;

salvarEstado();

document.getElementById("codeInput").focus();
ativarWakeLock();
}


/* =========================
TROCAR DRIVER
========================= */

function abrirTrocaDriver(){

document.getElementById("popupDriver").style.display="flex";

renderDrivers();

}

function fecharPopup(){

document.getElementById("popupDriver").style.display="none";

}

function confirmarTrocaDriver(){

const novo=document.getElementById("novoDriver").value.trim().toUpperCase();

if(!novo) return;

driverAtual=novo;

if(!drivers[driverAtual]){

drivers[driverAtual]={codigos:[],mapa:{},registros:[]};

}

salvarEstado();

fecharPopup();

document.getElementById("driverName").innerText=driverAtual;

atualizarLista();
atualizarContadores();

}

function renderDrivers(){

const box=document.getElementById("listaDrivers");

box.innerHTML="";

Object.keys(drivers).forEach(d=>{

const div=document.createElement("div");

div.textContent=d;

div.onclick=()=>{

driverAtual=d;

salvarEstado();

fecharPopup();

document.getElementById("driverName").innerText=driverAtual;

atualizarLista();
atualizarContadores();

};

box.appendChild(div);

});

}

/* =========================
WAKE LOCK (impedir apagar tela)
========================= */
let wakeLock = null;
async function ativarWakeLock(){
  try{
    if ('wakeLock' in navigator){
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release',()=>{ console.log('Wake Lock liberado'); });
    } else {
      console.log('Wake Lock não suportado.');
    }
  }catch(e){ console.warn('Falha ao solicitar Wake Lock:', e); }
}
async function desativarWakeLock(){
  try{ await wakeLock?.release?.(); wakeLock=null; }catch(e){}
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible' && wakeLock){ ativarWakeLock(); }
});

document.addEventListener("DOMContentLoaded", () => {
  carregarEstado();

  const codeInput = document.getElementById("codeInput");
  const PADRAO_TBR = /^TBR\d{9}$/; // total 12 caracteres

  // Mini menu
  const btnMais = document.getElementById("btnMais");
  const menuMais = document.getElementById("menuMais");
  if (btnMais && menuMais) {
    btnMais.addEventListener("click", ()=>{
      menuMais.style.display = (menuMais.style.display === "none" ? "block" : "none");
      setTimeout(()=> codeInput?.focus(), 0);
    });
  }  

  // Mantém Enter funcionando
  codeInput.addEventListener("keydown", e=>{
    if(e.key==="Enter"){
      processarCodigo(e.target.value);
      e.target.value="";
      setTimeout(()=> codeInput.focus(), 0);
    }
  });

  // Novo listener com validação de prefixo TBR + auto-processo ao completar 12
let travado = false;

codeInput.addEventListener("input", e => {

  if (travado) {
    e.target.value = "";
    return;
  }

  const raw = e.target.value;
  const up = raw.toUpperCase();

  // ❌ erro de prefixo
  if (up.length >= 3 && !up.startsWith("TBR")) {
    dispararErro();
    return;
  }

  // ❌ caractere inválido
  if (/[^A-Z0-9]/.test(up)) {
    dispararErro();
    return;
  }

  e.target.value = up;

  // ✅ código completo
  if (/^TBR\d{9}$/.test(up)) {
    processarCodigo(up);
    e.target.value = "";
  }

});


function dispararErro() {
  const input = document.getElementById("codeInput");

  tocar("erro");

  // trava entrada
  travado = true;

  // limpa completamente
  input.value = "";

  // pequena pausa para "engolir" resto do scanner
  setTimeout(() => {
    input.value = "";
    travado = false;
    input.focus();
  }, 120); // pode ajustar (100~200ms ideal)
}
codeInput.addEventListener("keydown", e => {
  if (travado) {
    e.preventDefault();
  }
});

});

function processarCodigo(valor){
  let codigo = valor.trim().toUpperCase();
  if (!codigo) return;

  const d = drivers[driverAtual];
  const dataHora = new Date().toLocaleString("pt-BR");
  const padrao = /^TBR\d{9}$/;

  // Caso inválido: toca erro e registra (mantém visível na lista de problemas)
  if (!padrao.test(codigo)) {
    tocar("erro");
    d.registros.push({ codigo, status: "erro", dataHora });
    finalizarAtualizacao();    
    setTimeout(()=> document.getElementById("codeInput")?.focus(), 0);  
    return;
  }

  // Caso duplicado: toca som e NÃO INSERE (nem em registros, nem em códigos)
  if (d.mapa[codigo]) {
    tocar("dup");
    // não adiciona em registros, não altera contadores
    setTimeout(()=> document.getElementById("codeInput")?.focus(), 0);    
    return;
  }

  // Caso OK: insere e registra
  d.mapa[codigo] = true;
  d.codigos.push(codigo);
  tocar("ok");
  d.registros.push({ codigo, status: "ok", dataHora });

  finalizarAtualizacao();

  // --- helper interno para evitar repetição ---
  function finalizarAtualizacao() {
    selecionados = [];
    salvarEstado();
    atualizarLista();
    atualizarContadores();
    setTimeout(()=> document.getElementById("codeInput")?.focus(), 0);    
  }
}

/* =========================
LISTAS
========================= */

function atualizarLista(){

const lista=document.getElementById("lista");
const listaProblema=document.getElementById("listaProblema");

lista.innerHTML="";
listaProblema.innerHTML="";

const regs=drivers[driverAtual].registros.slice().reverse();

regs.forEach((r,index)=>{

const div=document.createElement("div");

div.className="item "+r.status;

div.innerText=r.codigo;

if(selecionados.includes(r.codigo)){

div.style.outline="3px solid #facc15";

}

div.onclick=()=>{

if(selecionados.includes(r.codigo)){

selecionados=selecionados.filter(c=>c!==r.codigo);

}else{

selecionados.push(r.codigo);

}

atualizarLista();

};

if(r.status==="erro" || r.status==="dup"){

const clone=div.cloneNode(true);

clone.onclick=div.onclick;

listaProblema.appendChild(clone);

}

lista.appendChild(div);

});

}


/* =========================
CONTADORES
========================= */

function atualizarContadores(){

let ok=0,erro=0,dup=0;

drivers[driverAtual].registros.forEach(r=>{

if(r.status==="ok") ok++;
if(r.status==="erro") erro++;
if(r.status==="dup") dup++;

});

document.getElementById("totalCount").innerText=drivers[driverAtual].registros.length;
document.getElementById("okCount").innerText=ok;
document.getElementById("erroCount").innerText=erro;
document.getElementById("dupCount").innerText=dup;

}


/* =========================
EXCLUIR MULTIPLO
========================= */

function excluirSelecionado(){

if(selecionados.length===0){

alert("Selecione ao menos um código");

return;

}

if(!confirm(`Excluir ${selecionados.length} código(s)?`)) return;

const d=drivers[driverAtual];

d.registros=d.registros.filter(r=>!selecionados.includes(r.codigo));
d.codigos=d.codigos.filter(c=>!selecionados.includes(c));

selecionados.forEach(c=>delete d.mapa[c]);

selecionados=[];

salvarEstado();

atualizarLista();
atualizarContadores();

}


/* =========================
COPIAR
========================= */

function copyEnxuto(){

let txt=`OPERADOR: ${operador}\nDRIVER: ${driverAtual}\n\n`;

drivers[driverAtual].codigos.forEach(c=>txt+=c+"\n");

copiar(txt);

}

function copyCompleto(){

const total=drivers[driverAtual].codigos.length;

let txt=`OPERADOR: ${operador}
DRIVER: ${driverAtual}
TOTAL DE PACOTES: ${total}

`;

drivers[driverAtual].registros.forEach(r=>{

txt+=`${r.codigo} - ${r.dataHora}\n`;

});

copiar(txt);

}

function copiar(texto){

navigator.clipboard.writeText(texto)
.then(()=>alert("Texto copiado com sucesso!"))
.catch(()=>alert("Falha ao copiar"));
}

/* =========================
EXPORTAR EXCEL (.xlsx)
========================= */
function exportarExcel() {
  // Monta um array com todas as linhas: [Operador, Driver, Código, Data/Hora]
  const linhas = [["Operador", "Driver", "Código", "Data/Hora"]];

  const driverKeys = Object.keys(drivers);
  driverKeys.forEach(drv => {
    const regs = drivers[drv].registros || [];
    regs.forEach(r => {
      // Somente registros OK/ERRO/dup? — aqui exportamos todos os que existem em 'registros'
      // Se você não quiser exportar ERRO/dup, basta filtrar: if (r.status === 'ok') ...
      linhas.push([operador || "", drv, r.codigo || "", r.dataHora || ""]);
    });
  });

  // Se não há dados além do cabeçalho
  if (linhas.length === 1) {
    alert("Não há registros para exportar.");
    return;
  }

  // Helper: escapar XML
  const esc = (s) => String(s).replace(/&/g,"&amp;")
                              .replace(/</g,"&lt;")
                              .replace(/>/g,"&gt;")
                              .replace(/"/g,"&quot;")
                              .replace(/'/g,"&apos;");

  // Cria o conteúdo da sheet (Sheet1) em XML
  // Linhas: <row r="i">  Células string: <c t="inlineStr"><is><t>...</t></is></c>
  let sheetRows = "";
  for (let i = 0; i < linhas.length; i++) {
    const rowIndex = i + 1;
    const cols = linhas[i];

    let rowCells = "";
    for (let j = 0; j < cols.length; j++) {
      // Excel column letters simples (A, B, C, ...). Até D aqui.
      const colLetter = String.fromCharCode(65 + j);
      const cellRef = `${colLetter}${rowIndex}`;
      const val = cols[j] == null ? "" : cols[j];

      rowCells += `
        <c r="${cellRef}" t="inlineStr">
          <is><t>${esc(val)}</t></is>
        </c>`;
    }

    sheetRows += `<row r="${rowIndex}">${rowCells}\n</row>\n`;
  }

  const sheetXML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
               xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheetData>
        ${sheetRows}
      </sheetData>
    </worksheet>`;

  // Workbook XML (1 planilha)
  const workbookXML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets>
        <sheet name="Bipagens" sheetId="1" r:id="rId1"/>
      </sheets>
    </workbook>`;

  // styles.xml (mínimo — opcional; mantido para compatibilidade)
  const stylesXML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    </styleSheet>`;

  // _rels/.rels
  const relsXML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1"
                    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
                    Target="xl/workbook.xml"/>
    </Relationships>`;

  // xl/_rels/workbook.xml.rels
  const wbRelsXML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1"
                    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
                    Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2"
                    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
                    Target="styles.xml"/>
    </Relationships>`;

  // [Content_Types].xml
  const contentTypesXML =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml"
        ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml"
        ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      <Override PartName="/xl/styles.xml"
        ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
    </Types>`;

  // Monta o ZIP (.xlsx) com JSZip
  const zip = new JSZip();
  // Raiz
  zip.file("[Content_Types].xml", contentTypesXML.trim());
  zip.folder("_rels").file(".rels", relsXML.trim());
  // xl/*
  const xl = zip.folder("xl");
  xl.file("workbook.xml", workbookXML.trim());
  xl.file("styles.xml", stylesXML.trim());
  xl.folder("_rels").file("workbook.xml.rels", wbRelsXML.trim());
  xl.folder("worksheets").file("sheet1.xml", sheetXML.trim());

  // Gera e baixa
  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const fileName = `bipagens_${timestamp}.xlsx`;

  zip.generateAsync({ type: "blob" }).then(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }).catch(() => {
    alert("Falha ao gerar o Excel.");
  });
}

/* =========================
GERAR QR (OTIMIZAÇÃO 3 + 4 APLICADAS)
- Paralelização em blocos
- ZIP incremental (STORE)
========================= */
async function gerarQRCodes() {

  zipGlobal = new JSZip();

  const driversKeys = Object.keys(drivers);
  if (!driversKeys.length) {
    alert("Nada para gerar");
    return;
  }

  // 🎯 overlay
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;
    z-index:9999;color:white;font-size:18px
  `;

  overlay.innerHTML = `
    <div style="background:#111;padding:25px;border-radius:12px;text-align:center;min-width:260px">
      <h2>Modo Industrial 🚀</h2>
      <p id="statusQR">Preparando...</p>
      <div style="margin-top:10px;background:#333;height:10px;border-radius:5px;overflow:hidden">
        <div id="barraQR" style="height:100%;width:0%;background:#22c55e"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const status = document.getElementById("statusQR");
  const barra = document.getElementById("barraQR");

  // 🔢 junta todos os códigos
  let todos = [];

  driversKeys.forEach(d => {
    const cods = drivers[d].codigos.filter(c => c.startsWith("TBR"));
    cods.forEach(c => {
      todos.push({ driver: d, codigo: c });
    });
  });

  if (!todos.length) {
    alert("Sem códigos válidos");
    document.body.removeChild(overlay);
    return;
  }

  let total = todos.length;
  let feitos = 0;

  // 🧵 quantidade de workers (CPU inteligente)
  const WORKERS = Math.min(8, navigator.hardwareConcurrency || 4);

  let fila = [...todos];

  let workers = [];

  function atualizar() {
    feitos++;

    if (feitos % 5 !== 0 && feitos !== total) return;

    const pct = Math.floor((feitos / total) * 100);
    status.innerText = `${feitos} / ${total} (${pct}%)`;
    barra.style.width = pct + "%";
  }

  function criarWorker() {
    const w = new Worker("qrWorker.js");

    w.onmessage = (e) => {
      const { ok, codigo, base64 } = e.data;

      if (ok && base64) {
        const drv = codigoToDriver[codigo];
        const pasta = zipGlobal.folder(drv);

        pasta.file(`${codigo}.png`, base64, {
          base64: true,
          compression: "STORE"
        });
      }

      atualizar();
      processar(w);
    };

    return w;
  }

  // 🔗 mapa rápido código → driver
  const codigoToDriver = {};
  todos.forEach(t => codigoToDriver[t.codigo] = t.driver);

  function processar(worker) {
    if (!fila.length) {
      worker.terminate();
      return;
    }

    const item = fila.shift();
    worker.postMessage({ codigo: item.codigo });
  }

  // 🚀 start workers
  for (let i = 0; i < WORKERS; i++) {
    const w = criarWorker();
    workers.push(w);
    processar(w);
  }

  // ⏳ aguarda finalizar
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (feitos >= total) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });

  status.innerText = "Compactando...";

  const blob = await zipGlobal.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `QRCODES_${Date.now()}.zip`;
  a.click();

  URL.revokeObjectURL(a.href);

  document.body.removeChild(overlay);

  alert("🔥 Finalizado em modo industrial!");
}
/* =========================
DOWNLOAD
========================= */

function downloadZIP() {
  if (!zipGlobal) {
    alert("Gere os QR Codes primeiro");
    return;
  }

  zipGlobal.generateAsync({ type: "blob" }).then(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "QRCODES.zip";
    a.click();
    URL.revokeObjectURL(a.href); // libera memória
  });
}/* =========================
RESET
========================= */

function resetApp(){

if(!confirm("Resetar tudo?")) return;

localStorage.removeItem("amazon_state");
desativarWakeLock();

location.reload();

}


/* =========================
SONS
========================= */

function tocar(tipo){

const s=document.getElementById("sound"+tipo.charAt(0).toUpperCase()+tipo.slice(1));

if(s){

s.currentTime=0;

s.play();

}

}
// Liberar WakeLock ao sair
window.addEventListener("beforeunload", desativarWakeLock);