import { flag } from './server.flags.js';
import { downloadImage } from './capture.js'

const guideContainer = document.querySelector('.guide-container');
const captureBtn = document.querySelector('#capture-btn');
const downloadIcon = document.querySelector('#download-icon');
let preview = null;
let previewImg = null;
let clickFunc = null;


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
        //previewImg.style.width = '95%';
        previewImg.style.height = '95%';
        
        previewImg.onload = () => {
            clickFunc = () => {
                downloadImage(imgBase64);
            }
            captureBtn.style.backgroundColor = '#CCC';
            preview.style.display = 'flex';
            downloadIcon.style.display = 'block';
        };

        guideContainer.appendChild(preview);
    }

    previewImg.src = imgBase64;
}

function connectServer() {
    const wss = new WebSocket('wss://ar.tsp-xr.com:5503');

    wss.onmessage = (msg) => {
        const jsonData = JSON.parse(msg.data);

        switch(jsonData.flag) {
            case flag.SEND_IMAGE_FLAG:
                setPreviewLayer(jsonData.data);
                wss.close();
                break;
        }
    };

    wss.onopen = () => {
        wss.send(JSON.stringify({
            'flag' : flag.CLIENT_FLAG
        }));
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
            wss.send(JSON.stringify({
                'flag' : flag.GET_IMAGE_FLAG
            }));
        },
        changeFrameMsg: (frameType) => {
            wss.send(JSON.stringify({
                'flag' : flag.CHANGE_FRAME_FLAG,
                'data': frameType
            }));
        },
        changeModelMsg: () => {
            wss.send(JSON.stringify({
                'flag' : flag.CHANGE_MODEL_FLAG,
            }));
        }
    } 
}

window.onload = () => {
    const server = connectServer();
    clickFunc = () => {
        captureBtn.style.backgroundColor = '#FF3333';
        server.sendCaptureMsg();

        const guide = document.querySelector('.guide');
        const inner = guide.querySelector('p');
        inner.innerHTML = '잠시만 기다려주세요...';

        clickFunc = () => {
            console.log('Please Wait...')
        }
    }

    captureBtn.addEventListener('click', () => {
        clickFunc();
    });
}