/**
 *  @author XHI-NM <jeong.chiseo@tsp-xr.com>
 *  @description
 *  Capture function for augmented reality (video/canvas element)
 */

const captureCanvas = document.createElement('canvas');
const captureContext = captureCanvas.getContext('2d');
let captureButton = null;

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

function downloadImage(imageURL, imageName=null) {
    let dataURL = imageURL.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');
    dataURL = dataURL.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Capture.jpg');
    
    const link = document.createElement('a');

    if (imageName) {
        link.download = str(imageName);
    } else {
        link.download = `${getCurrentDate()}.jpg`;
    }
    link.href = dataURL;
    link.click();
}

function getCaptureImage(videoElement, layerList, cx=0, cy=0, cw=0, ch=0) {
    const width = videoElement.videoWidth;
    const height = videoElement.videoHeight;

    captureCanvas.width = width;
    captureCanvas.height = height;

    try {
        captureContext.drawImage(videoElement, 0, 0, width, height);

        layerList.forEach(layer => {
            captureContext.drawImage(layer, 0, 0, layer.width, layer.height);
        });
    
        const imgData = captureContext.getImageData(cx, cy, cw, ch);

        console.log(cx, cy, cw, ch)

        captureCanvas.width = cw;
        captureCanvas.height = ch;
        captureContext.putImageData(imgData, 0, 0);
        const imgBase64 = captureCanvas.toDataURL('image/jpeg', 1.0);
    
        return {
            'data': imgData,
            'imgURL': imgBase64
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

    captureButton.addEventListener('click', (event) => {
        const capturedImage = getCaptureImage(videoElement, layerList, cx, cy, cw, ch);
        downloadImage(capturedImage.imgURL);
    });
}

export { getCaptureImage, downloadImage, createCaptureButton }