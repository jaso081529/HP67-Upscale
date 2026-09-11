(() => {
"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const state = {
  jobs: [], currentId: null, zoom: "fit", history: [],
  safeMaxPixels: 70_000_000, safeMaxDimension: 16384
};

const els = {
  dropzone: $("#dropzone"), fileInput: $("#fileInput"), pickFiles: $("#pickFiles"),
  jobList: $("#jobList"), clearJobs: $("#clearJobs"), currentName: $("#currentName"),
  currentMeta: $("#currentMeta"), compareStage: $("#compareStage"), canvasScroller: $("#canvasScroller"),
  compareWrap: $("#compareWrap"), before: $("#beforeCanvas"), after: $("#afterCanvas"),
  afterClip: $("#afterClip"), divider: $("#divider"), compareSlider: $("#compareSlider"),
  statusText: $("#statusText"), progressBar: $("#progressBar"), analysisText: $("#analysisText"),
  printInfo: $("#printInfo"), runAuto: $("#runAuto"), resetCurrent: $("#resetCurrent"),
  mode: $("#mode"), upscale: $("#upscale"), customWidth: $("#customWidth"),
  faceEnhance: $("#faceEnhance"), removeBg: $("#removeBg"), bgMode: $("#bgMode"),
  exportFormat: $("#exportFormat"), exportQuality: $("#exportQuality"),
  exportCurrent: $("#exportCurrent"), exportZip: $("#exportZip"), downloadOriginal: $("#downloadOriginal"),
  exportNotice: $("#exportNotice"), historyList: $("#historyList"), compatInfo: $("#compatInfo")
};

const controlIds = ["whiteStrength","vibrance","saturation","contrast","highlights","shadows","temperature","denoise","sharpen"];
for (const id of controlIds) {
  const input = $("#"+id), out = $("#"+id+"Out");
  input.addEventListener("input", () => out.textContent = input.value);
}

const presets = {
  customer: {whiteStrength:78,vibrance:24,saturation:6,contrast:12,highlights:-4,shadows:5,temperature:-3,denoise:10,sharpen:32,upscale:"2"},
  print:    {whiteStrength:78,vibrance:22,saturation:4,contrast:10,highlights:-5,shadows:5,temperature:-2,denoise:8,sharpen:36,upscale:"4"},
  web:      {whiteStrength:66,vibrance:20,saturation:4,contrast:10,highlights:-3,shadows:4,temperature:-2,denoise:8,sharpen:25,upscale:"1"},
  social:   {whiteStrength:72,vibrance:28,saturation:8,contrast:14,highlights:-4,shadows:5,temperature:-2,denoise:8,sharpen:28,upscale:"2"},
  colors:   {whiteStrength:70,vibrance:26,saturation:5,contrast:10,highlights:-3,shadows:4,temperature:-3,denoise:0,sharpen:0,upscale:"1"},
  upscale:  {whiteStrength:0,vibrance:0,saturation:0,contrast:0,highlights:0,shadows:0,temperature:0,denoise:0,sharpen:18,upscale:"4"},
  white:    {whiteStrength:92,vibrance:0,saturation:0,contrast:3,highlights:0,shadows:0,temperature:-4,denoise:0,sharpen:0,upscale:"1"}
};

function setPreset(name){
  const p = presets[name]; if(!p) return;
  for(const [k,v] of Object.entries(p)){
    const el=$("#"+k); if(!el) continue; el.value=v;
    const out=$("#"+k+"Out"); if(out) out.textContent=v;
  }
  $$(".preset").forEach(x=>x.classList.toggle("active", x.dataset.preset===name));
}
$$(".preset").forEach(b=>b.addEventListener("click",()=>setPreset(b.dataset.preset)));

function currentJob(){ return state.jobs.find(j=>j.id===state.currentId) || null; }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function fmtBytes(n){ const u=["B","KB","MB","GB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++} return `${n.toFixed(i?1:0)} ${u[i]}`; }
function baseName(name){ return name.replace(/\.[^.]+$/,""); }
function clamp(v,min=0,max=255){ return v<min?min:v>max?max:v; }
function sleep(){ return new Promise(r=>setTimeout(r,0)); }
function setStatus(text,pct=0){ els.statusText.textContent=text; els.progressBar.style.width=`${clamp(pct,0,100)}%`; }
function updateJobProgress(job,pct,status){ job.progress=pct; job.status=status; renderJobs(); }

function compatibility(){
  const parts = [
    `OffscreenCanvas: ${"OffscreenCanvas" in window ? "ja":"nein"}`,
    `FaceDetector: ${"FaceDetector" in window ? "ja":"nein"}`,
    `HEIC-Decoder: ${window.heic2any ? "geladen":"nicht geladen"}`,
    `TIFF: ${window.UTIF ? "geladen":"nicht geladen"}`,
    `ZIP: ${window.JSZip ? "geladen":"nicht geladen"}`
  ];
  els.compatInfo.textContent = parts.join(" • ");
}
window.addEventListener("load", compatibility);

els.pickFiles.onclick=()=>els.fileInput.click();
els.fileInput.onchange=(e)=>addFiles([...e.target.files]);
["dragenter","dragover"].forEach(ev=>els.dropzone.addEventListener(ev,e=>{e.preventDefault();els.dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(ev=>els.dropzone.addEventListener(ev,e=>{e.preventDefault();els.dropzone.classList.remove("drag")}));
els.dropzone.addEventListener("drop",e=>addFiles([...e.dataTransfer.files]));
els.dropzone.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();els.fileInput.click()}});

async function addFiles(files){
  for(const file of files){
    const job={id:uid(),file,name:file.name,size:file.size,type:file.type||"unbekannt",status:"geladen",progress:0,decoded:null,originalCanvas:null,resultCanvas:null,analysis:null,warnings:[],created:new Date()};
    state.jobs.push(job);
    if(!state.currentId) state.currentId=job.id;
  }
  renderJobs(); selectJob(state.currentId);
}

function renderJobs(){
  if(!state.jobs.length){els.jobList.innerHTML='<div class="empty-state">Noch keine Bilder geladen.</div>';return}
  els.jobList.innerHTML="";
  for(const j of state.jobs){
    const d=document.createElement("div"); d.className="job-item"+(j.id===state.currentId?" active":"");
    d.innerHTML=`<strong title="${escapeHtml(j.name)}">${escapeHtml(j.name)}</strong><span>${fmtBytes(j.size)} • ${escapeHtml(j.status)}</span><div class="job-progress"><i style="width:${j.progress||0}%"></i></div>`;
    d.onclick=()=>selectJob(j.id); els.jobList.appendChild(d);
  }
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

async function selectJob(id){
  state.currentId=id; renderJobs();
  const job=currentJob(); if(!job) return;
  els.currentName.textContent=job.name; els.currentMeta.textContent=`${fmtBytes(job.size)} • ${job.type}`;
  try{
    if(!job.originalCanvas){
      setStatus("Original wird dekodiert …",5); updateJobProgress(job,5,"dekodieren");
      const decoded=await decodeFile(job.file);
      job.decoded=decoded;
      const c=document.createElement("canvas"); c.width=decoded.width; c.height=decoded.height;
      c.getContext("2d",{willReadFrequently:true}).drawImage(decoded.source,0,0);
      job.originalCanvas=c; updateJobProgress(job,10,"bereit");
      if(decoded.cleanup) decoded.cleanup();
    }
    drawComparison(job); analyzeAndShow(job);
  }catch(err){
    job.status="Fehler"; job.warnings.push(err.message); updateJobProgress(job,0,"Fehler");
    setStatus(`Fehler: ${err.message}`,0); els.analysisText.textContent=err.message;
  }
}

async function decodeFile(file){
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(["heic","heif"].includes(ext)){
    if(!window.heic2any) throw new Error("HEIC/HEIF-Decoder konnte nicht geladen werden.");
    const blob=await window.heic2any({blob:file,toType:"image/png",quality:1});
    const b=Array.isArray(blob)?blob[0]:blob; return decodeBlob(b);
  }
  if(["tif","tiff"].includes(ext)){
    if(!window.UTIF) throw new Error("TIFF-Decoder konnte nicht geladen werden.");
    const buf=await file.arrayBuffer(), ifds=UTIF.decode(buf); if(!ifds.length) throw new Error("TIFF enthält kein lesbares Bild.");
    UTIF.decodeImage(buf,ifds[0]); const rgba=UTIF.toRGBA8(ifds[0]);
    const c=document.createElement("canvas"); c.width=ifds[0].width;c.height=ifds[0].height;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba),c.width,c.height),0,0);
    return {width:c.width,height:c.height,source:c};
  }
  return decodeBlob(file);
}

async function decodeBlob(blob){
  if("createImageBitmap" in window){
    try{
      const bm=await createImageBitmap(blob,{imageOrientation:"from-image",premultiplyAlpha:"default",colorSpaceConversion:"default"});
      return {width:bm.width,height:bm.height,source:bm,cleanup:()=>bm.close()};
    }catch(e){}
  }
  const url=URL.createObjectURL(blob);
  const img=new Image();
  await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error("Format wird von diesem Browser nicht dekodiert."));img.src=url});
  return {width:img.naturalWidth,height:img.naturalHeight,source:img,cleanup:()=>URL.revokeObjectURL(url)};
}

function drawComparison(job){
  if(!job?.originalCanvas) return;
  const a=job.originalCanvas, b=job.resultCanvas||a;
  els.before.width=a.width;els.before.height=a.height;els.before.getContext("2d").drawImage(a,0,0);
  els.after.width=b.width;els.after.height=b.height;els.after.getContext("2d").drawImage(b,0,0);
  applyZoom();
  els.canvasScroller.hidden=false; els.compareStage.classList.remove("empty");
  const empty=els.compareStage.querySelector(".empty-preview"); if(empty) empty.style.display="none";
  els.compareSlider.disabled=false; updateCompare();
  updatePrintInfo(b.width,b.height);
}
function applyZoom(){
  const job=currentJob(); if(!job?.originalCanvas) return;
  const a=job.originalCanvas,b=job.resultCanvas||a;
  const logicalW=Math.max(a.width,b.width),logicalH=Math.max(a.height,b.height);
  let scale=1;
  if(state.zoom==="fit"){
    const maxW=Math.max(280,els.compareStage.clientWidth-40), maxH=620;
    scale=Math.min(1,maxW/logicalW,maxH/logicalH);
  }else scale=Number(state.zoom);
  const w=Math.max(1,Math.round(logicalW*scale)),h=Math.max(1,Math.round(logicalH*scale));
  els.compareWrap.style.width=w+"px";els.compareWrap.style.height=h+"px";
  [els.before,els.after].forEach(c=>{c.style.width=w+"px";c.style.height=h+"px"});
}
$$(".zoom-btn").forEach(b=>b.onclick=()=>{state.zoom=b.dataset.zoom;$$(".zoom-btn").forEach(x=>x.classList.toggle("active",x===b));applyZoom()});
window.addEventListener("resize",()=>{if(state.zoom==="fit")applyZoom()});
els.compareSlider.oninput=updateCompare;
function updateCompare(){const v=Number(els.compareSlider.value);els.afterClip.style.clipPath=`inset(0 ${100-v}% 0 0)`;els.divider.style.left=v+"%"}

async function analyzeAndShow(job){
  if(!job.originalCanvas) return;
  if(!job.analysis) job.analysis=analyzeCanvas(job.originalCanvas);
  const a=job.analysis;
  els.analysisText.innerHTML =
    `Auflösung: <b>${a.width}×${a.height}</b><br>`+
    `Licht: ${a.exposureLabel}<br>Kontrast: ${a.contrastLabel}<br>`+
    `Weißpunkt geschätzt: RGB ${a.whitePoint.map(x=>Math.round(x)).join("/")}<br>`+
    `Warm-/Farbstich: ${a.castLabel}<br>`+
    `Beige-Off-White Verdacht: <b>${a.beigeRisk?"ja":"gering"}</b><br>`+
    `Schwarzpunkt: ${a.blackPoint} • Weißpunkt-Luma: ${a.whiteLuma}`;
}
function analyzeCanvas(canvas){
  const ctx=canvas.getContext("2d",{willReadFrequently:true}), w=canvas.width,h=canvas.height;
  const data=ctx.getImageData(0,0,w,h).data;
  const pixels=w*h, step=Math.max(1,Math.floor(Math.sqrt(pixels/220000)));
  const hist=new Uint32Array(256); let count=0,sum=0,sum2=0,wr=0,wg=0,wb=0,wc=0,warm=0,neutralBright=0;
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
    const i=(y*w+x)*4;if(data[i+3]<16)continue;
    const r=data[i],g=data[i+1],b=data[i+2], mx=Math.max(r,g,b),mn=Math.min(r,g,b);
    const l=Math.round(.2126*r+.7152*g+.0722*b); hist[l]++;count++;sum+=l;sum2+=l*l;
    const chrom=(mx-mn)/255;
    if(l>180&&chrom<.22){wr+=r;wg+=g;wb+=b;wc++; if(r>b+5||g>b+6)warm++; if(chrom<.08)neutralBright++}
  }
  const avg=sum/Math.max(1,count),sd=Math.sqrt(Math.max(0,sum2/Math.max(1,count)-avg*avg));
  const percentile=(p)=>{let t=count*p,s=0;for(let i=0;i<256;i++){s+=hist[i];if(s>=t)return i}return p<.5?0:255};
  const bp=percentile(.01),wl=percentile(.995),wp=wc?[wr/wc,wg/wc,wb/wc]:[wl,wl,wl];
  const castR=wp[0]-wp[2],castG=wp[1]-wp[2];
  let castLabel="neutral"; if(castR>8||castG>8)castLabel="warm / gelblich"; else if(castR<-8)castLabel="kühl / cyan"; else if(wp[1]>wp[0]+8)castLabel="grünlich"; else if(wp[0]>wp[1]+10)castLabel="magenta/rot";
  return {width:w,height:h,blackPoint:bp,whiteLuma:wl,whitePoint:wp,
    exposureLabel:avg<85?"dunkel":avg>185?"hell":"ausgewogen",
    contrastLabel:sd<38?"flach":sd>72?"hoch":"normal",castLabel,
    beigeRisk:wc>20 && warm/Math.max(1,wc)>.45 && wp[2]<245, avgLuma:avg, sd
  };
}

function readSettings(){
  const s={mode:els.mode.value,upscale:Number(els.upscale.value),customWidth:Number(els.customWidth.value)||0,
    faceEnhance:els.faceEnhance.checked,removeBg:els.removeBg.checked,bgMode:els.bgMode.value};
  for(const id of controlIds) s[id]=Number($("#"+id).value);
  return s;
}

els.runAuto.onclick=()=>processCurrent();
async function processCurrent(){
  const job=currentJob(); if(!job?.originalCanvas){setStatus("Bitte zuerst ein Bild laden.",0);return}
  const s=readSettings();
  try{
    updateJobProgress(job,12,"Analyse"); setStatus("Bildanalyse …",12); await sleep();
    job.analysis=analyzeCanvas(job.originalCanvas); analyzeAndShow(job);

    let c=cloneCanvas(job.originalCanvas);
    updateJobProgress(job,24,"Farbkorrektur");setStatus("Weißpunkt, Levels und Farben …",24);
    c=applyColorPipeline(c,job.analysis,s);await sleep();

    if(s.removeBg){
      updateJobProgress(job,36,"Hintergrund");setStatus("Hintergrund wird analysiert …",36);
      c=removeEdgeBackground(c,s.bgMode);await sleep();
    }

    if(s.denoise>0){
      updateJobProgress(job,48,"Denoise");setStatus("Rauschen reduzieren …",48);
      c=applyDenoise(c,s.denoise);await sleep();
    }

    if(s.sharpen>0){
      updateJobProgress(job,62,"Schärfen");setStatus("Kanten und Textur schärfen …",62);
      c=applySharpen(c,s.sharpen);await sleep();
    }

    if(s.faceEnhance){
      updateJobProgress(job,70,"Face Enhance");setStatus("Gesichter prüfen …",70);
      c=await applyFaceEnhance(c,job);await sleep();
    }

    updateJobProgress(job,78,"Upscale");setStatus("Auflösung hochskalieren …",78);
    c=await upscaleCanvas(c,s,job);

    job.resultCanvas=c; job.status="fertig"; job.progress=100;
    drawComparison(job); renderJobs(); setStatus("Fertig – kundenfertige Vorschau erstellt.",100);
    addHistory(job,s);
  }catch(err){
    job.status="Fehler";job.warnings.push(err.message);renderJobs();setStatus(`Fehler: ${err.message}`,0);
  }
}

function cloneCanvas(src){const c=document.createElement("canvas");c.width=src.width;c.height=src.height;c.getContext("2d").drawImage(src,0,0);return c}

function applyColorPipeline(canvas,a,s){
  const ctx=canvas.getContext("2d",{willReadFrequently:true}),img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data;
  const bp=Math.max(0,a.blackPoint-2),wp=Math.max(bp+16,a.whiteLuma);
  const whiteTarget=252;
  const gainRaw=[whiteTarget/Math.max(1,a.whitePoint[0]),whiteTarget/Math.max(1,a.whitePoint[1]),whiteTarget/Math.max(1,a.whitePoint[2])];
  const ws=s.whiteStrength/100, contrast=1+s.contrast/100;
  const temp=s.temperature/100, vib=s.vibrance/100,satAdj=s.saturation/100;
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]===0)continue;
    let r=d[i],g=d[i+1],b=d[i+2];
    const origR=r,origG=g,origB=b;
    r=(r-bp)*255/(wp-bp);g=(g-bp)*255/(wp-bp);b=(b-bp)*255/(wp-bp);
    const max0=Math.max(origR,origG,origB),min0=Math.min(origR,origG,origB), l0=(origR+origG+origB)/3;
    const skin=origR>95&&origG>40&&origB>20&&(max0-min0)>15&&origR>origG&&origR>origB&&Math.abs(origR-origG)>10;
    const castStrength=ws*(skin?.25:1);
    r*=1+(gainRaw[0]-1)*castStrength;g*=1+(gainRaw[1]-1)*castStrength;b*=1+(gainRaw[2]-1)*castStrength;

    // Lokale Off-White-Neutralisierung: greift vor allem in hellen, relativ wenig gesättigten Flächen.
    let mx=Math.max(r,g,b),mn=Math.min(r,g,b),ch=(mx-mn)/255,lum=(r+g+b)/765;
    const nearWhite=Math.max(0,Math.min(1,(lum-.66)/.28))*Math.max(0,Math.min(1,(.22-ch)/.18));
    const warmBias=Math.max(0,((r+b? r-b:0)+(g-b)*.75)/80);
    const neutralWeight=nearWhite*ws*Math.min(1,.35+warmBias)*(skin?.12:1);
    if(neutralWeight>0){
      const neutral=Math.min(255,(r+g+b)/3 + (255-(r+g+b)/3)*.22*ws);
      r=r*(1-neutralWeight)+neutral*neutralWeight;
      g=g*(1-neutralWeight)+neutral*neutralWeight;
      b=b*(1-neutralWeight)+neutral*neutralWeight;
    }

    // Temperatur
    r*=1+temp*.10;b*=1-temp*.12;g*=1-temp*.015;

    // Highlights / Shadows luma-gewichtet
    lum=(.2126*r+.7152*g+.0722*b)/255;
    const sh=(s.shadows/100)*(1-lum)*(1-lum)*45;
    const hi=(s.highlights/100)*lum*lum*45;
    r+=sh+hi;g+=sh+hi;b+=sh+hi;

    // Kontrast
    r=(r-127.5)*contrast+127.5;g=(g-127.5)*contrast+127.5;b=(b-127.5)*contrast+127.5;

    // Vibrance + Saturation; Haut wird geschont
    const avg=(r+g+b)/3; mx=Math.max(r,g,b);mn=Math.min(r,g,b);
    const currentSat=(mx-mn)/Math.max(1,mx);
    const vibBoost=vib*(1-currentSat)*(skin?.25:1);
    const totalSat=1+vibBoost+satAdj*(skin?.35:1);
    r=avg+(r-avg)*totalSat;g=avg+(g-avg)*totalSat;b=avg+(b-avg)*totalSat;

    d[i]=clamp(r);d[i+1]=clamp(g);d[i+2]=clamp(b);
  }
  ctx.putImageData(img,0,0);return canvas;
}

function applyDenoise(canvas,strength){
  const blur=Math.min(1.8,.25+strength/45),alpha=Math.min(.38,strength/160);
  const tmp=cloneCanvas(canvas),tctx=tmp.getContext("2d");
  tctx.clearRect(0,0,tmp.width,tmp.height);tctx.filter=`blur(${blur}px)`;tctx.drawImage(canvas,0,0);tctx.filter="none";
  const ctx=canvas.getContext("2d");ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(tmp,0,0);ctx.restore();return canvas;
}

function applySharpen(canvas,strength){
  const w=canvas.width,h=canvas.height;
  if(w*h>55_000_000 && strength>55) strength=55;
  const ctx=canvas.getContext("2d",{willReadFrequently:true}),src=ctx.getImageData(0,0,w,h),out=new ImageData(w,h);
  out.data.set(src.data);const s=src.data,d=out.data,amt=(strength/100)*1.25;
  for(let y=1;y<h-1;y++){
    let i=(y*w+1)*4;
    for(let x=1;x<w-1;x++,i+=4){
      if(s[i+3]===0)continue;
      const up=i-w*4,down=i+w*4,left=i-4,right=i+4;
      for(let c=0;c<3;c++){
        const blur=(s[up+c]+s[down+c]+s[left+c]+s[right+c]+s[i+c]*4)/8;
        d[i+c]=clamp(s[i+c]+(s[i+c]-blur)*amt);
      }
    }
  }
  ctx.putImageData(out,0,0);return canvas;
}

async function applyFaceEnhance(canvas,job){
  if(!("FaceDetector" in window)){job.warnings.push("Face Enhance: FaceDetector wird von diesem Browser nicht unterstützt.");return canvas}
  try{
    const detector=new FaceDetector({fastMode:true,maxDetectedFaces:10});
    const faces=await detector.detect(canvas); if(!faces.length) return canvas;
    const base=canvas.getContext("2d");
    for(const f of faces){
      const b=f.boundingBox,pad=Math.round(Math.max(b.width,b.height)*.12);
      const x=Math.max(0,Math.floor(b.x-pad)),y=Math.max(0,Math.floor(b.y-pad));
      const w=Math.min(canvas.width-x,Math.ceil(b.width+pad*2)),h=Math.min(canvas.height-y,Math.ceil(b.height+pad*2));
      const patch=document.createElement("canvas");patch.width=w;patch.height=h;
      patch.getContext("2d").drawImage(canvas,x,y,w,h,0,0,w,h);
      applySharpen(patch,18);base.drawImage(patch,x,y);
    }
    return canvas;
  }catch(e){job.warnings.push("Face Enhance konnte nicht ausgeführt werden.");return canvas}
}

function removeEdgeBackground(canvas,mode){
  const w=canvas.width,h=canvas.height,n=w*h;
  if(n>24_000_000) throw new Error("Hintergrundentfernung ist für dieses Bild zu groß. Bitte zuerst 1×/2× verarbeiten oder kleinere Datei nutzen.");
  const ctx=canvas.getContext("2d",{willReadFrequently:true}),img=ctx.getImageData(0,0,w,h),d=img.data;
  const samples=[];
  const take=(x,y)=>{const i=(y*w+x)*4;if(d[i+3]>0)samples.push([d[i],d[i+1],d[i+2]])};
  const stride=Math.max(1,Math.floor(Math.min(w,h)/80));
  for(let x=0;x<w;x+=stride){take(x,0);take(x,h-1)}
  for(let y=0;y<h;y+=stride){take(0,y);take(w-1,y)}
  if(!samples.length)return canvas;
  samples.sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));
  const mid=samples[Math.floor(samples.length/2)], br=mid[0],bg=mid[1],bb=mid[2];
  const visited=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
  const enqueue=(idx)=>{if(!visited[idx]){visited[idx]=1;queue[tail++]=idx}};
  for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x)}
  for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1)}
  const threshold=50;
  while(head<tail){
    const p=queue[head++],i=p*4,r=d[i],g=d[i+1],b=d[i+2];
    const dist=Math.sqrt((r-br)**2+(g-bg)**2+(b-bb)**2);
    if(dist>threshold) continue;
    d[i+3]=mode==="transparent"?0:255;
    if(mode==="white"){d[i]=255;d[i+1]=255;d[i+2]=255}
    const x=p%w,y=(p/w)|0;
    if(x>0)enqueue(p-1);if(x<w-1)enqueue(p+1);if(y>0)enqueue(p-w);if(y<h-1)enqueue(p+w);
  }
  ctx.putImageData(img,0,0);return canvas;
}

async function upscaleCanvas(canvas,s,job){
  let targetW=s.customWidth>0?s.customWidth:Math.round(canvas.width*s.upscale);
  let targetH=Math.round(canvas.height*(targetW/canvas.width));
  if(targetW*targetH>state.safeMaxPixels||targetW>state.safeMaxDimension||targetH>state.safeMaxDimension){
    const scale=Math.min(Math.sqrt(state.safeMaxPixels/(canvas.width*canvas.height)),state.safeMaxDimension/canvas.width,state.safeMaxDimension/canvas.height);
    const safe=Math.max(1,Math.floor(scale*100)/100);
    targetW=Math.max(canvas.width,Math.floor(canvas.width*safe));targetH=Math.max(canvas.height,Math.floor(canvas.height*safe));
    job.warnings.push(`Upscale wegen Browser-Limit auf ${targetW}×${targetH}px begrenzt.`);
  }
  if(targetW<=canvas.width&&targetH<=canvas.height)return canvas;
  let cur=canvas;
  while(cur.width<targetW||cur.height<targetH){
    const nw=Math.min(targetW,Math.max(cur.width+1,Math.round(cur.width*1.5)));
    const nh=Math.min(targetH,Math.max(cur.height+1,Math.round(cur.height*1.5)));
    const next=document.createElement("canvas");next.width=nw;next.height=nh;
    const c=next.getContext("2d");c.imageSmoothingEnabled=true;c.imageSmoothingQuality="high";c.drawImage(cur,0,0,nw,nh);
    cur=next;await sleep();
  }
  return cur;
}

function updatePrintInfo(w,h){
  const cmW=w/300*2.54,cmH=h/300*2.54;
  els.printInfo.innerHTML=`${w}×${h}px → <b>${cmW.toFixed(1)} × ${cmH.toFixed(1)} cm</b> bei 300 DPI`;
}

function addHistory(job,s){
  const item={name:job.name,time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),size:`${job.resultCanvas.width}×${job.resultCanvas.height}`,mode:s.mode};
  state.history.unshift(item);state.history=state.history.slice(0,20);
  els.historyList.innerHTML=state.history.map(x=>`<span class="history-item">${escapeHtml(x.time)} • ${escapeHtml(x.name)} • ${x.size} • ${escapeHtml(x.mode)}</span>`).join("");
}

els.resetCurrent.onclick=()=>{const j=currentJob();if(!j)return;j.resultCanvas=null;j.progress=10;j.status="bereit";drawComparison(j);renderJobs();setStatus("Auf Original zurückgesetzt.",0)};
els.clearJobs.onclick=()=>{state.jobs=[];state.currentId=null;renderJobs();els.canvasScroller.hidden=true;els.compareSlider.disabled=true;els.currentName.textContent="Kein Bild ausgewählt";els.currentMeta.textContent="";els.analysisText.textContent="Noch keine Analyse.";els.printInfo.textContent="—";setStatus("Bereit.",0)};

els.downloadOriginal.onclick=()=>{
  const j=currentJob();if(!j)return;
  const a=document.createElement("a");a.href=URL.createObjectURL(j.file);a.download=j.file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};

async function canvasToBlob(canvas,format,quality=1){
  if(format==="tiff"){
    if(!window.UTIF) throw new Error("TIFF-Encoder ist nicht geladen.");
    const ctx=canvas.getContext("2d",{willReadFrequently:true}),rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const buf=UTIF.encodeImage(rgba,canvas.width,canvas.height);return new Blob([buf],{type:"image/tiff"});
  }
  const mime={png:"image/png",jpeg:"image/jpeg",webp:"image/webp",avif:"image/avif"}[format]||"image/png";
  const blob=await new Promise(res=>canvas.toBlob(res,mime,quality));
  if(!blob) throw new Error(`${format.toUpperCase()}-Export wird von diesem Browser nicht unterstützt.`);
  return blob;
}
function extensionFor(format){return ({jpeg:"jpg",tiff:"tiff",png:"png",webp:"webp",avif:"avif"})[format]||format}
async function exportBlobForJob(job){
  if(!job.resultCanvas) throw new Error("Dieses Bild wurde noch nicht verarbeitet.");
  const f=els.exportFormat.value,q=Number(els.exportQuality.value)/100;
  const blob=await canvasToBlob(job.resultCanvas,f,q);
  return {blob,name:`${baseName(job.name)}_enhanced.${extensionFor(f)}`};
}
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}

els.exportFormat.onchange=()=>{
  const f=els.exportFormat.value;
  els.exportNotice.textContent = f==="webp" ? "Hinweis: Canvas-WebP ist je nach Browser trotz Qualität 100 nicht garantiert mathematisch lossless. PNG/TIFF sind die sicheren verlustfreien Optionen." :
  f==="avif" ? "AVIF-Export ist browserabhängig; bei fehlendem Encoder zeigt die App einen Fehler statt still auf ein anderes Format auszuweichen." : "";
};
els.exportCurrent.onclick=async()=>{
  const j=currentJob();if(!j)return;
  try{setStatus("Export wird erstellt …",95);const {blob,name}=await exportBlobForJob(j);downloadBlob(blob,name);setStatus("Export fertig.",100)}
  catch(e){setStatus(`Exportfehler: ${e.message}`,0)}
};
els.exportZip.onclick=async()=>{
  if(!window.JSZip){setStatus("ZIP-Bibliothek nicht geladen.",0);return}
  const ready=state.jobs.filter(j=>j.resultCanvas);if(!ready.length){setStatus("Keine fertigen Jobs für ZIP.",0);return}
  const zip=new JSZip();let idx=0;
  for(const j of ready){idx++;setStatus(`ZIP: ${idx}/${ready.length} …`,Math.round(idx/ready.length*80));const {blob,name}=await exportBlobForJob(j);zip.file(name,blob);await sleep()}
  const out=await zip.generateAsync({type:"blob",compression:"DEFLATE"});downloadBlob(out,"hoodplaka67_enhanced_batch.zip");setStatus("ZIP fertig.",100)
};

// Doppelklick auf Job verarbeitet ihn direkt.
els.jobList.addEventListener("dblclick",e=>{const item=e.target.closest(".job-item");if(item)processCurrent()});
})();
