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

function connectCaptureServer(videoElement, layerList, cx, cy, cw, ch, effect) {
    const wss = new WebSocket('wss://127.0.0.1:5503');

    wss.onmessage = (msg) => {
        const data = msg.data;

        if (data == flag.GET_IMAGE_FLAG) {
            effect.countDown().then(() => {
                effect.playEffect().then(() => {
                    const capturedImage = getCaptureImage(videoElement, layerList, cx, cy, cw, ch);
                    getFrame([ capturedImage ]).then((imgBase64) => {
                        wss.send(JSON.stringify({
                            'flag' : flag.SEND_IMAGE_FLAG,
                            'data' : imgBase64
                        }));
                    });
                })
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

    return wss;
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
                                                            containerElement,
                                                            layerList,
                                                            cx=0, cy=0, cw=0, ch=0,
                                                            buttonElement=null) {
    if (!captureButton) {
        if (buttonElement) {
            captureButton = buttonElement;
        } else {
            captureButton = document.createElement('div');
            captureButton.id = 'capture-btn';
            captureButton.style.position = 'absolute';
            captureButton.style.backgroundColor = '#FF0000';
            captureButton.style.width = '30px';
            captureButton.style.height = '30px';
            captureButton.style.borderRadius = '30px';
            captureButton.style.margin = '10px';
            captureButton.style.top = 0;
            captureButton.style.left = 0;
            captureButton.style.zIndex = '1000';
            containerElement.prepend(captureButton);
        }
    }

    const effect = createCaptureEffect(containerElement);
    const server = connectCaptureServer(videoElement, layerList, cx, cy, cw, ch, effect);
    getFrameInfo();

    captureButton.addEventListener('click', (event) => {
        effect.playEffect().then(() => {
            const capturedImage = getCaptureImage(videoElement, layerList, cx, cy, cw, ch);
            getFrame([ capturedImage ]).then((imgBase64) => {
                server.send(JSON.stringify({
                    'flag' : flag.SEND_IMAGE_FLAG,
                    'data' : imgBase64
                }));
            });
        })
        //downloadImage(capturedImage.imgURL);
    });
}

function createCaptureEffect(containerElement) {
    let captureEffectCanvas = document.querySelector('#capture-effect');

    if (!captureEffectCanvas) {
        captureEffectCanvas = document.createElement('canvas');
        captureEffectCanvas.id = 'capture-effect';
        captureEffectCanvas.style.position = 'absolute';
        captureEffectCanvas.style.zIndex = '1000';
        captureEffectCanvas.style.display = 'none';
        const captureEffectContext = captureEffectCanvas.getContext('2d');
        const triangleCanvas = document.createElement('canvas');
        const triangleContext = triangleCanvas.getContext('2d');
        const polygon_sides = 10;
        const vertices = Array(polygon_sides).fill(null);
        const angle_increment = Math.PI * 2 / polygon_sides;
        const exterior_angle = angle_increment;

        const count = document.createElement('div');
        count.style.position = 'absolute';
        count.style.width = '100%';
        count.style.height = '100%';
        count.style.color = '#FFF'
        count.style.display = 'none';
        count.style.justifyContent = 'center';
        count.style.alignItems = 'center';
        count.style.textAlign = 'center';
        count.style.fontSize = '15em';
    
        let center_x;
        let center_y;
        let radius = 100;
        let longestSide;
    
        const setVertices = () => {
            for (let i = 0; i < polygon_sides; i++) {
                const x = center_x + radius * Math.cos(angle_increment * i);
                const y = center_y - radius * Math.sin(angle_increment * i);
                
                vertices[i] = { x, y };
            }
        }
    
        const updateTriangle = () => {
            const gradient = triangleContext.createLinearGradient(0, 0, triangleCanvas.width, 0);
            gradient.addColorStop(0, '#222');
            gradient.addColorStop(0.3, '#000');
            triangleContext.fillStyle = gradient;
            
            triangleContext.strokeStyle = '#444';
            
            triangleContext.clearRect(0, 0, triangleCanvas.width, triangleCanvas.height);
            
            triangleContext.moveTo(0, 0);
            triangleContext.lineTo(triangleCanvas.width, 0);
            triangleContext.lineTo(
                triangleCanvas.width * Math.cos(exterior_angle),
                triangleCanvas.height * Math.sin(exterior_angle)
            );
            triangleContext.closePath();
            triangleContext.fill();
            triangleContext.stroke();
        }
    
        const placeTriangle = (vertex, i) => {  
            captureEffectContext.save();
            captureEffectContext.translate(vertex.x, vertex.y);
            captureEffectContext.rotate(-Math.PI / 2 - exterior_angle / 2 - exterior_angle * i);
            captureEffectContext.drawImage(triangleCanvas, 0, 0);
            captureEffectContext.restore();
        }
    
        const draw = () => {
            captureEffectContext.clearRect(0, 0, captureEffectCanvas.width, captureEffectCanvas.height);
            
            vertices.forEach((vertex, i) => {
                placeTriangle(vertex, i);
            });
        }
    
        const setSize = () => {
            captureEffectCanvas.width = window.innerWidth;
            captureEffectCanvas.height = window.innerHeight;
            center_x = captureEffectCanvas.width / 2;
            center_y = captureEffectCanvas.height / 2;
            longestSide = Math.max(captureEffectCanvas.width, captureEffectCanvas.height);
            triangleCanvas.width = longestSide;
            triangleCanvas.height = longestSide;
            updateTriangle();
        }
    
        const playEffect = () => {
            return new Promise((resolve) => {
                const width = captureEffectCanvas.width;
                const step = 50;
                let current = width;
    
                radius = width;
                setVertices();
                draw();
    
                captureEffectCanvas.style.display = 'block';
    
                const closeEffect = setInterval(() => {
                    if (current <= 0) {
                        clearInterval(closeEffect);
    
                        current = 0;
    
                        const openEffect = setInterval(() => {
                            if (current >= width) {
                                clearInterval(openEffect);        
                                captureEffectCanvas.style.display = 'none';
                                resolve();
                            }
            
                            radius = current * 0.75 <= width ? current * 0.75 : width;
            
                            setVertices();
                            draw();
                            current += step;
                        }, 1)
                    }
    
                    radius = current * 0.75 >= 0 ? current * 0.75 : 0;
    
                    setVertices();
                    draw();
                    current -= step;
                }, 1);
            })
        }

        const countDown = (time=3) => {
            return new Promise((resolve) => {
                count.style.display = 'flex';
                const start = setInterval(() => {
                    if (time < 1) {
                        clearInterval(start);
                        count.innerHTML = '';
                        count.style.display = 'none';
                        resolve();
                    }
                    count.innerHTML = String(time);
                    time -= 1;
                }, 1000);
            });
        }

        const init = () => {
            setSize();
            setVertices();
            draw();
    
            containerElement.prepend(count);
            containerElement.prepend(captureEffectCanvas);
        
            window.addEventListener('resize', () => {
                setSize();
                setVertices();
                draw();
            });
        }

        init();
        return { 'playEffect': playEffect, 'countDown': countDown };
    }
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