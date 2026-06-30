let qrScanner;
let cameraActive = false;
const panel = document.getElementById('devicePanel');
const uploadBtn = document.getElementById('uploadBtn');
const readQrBtn = document.getElementById('readQrBtn');

function stopQRScanner(){
    if(qrScanner){
        try{ qrScanner.clear(); }catch(e){}
        qrScanner=null;
    }
    cameraActive=false;
}

function showPanel(mode){
    if(!panel) return;
    panel.style.display='block';
    stopQRScanner();

    if(mode==='qr'){
        panel.innerHTML=`
        <div class="device-card">
          <h2>Read QR Code</h2>
          <div id="qrReader" class="qr-reader"></div>
          <label class="result-title">Scanned Result</label>
          <textarea id="qrResult" class="qr-result" readonly></textarea>
        </div>`;
        cameraActive=true;
        qrScanner=new Html5QrcodeScanner('qrReader',{fps:10,qrbox:{width:250,height:250}},false);
        qrScanner.render((text)=>{
          try {
            const data = JSON.parse(text);
            document.getElementById('qrResult').outerHTML = `
            <div id="qrResult" class="qr-result-card">
              <h3>Device Details</h3>
              <div class="qr-item"><span>Device Name</span><b>${data.device_name || ''}</b></div>
              <div class="qr-item"><span>Device Type</span><b>${data.device_type || ''}</b></div>
              <div class="qr-item"><span>Model</span><b>${data.model || ''}</b></div>
              <div class="qr-item"><span>Serial Number</span><b>${data.serial_number || ''}</b></div>
              <div class="qr-item"><span>Purchased Year</span><b>${data.purchased_year || ''}</b></div>
            </div>`;
        } catch(e) {
            document.getElementById('qrResult').value=text;
        }
        },()=>{});
    }else{
        panel.innerHTML=`
        <div class="device-card">
        <h2>Register Device</h2>
        <div class="device-form">
        <input id="device_name" placeholder="Device Name">
        <input id="device_type" placeholder="Type">
        <input id="model" placeholder="Model">
        <input id="serial_number" placeholder="Serial Number">
        <input id="purchased_year" type="number" placeholder="Purchased Year">
        <button id="saveDevice" class="action-btn">Save Device</button>
        <div class="excel-box">
          <input type="file" id="excelFile" accept=".xlsx,.xls">
          <button id="uploadExcel" class="action-btn secondary">Upload Excel</button>
        </div>
        <p id="uploadStatus"></p>
        </div></div>`;
        document.getElementById('saveDevice').onclick=saveDeviceData;
        document.getElementById('uploadExcel').onclick=uploadExcelData;
    }
}

uploadBtn?.addEventListener('click',e=>{e.preventDefault();showPanel('device');});
readQrBtn?.addEventListener('click',e=>{e.preventDefault();showPanel('qr');});

async function saveDeviceData(){
 const data={
  device_name: document.getElementById('device_name').value.trim(),
  device_type: document.getElementById('device_type').value.trim(),
  model: document.getElementById('model').value.trim(),
  serial_number: document.getElementById('serial_number').value.trim(),
  purchased_year: Number(document.getElementById('purchased_year').value)
};

if(!data.device_name || !data.device_type || !data.model || !data.serial_number || !data.purchased_year){
  document.getElementById('uploadStatus').innerText='Please fill all device details';
  return;
}
 const r=await fetch('/api/devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const result=await r.json();
const status=document.getElementById('uploadStatus');
status.className = r.ok ? 'success-message' : 'error-message';
status.innerText = r.ok ? 'Device saved successfully' : 'Device save failed';
console.log(result);
}

async function uploadExcelData(){
 const file=document.getElementById('excelFile').files[0];
 const status=document.getElementById('uploadStatus');
 if(!file){status.innerText='Select an Excel file first';return;}
 const fd=new FormData(); fd.append('file',file);
 try{
  const r=await fetch('/api/devices/upload',{method:'POST',body:fd});
  const result=await r.json();
  status.className='success-message';
  status.innerText='Uploaded '+(result.uploaded||0)+' devices successfully';
 }catch(e){status.innerText='Upload failed';}
}


// Stop camera when leaving dashboard/page
window.addEventListener('beforeunload', function(){
    stopQRScanner();
});

// Stop camera when browser tab/page becomes hidden
document.addEventListener('visibilitychange', function(){
    if(document.hidden){
        stopQRScanner();
    }
});

// Expose for sidebar navigation
window.stopQRScanner = stopQRScanner;
