import { flag } from './server.flags.js';
import { downloadImage } from './capture.js'

const guideContainer = document.querySelector('.guide-container');
const captureBtn = document.querySelector('#capture-btn');
let preview = null;
let previewImg = null;


function setPreviewLayer(imgBase64) {
    if (!preview) {
        preview = document.createElement('div');
        preview.style.position = 'abosolute';
        preview.style.width = '100%';
        preview.style.height = '100%';
        preview.style.backgroundColor = '#ccc';
        preview.style.display = 'none';
        preview.style.justifyContent = 'center';
        preview.style.alignItems = 'center';
        preview.style.zIndex = '2';

        previewImg = new Image();
        preview.appendChild(previewImg);
        previewImg.style.position = 'absolute';
        previewImg.style.width = '95%';
        previewImg.style.height = '95%';
        
        previewImg.onload = () => {
            captureBtn.style.backgroundColor = "#CCC";
            preview.style.display = "flex";
        };

        guideContainer.appendChild(preview);
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
        captureBtn.style.backgroundColor = "#FF3333";
        server.sendCaptureMsg();
    });
}