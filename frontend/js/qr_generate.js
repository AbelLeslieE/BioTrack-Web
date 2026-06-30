document.addEventListener('DOMContentLoaded', () => {

const modal = document.getElementById('qrModal');
const deviceSelect = document.getElementById('deviceSelect');
const generateBtn = document.getElementById('generatePdfBtn');
const closeBtn = document.getElementById('closeQrModal');

document.getElementById('generateQrBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();

    modal.style.display = 'flex';

    const response = await fetch('/api/devices');
    const devices = await response.json();

    deviceSelect.innerHTML = '';

    devices.forEach(d => {
        const option = document.createElement('option');
        option.value = d.id;
        option.textContent = d.device_name;
        deviceSelect.appendChild(option);
    });
});


generateBtn?.addEventListener('click', () => {

    if(!deviceSelect.value){
        alert('Please select a device');
        return;
    }

    window.open(
        `/api/devices/${deviceSelect.value}/qr`,
        '_blank'
    );

});


closeBtn?.addEventListener('click', () => {
    modal.style.display = 'none';
});

});
