import { flag } from './server.flags.js';
import { downloadImage } from './capture.js'

const container = document.querySelector('.container');
const captureBtn = document.querySelector('#capture-btn');
let preview = null;
let previewImg = null;
let previewDownloadBtn = null;

function setPreviewLayer(imgBase64) {
    if (!preview) {
        preview = document.createElement('div');
        preview.style.position = 'abosolute';
        preview.style.width = '90%';
        preview.style.height = '90%';
        preview.style.backgroundColor = '#eee';
        preview.style.borderRadius = '8px';
        preview.style.display = 'none';
        preview.style.justifyContent = 'center';
        preview.style.zIndex = '2';

        previewImg = new Image();
        preview.appendChild(previewImg);
        previewImg.style.position = 'absolute';
        previewImg.style.width = '80%';
        previewImg.style.paddingTop = '40px';
        
        previewImg.onload = () => {
            preview.style.display = "flex";
        };

        previewDownloadBtn = document.createElement('button');
        preview.appendChild(previewDownloadBtn);
        previewDownloadBtn.style.position = 'absolute';
        previewDownloadBtn.style.backgroundColor = '#888'
        previewDownloadBtn.style.width = '30px';
        previewDownloadBtn.style.height = '30px';
        previewDownloadBtn.style.borderRadius = '50%';
        previewDownloadBtn.style.bottom = '80px';
        previewDownloadBtn.style.margin = '0 auto';

        previewDownloadBtn.addEventListener('click', () => {
            downloadImage(imgBase64);
        });

        container.appendChild(preview);
    }

    previewImg.src = imgBase64;
}

function connectServer() {
    const wss = new WebSocket('wss://127.0.0.1:5503');

    wss.onmessage = (msg) => {
        const imgBase64 = msg.data;

        setPreviewLayer(imgBase64);
    };

    wss.onopen = () => {
        wss.send(JSON.stringify({ 'flag' : flag.CLIENT_FLAG }));
        console.log('connect successfully!');
    };

    wss.onclose = () => {
        console.log('disconneted')
    };

    wss.onerror = () => {
        console.log('error occured! failed to connect server.')
    };

    return {
        sendCaptureMsg: () => {
            wss.send(JSON.stringify({ 'flag' : flag.GET_IMAGE_FLAG }));
        }
    } 
}

window.onload = () => {
    const server = connectServer();
    captureBtn.addEventListener('click', () => {
        server.sendCaptureMsg();
    });
}