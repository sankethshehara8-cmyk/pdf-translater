pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let originalPages = [];
let translatedPages = [];
let fileNameGlobal = "translated_sinhala.pdf";

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const translateBtn = document.getElementById('translateBtn');
const progress = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const statusEl = document.getElementById('status');
const originalTextEl = document.getElementById('originalText');
const translatedTextEl = document.getElementById('translatedText');
const preview = document.getElementById('preview');
const downloadBtn = document.getElementById('downloadBtn');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e)=>{ e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', ()=> uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e)=>{
  e.preventDefault(); uploadArea.classList.remove('dragover');
  if(e.dataTransfer.files.length){ handleFile(e.dataTransfer.files[0]); }
});
fileInput.addEventListener('change', ()=>{ if(fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(file){
  if(file.type !== 'application/pdf'){ alert('PDF එකක් දාන්න'); return; }
  fileNameGlobal = file.name.replace('.pdf','') + '_sinhala.pdf';
  fileNameEl.textContent = "📄 " + file.name + " (" + (file.size/1024/1024).toFixed(2) + " MB)";
  translateBtn.disabled = false;
  translateBtn._file = file;
}

translateBtn.addEventListener('click', async ()=>{
  const file = translateBtn._file;
  if(!file) return;
  translateBtn.disabled = true;
  progress.style.display = 'block';
  originalPages = [];
  translatedPages = [];
 
  try{
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const totalPages = pdf.numPages;
    statusEl.textContent = `පිටු ${totalPages}ක් හමු විය. කියවමින්...`;
   
    for(let i=1;i<=totalPages;i++){
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item=>item.str).join(' ');
      originalPages.push(text);
      progressFill.style.width = ((i/totalPages)*30) + '%';
    }
   
    originalTextEl.textContent = originalPages.join('\n\n--- පිටුව ---\n\n').substring(0,5000) + "...";
    preview.classList.add('show');
   
    statusEl.textContent = `සිංහලට පරිවර්තනය කරමින්... (0/${totalPages})`;
    for(let i=0;i<totalPages;i++){
      const englishText = originalPages[i];
      const chunks = englishText.match(/.{1,400}/g) || [englishText];
      let translatedChunkFull = "";
      for(let c=0;c<chunks.length;c++){
        const chunk = chunks[c];
        if(chunk.trim().length < 3){ translatedChunkFull += chunk + " "; continue; }
        try{
          const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|si`);
          const data = await res.json();
          let trans = data.responseData ? data.responseData.translatedText : chunk;
          translatedChunkFull += trans + " ";
        }catch(e){
          translatedChunkFull += chunk + " ";
        }
        await new Promise(r=>setTimeout(r, 400));
      }
      translatedPages.push(translatedChunkFull);
      const pct = 30 + ((i+1)/totalPages)*70;
      progressFill.style.width = pct + '%';
      statusEl.textContent = `සිංහලට පරිවර්තනය කරමින්... (${i+1}/${totalPages})`;
      translatedTextEl.innerHTML = translatedPages.join('<br><br>--- පිටුව ---<br><br>').substring(0,5000);
    }
   
    statusEl.textContent = `✅ පිටු ${totalPages}ම පරිවර්තනය ඉවරයි!`;
    downloadBtn.style.display = 'block';
    progressFill.style.width = '100%';
   
  }catch(err){
    console.error(err);
    statusEl.textContent = "❌ Error: " + err.message;
    translateBtn.disabled = false;
  }
});

downloadBtn.addEventListener('click', async ()=>{
  statusEl.textContent = "📄 Iskole Potha Font එක සමග PDF එක හදමින්...";
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
 
  try{
    const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/iskolepotha/IskoolaPotha-Regular.ttf';
    const fontRes = await fetch(fontUrl);
    const fontBuffer = await fontRes.arrayBuffer();
    const binary = new Uint8Array(fontBuffer);
    let binaryString = '';
    for(let i=0;i<binary.length;i++) binaryString += String.fromCharCode(binary[i]);
    const base64 = btoa(binaryString);
   
    doc.addFileToVFS('IskoolaPotha.ttf', base64);
    doc.addFont('IskoolaPotha.ttf', 'IskoolaPotha', 'normal');
    doc.setFont('IskoolaPotha');
  }catch(e){
    console.log('Font load failed, using default', e);
    doc.setFont('helvetica');
  }
 
  for(let i=0;i<translatedPages.length;i++){
    if(i>0) doc.addPage();
    doc.setFontSize(12);
    const text = translatedPages[i];
    const lines = doc.splitTextToSize(text, 170);
    let y = 20;
    doc.text(`පිටුව ${i+1} - සිංහල පරිවර්තනය`, 15, 10);
    for(let line of lines){
      if(y>280){ doc.addPage(); y=20; }
      doc.text(line, 15, y);
      y+=7;
    }
  }
 
  doc.save(fileNameGlobal);
  statusEl.textContent = "📥 Download ඉවරයි!";
});