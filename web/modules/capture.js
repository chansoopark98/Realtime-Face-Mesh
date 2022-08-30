/**
 *  @author XHI-NM <jeong.chiseo@tsp-xr.com>
 *  @description
 *  Capture function for augmented reality (video/canvas element)
 */

import { flag } from './server.flags.js';

const captureCanvas = document.createElement('canvas');
const captureContext = captureCanvas.getContext('2d');
const frameConfigPath = './assets/img/frame.json';
let frameConfig = null;
let captureButton = null;

function connectCaptureServer(videoElement, layerList, cx, cy, cw, ch) {
    const wss = new WebSocket('wss://127.0.0.1:5503');

    wss.onmessage = (msg) => {
        const data = msg.data;

        if (data == flag.GET_IMAGE_FLAG) {
            const capturedImage = getCaptureImage(videoElement, layerList, cx, cy, cw, ch);
            getFrame([ capturedImage ]).then((imgBase64) => {
                console.log(imgBase64)
                wss.send(JSON.stringify({
                    'flag' : flag.SEND_IMAGE_FLAG,
                    'data' : imgBase64
                }));
            });
        }
    };

    wss.onopen = () => {
        wss.send(JSON.stringify({ 'flag' : flag.CAMERA_SERVER_FLAG }));
        console.log('connect successfully!');
    };

    wss.onclose = () => {
        console.log('disconneted')
    };

    wss.onerror = () => {
        console.log('error occured! failed to connect server.')
    };

    return{
        sendCaptureMsg: () => {
            wss.send(JSON.stringify({ 'flag' : flag.GET_IMAGE_FLAG }));
        }
    } 
}

function getCurrentDate() {
    const current = new Date();
    const year = current.getFullYear();
    const month = ('0' + (current.getMonth() + 1)).slice(-2);
    const day = ('0' + current.getDate()).slice(-2);
    const hh = ('0' + current.getHours()).slice(-2); 
    const mm = ('0' + current.getMinutes()).slice(-2);
    const ss = ('0' + current.getSeconds()).slice(-2); 
    const dateString = `${year}${month}${day}_${hh}-${mm}-${ss}`;

    return dateString;
}

function getFrameInfo() {
    const request = new XMLHttpRequest();
    request.open('GET', frameConfigPath);
    request.responseType = 'json';
    request.send();
    request.onload = () => {
        frameConfig = request.response;
    }
}

function downloadImage(imageURL, imageName=null) {
    let dataURL = imageURL.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');
    dataURL = dataURL.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Capture.png');
    
    const link = document.createElement('a');

    if (imageName) {
        link.download = str(imageName);
    } else {
        link.download = `${getCurrentDate()}.png`;
    }
    link.href = dataURL;
    link.click();
}

function getCaptureImage(videoElement, layerList, cx=0, cy=0, cw=0, ch=0) {
    // const width = videoElement.videoWidth;
    // const height = videoElement.videoHeight;
    const width = 2560;
    const height = 1440;

    if (cw === 0 || ch === 0) {
        cw = width;
        ch = height;
    }

    captureCanvas.width = width;
    captureCanvas.height = height;

    try {
        captureContext.drawImage(videoElement, 0, 0, width, height);

        layerList.forEach((layer) => {
            captureContext.drawImage(layer, 0, 0, layer.width, layer.height);
        });
    
        const imgData = captureContext.getImageData(cx, cy, cw, ch);

        captureCanvas.width = cw;
        captureCanvas.height = ch;
        captureContext.putImageData(imgData, 0, 0);
        const imgBase64 = captureCanvas.toDataURL('image/png', 1.0);
    
        return {
            'data': imgData,
            'imgURL': imgBase64,
        };
    } catch (err) {
        console.error(err);
        return;
    }
}

function createCaptureButton(videoElement,
                                                            layerList,
                                                            cx=0, cy=0, cw=0, ch=0,
                                                            buttonElement=null) {
    if (!captureButton) {
        if (buttonElement) {
            captureButton = buttonElement;
        } else {
            captureButton = document.createElement('div');
            captureButton.style.position = 'absolute';
            captureButton.style.backgroundColor = '#FF0000';
            captureButton.style.width = '30px';
            captureButton.style.height = '30px';
            captureButton.style.borderRadius = '30px';
            captureButton.style.margin = '10px';
            captureButton.style.zIndex = '9999999';
            document.body.appendChild(captureButton);
        }
    }

    getFrameInfo();
    connectCaptureServer(videoElement, layerList, cx, cy, cw, ch);

    captureButton.addEventListener('click', (event) => {
        const capturedImage = getCaptureImage(videoElement, layerList, cx, cy, cw, ch);
        getFrame([ capturedImage ]);
        //downloadImage(capturedImage.imgURL);
    });
}

function getFrame(imgList, mode='white_normal_frame') {
    return new Promise((resolve, reject) => {
        const imageCanvas = document.createElement('canvas');
        const imageContext = imageCanvas.getContext('2d');
    
        const tmpCanvas = document.createElement('canvas');
        const tmpContext = tmpCanvas.getContext('2d');
    
        const frameCanvas = document.createElement('canvas');
        const frameContext = frameCanvas.getContext('2d');
    
        const config = frameConfig.frameImg;
        const frameSrc = config[mode].imgSrc;
        const frameWidth = config[mode].imgWidth;
        const frameHeight = config[mode].imgHeight;
        const frameImg = new Image();
    
        frameImg.onload = () => {
            frameCanvas.width = frameWidth;
            frameCanvas.height = frameHeight;
    
            Object.keys(config[mode].idx).forEach((id) => {
                const ox = config[mode].idx[id].offsetX;
                const oy = config[mode].idx[id].offsetY;
                const img = imgList[0].data;
    
                const rw = frameWidth - (ox * 2);
                const rh = rw * (img.height / img.width);
    
                tmpCanvas.width = img.width;
                tmpCanvas.height = img.height;
                tmpContext.putImageData(img, 0, 0);
    
                imageCanvas.width = rw;
                imageCanvas.height = rh;
                imageContext.drawImage(tmpCanvas, 0, 0, img.width, img.height, 0, 0, rw, rh);
                const imgData = imageContext.getImageData(0, 0, rw, rh);
    
                createImageBitmap(imgData).then((imgBitmap) => {
                    frameContext.drawImage(imgBitmap, ox, oy, rw, rh);
                    frameContext.drawImage(frameImg, 0, 0, frameWidth, frameHeight);
                    const imgBase64 = frameCanvas.toDataURL('image/png', 1.0);
                    // downloadImage(imgBase64);
                    resolve(imgBase64);
                })
            });
        }
    
        frameImg.src = frameSrc;
    });
}

export { getCaptureImage, downloadImage, createCaptureButton }